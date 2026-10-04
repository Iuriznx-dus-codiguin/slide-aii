// Cakto webhook receiver — atualiza profiles.plan/subscription_status após eventos de pagamento.
//
// Eventos suportados:
//   • purchase_approved       → libera geração única (single) ou ativa assinatura no primeiro ciclo
//   • subscription_created    → ativa assinatura
//   • subscription_renewed    → estende o período (renewsAt = agora + ciclo)
//   • subscription_canceled   → marca status=canceled (acesso até o fim do período pago)
//   • refunded / chargeback   → cancela e limpa o plano
//
// Segurança: o segredo pode chegar em header (`x-cakto-token`, `x-cakto-secret`,
// `authorization`…), query (`?token=`/`?secret=`) ou no corpo (`secret`).
// Sem `CAKTO_WEBHOOK_SECRET` configurado o endpoint recusa tudo (fail-closed).
// Idempotência via índice único parcial em `payment_events.cakto_id`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  addMonths, classifyEvent, collectProvidedSecrets, cyclePeriodMonths, dig,
  escapeLike, extractCaktoId, extractEmail, extractEventType, extractStatus,
  extractSubscriptionId, hasValidSecret, isActiveSubscriber, normalizeSecret, parseExpectedSecrets,
  PLAN_MONTHLY_CREDITS, PLAN_SIGNUP_BONUS, refundScopeFor, resolvePlan,
  SINGLE_PURCHASE_CREDITS, SUBSCRIPTION_PLANS, isRenewalEvent, type Plan,
} from "./lib.ts";
import { createLogger, fingerprint } from "../_shared/observability.ts";
import { flushOpsAlerts, hourBucket, raiseOpsAlert } from "../_shared/opsAlerts.ts";

// Tabelas de créditos por plano: ./lib.ts (usadas também pela regra de
// estorno, que precisa saber quanto cada pedido concedeu).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cakto-token, x-cakto-secret, x-webhook-secret, x-webhook-token, x-signature, x-request-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  const admin = createClient(SUPABASE_URL, SERVICE);
  const log = createLogger("cakto-webhook", req, admin);
  await log.setIpFrom(req);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify({ ...(body as object), request_id: log.requestId }), {
      status,
      headers: { ...corsHeaders, ...log.headers, "Content-Type": "application/json" },
    });

  if (!WEBHOOK_SECRET) {
    await log.security("webhook_error", { severity: "critical", status: 500, detail: { reason: "secret_not_configured" } });
    await raiseOpsAlert(admin, {
      kind: "webhook_not_configured", severity: "critical", dedupeKey: `webhook_not_configured:${hourBucket()}`,
      title: "Webhook da Cakto sem CAKTO_WEBHOOK_SECRET: pagamentos não estão sendo processados",
    });
    return json({ error: "Webhook not configured." }, 500);
  }

  let payload: any = {};
  const rawBody = await req.text().catch(() => "");
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      const form = new URLSearchParams(rawBody);
      payload = Object.fromEntries(form.entries());
      for (const field of ["payload", "data", "event_data"]) {
        const encoded = payload[field];
        if (typeof encoded === "string" && /^[{[]/.test(encoded.trim())) {
          try { payload[field] = JSON.parse(encoded); } catch { /* mantém o valor original */ }
        }
      }
    }
  }

  const provided = collectProvidedSecrets(req.headers, req.url, payload);
  if (!hasValidSecret(provided, WEBHOOK_SECRET)) {
    // Diagnóstico sem vazar segredo: comparamos FINGERPRINTS (hash curto).
    // Se o fingerprint enviado pela Cakto for diferente do esperado, o valor
    // cadastrado no painel da Cakto não é o mesmo de CAKTO_WEBHOOK_SECRET.
    const providedFps = await Promise.all(
      provided.map((v) => fingerprint(normalizeSecret(v))),
    );
    const expectedFps = await Promise.all(
      parseExpectedSecrets(WEBHOOK_SECRET).map((v) => fingerprint(v)),
    );
    await log.security("webhook_invalid_secret", {
      status: 401,
      detail: {
        provided_fingerprints: providedFps.filter(Boolean),
        expected_fingerprints: expectedFps,
        sources: {
          header_token: !!req.headers.get("x-cakto-token"),
          authorization: !!req.headers.get("authorization"),
          body_secret: typeof payload?.secret === "string",
        },
        event_type: extractEventType(payload) || null,
      },
    });
    // Um por hora: o segredo do painel da Cakto e o da Lovable Cloud divergem.
    await raiseOpsAlert(admin, {
      kind: "webhook_invalid_secret", severity: "critical", dedupeKey: `webhook_invalid_secret:${hourBucket()}`,
      title: "Webhook da Cakto recusado: segredo diferente do configurado",
      details: {
        evento: extractEventType(payload) || null,
        impressao_recebida: providedFps.filter(Boolean).join(", ") || "nenhuma",
        impressao_esperada: expectedFps.join(", "),
      },
    });
    return json({ error: "unauthorized" }, 401);
  }


  const event_type = extractEventType(payload);
  const status = extractStatus(payload);
  const cakto_id = extractCaktoId(payload);
  const email = extractEmail(payload);
  let plan: Plan | undefined = resolvePlan(payload);
  const action = classifyEvent(event_type, status);

  const customerId = dig(payload, ["data.customer.id", "customer.id"]) as string | undefined;
  const subscriptionId = extractSubscriptionId(payload);

  // Resolve o user_id pelo e-mail.
  //
  // Ordem: profiles.email (case-insensitive) → auth.users via
  // `find_user_id_by_email` (SECURITY DEFINER, só service_role). O segundo
  // passo é essencial: perfis antigos podem estar sem e-mail preenchido e,
  // sem ele, o pagamento nunca era creditado a ninguém.
  let userId: string | null = null;
  if (email) {
    const { data: profile } = await admin
      .from("profiles").select("id").ilike("email", escapeLike(email)).maybeSingle();
    if (profile?.id) {
      userId = profile.id;
    } else {
      const { data: foundId, error: findErr } = await admin
        .rpc("find_user_id_by_email", { _email: email });
      if (findErr) log.error("find_user_by_email_failed", { message: findErr.message });
      if (typeof foundId === "string" && foundId) {
        userId = foundId;
        // Backfill: garante que a próxima cobrança resolva no primeiro passo.
        await admin.from("profiles").update({ email }).eq("id", userId);
      }
    }
  }

  const { data: insertedEvent, error: insertErr } = await admin
    .from("payment_events")
    .insert({
      provider: "cakto",
      event_type: event_type || "unknown",
      cakto_id: cakto_id ?? null,
      user_email: email ?? null,
      user_id: userId,
      payload,
      processed: false,
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      log.info("duplicate_delivery", { cakto_id });
      return json({ ok: true, note: "duplicate delivery ignored" });
    }
    log.error("payment_event_insert_failed", { code: insertErr.code });
    return json({ error: "Falha ao registrar evento de pagamento." }, 500);
  }
  const eventRowId = insertedEvent!.id as string;

  if (!userId) {
    log.warn("user_not_found", { event_type });
    // Pagamento, estorno ou cancelamento sem conta correspondente precisa de
    // acerto manual (o cliente pode ter pago com outro e-mail).
    if (action !== "ignored") {
      await raiseOpsAlert(admin, {
        kind: "payment_user_not_found", severity: action === "paid" ? "critical" : "warning",
        dedupeKey: `payment_user_not_found:${eventRowId}`,
        title: "Evento de pagamento sem conta com o mesmo e-mail",
        details: { evento: event_type, acao: action, email_do_pedido: email ?? null, pedido: cakto_id ?? null, payment_event: eventRowId },
      });
    }
    await admin.from("payment_events")
      .update({ processed: true, error_message: "user not found by email" })
      .eq("id", eventRowId);
    return json({ ok: true, note: "user not found" });
  }

  // Eventos de assinatura (renovação, atraso recuperado, reembolso) às vezes
  // chegam com produto/oferta que não mapeia para um plano: usa o plano do
  // perfil quando a assinatura do evento é a mesma registrada.
  if (!plan && subscriptionId) {
    const { data: owner } = await admin.from("profiles")
      .select("plan, cakto_subscription_id").eq("id", userId).maybeSingle();
    if (owner?.cakto_subscription_id === subscriptionId
      && (SUBSCRIPTION_PLANS as readonly string[]).includes(owner.plan ?? "")) {
      plan = owner.plan as Plan;
    }
  }
  if (action === "paid" && !plan) {
    log.warn("plan_not_resolved", { event_type });
    await raiseOpsAlert(admin, {
      kind: "payment_plan_not_resolved", severity: "critical", dedupeKey: `payment_plan_not_resolved:${eventRowId}`,
      title: "Pagamento recebido sem plano reconhecido (produto ou oferta fora do mapa)",
      details: { evento: event_type, usuario: userId, pedido: cakto_id ?? null, payment_event: eventRowId },
    });
    await admin.from("payment_events")
      .update({ processed: true, error_message: "plan not resolved" })
      .eq("id", eventRowId);
    return json({ ok: true, note: "plan not resolved" });
  }

  try {
    if (action === "paid" && plan) {
      const now = new Date();
      const periodMonths = cyclePeriodMonths(plan);
      const renewsAt = periodMonths ? addMonths(now, periodMonths) : null;

      const { data: before } = await admin
        .from("profiles")
        .select("plan, subscription_status, subscription_renews_at, credits_monthly, cakto_subscription_id, cakto_customer_id")
        .eq("id", userId)
        .maybeSingle();

      const prevIsSubscriber = isActiveSubscriber(before, now);

      if (plan === "single") {
        // Compra avulsa NÃO rebaixa o plano de quem já é assinante ativo:
        // apenas credita o bônus permanente (500 = 400 + 100 de vitrine).
        const patch: Record<string, unknown> = {
          cakto_customer_id: customerId ?? before?.cakto_customer_id ?? null,
        };
        if (!prevIsSubscriber) {
          patch.plan = "single";
          patch.subscription_status = null;
        }
        await admin.from("profiles").update(patch).eq("id", userId);
        // Sem assinatura ativa, a sobra da cota mensal de uma assinatura
        // cancelada/vencida não pode voltar a valer junto com o avulso
        // (can_user_generate e consume_credits somam bônus + mensal).
        if (!prevIsSubscriber && (before?.credits_monthly ?? 0) > 0) {
          const { error: zeroErr } = await admin.rpc("set_monthly_credits", {
            _uid: userId, _amount: 0, _type: "subscription_ended",
          });
          if (zeroErr) log.error("zero_monthly_failed", { message: zeroErr.message });
        }

        const { error: creditErr } = await admin.rpc("grant_bonus_credits", {
          _uid: userId, _amount: SINGLE_PURCHASE_CREDITS, _type: "single_purchase",
        });
        if (creditErr) log.error("grant_bonus_credits_failed", { message: creditErr.message });
      } else {
        const patch: Record<string, unknown> = {
          plan,
          subscription_status: "active",
          subscription_period_start: now.toISOString(),
          cakto_customer_id: customerId ?? null,
          cakto_subscription_id: subscriptionId ?? null,
        };
        if (renewsAt) patch.subscription_renews_at = renewsAt.toISOString();
        await admin.from("profiles").update(patch).eq("id", userId);

        // Cota mensal SEMPRE redefinida (ativação ou renovação). O tipo da
        // transação diferencia as duas para a animação no app.
        const isRenewal = isRenewalEvent(event_type)
          || (!!subscriptionId && before?.cakto_subscription_id === subscriptionId);
        const monthly = PLAN_MONTHLY_CREDITS[plan] ?? 0;
        const { error: monthlyErr } = await admin.rpc("set_monthly_credits", {
          _uid: userId, _amount: monthly, _type: isRenewal ? "subscription_renewal" : "subscription_monthly",
        });
        if (monthlyErr) log.error("set_monthly_credits_failed", { message: monthlyErr.message });

        // Bônus permanente: UMA VEZ POR CONTA, nunca em renovação.
        //
        // Antes, "primeira ativação" era deduzida comparando o
        // cakto_subscription_id anterior com o do evento. Como cancelar e
        // reembolsar limpam esse campo — e uma reassinatura sempre traz um id
        // novo —, bastava cancelar e assinar de novo para ganhar o bônus
        // outra vez. Quem decide agora é o histórico do usuário em
        // credit_transactions, checado atomicamente no banco
        // (grant_bonus_credits_once); o webhook só informa a intenção.
        const signupBonus = PLAN_SIGNUP_BONUS[plan] ?? 0;
        let bonusGranted = false;
        if (!isRenewal && signupBonus > 0) {
          const { data: bonusResult, error: bonusErr } = await admin.rpc("grant_bonus_credits_once", {
            _uid: userId, _amount: signupBonus, _type: "subscription_signup_bonus",
          });
          if (bonusErr) log.error("grant_signup_bonus_failed", { message: bonusErr.message });
          else bonusGranted = (bonusResult as { granted?: boolean } | null)?.granted === true;
        }
        log.info("subscription_credits", { plan, monthly, isRenewal, signupBonus, bonusGranted });
      }
    } else if (action === "refund") {
      // Reembolso/chargeback desfaz SÓ o que aquele pedido concedeu (ver
      // refundScopeFor). Antes, qualquer reembolso zerava todos os créditos e
      // rebaixava o plano — inclusive o reembolso de uma compra avulsa feita
      // por um assinante ativo. O estorno é idempotente por pedido no banco
      // (revoke_order_credits): refund + chargeback do mesmo pedido estornam
      // uma vez só.
      const { data: current } = await admin
        .from("profiles")
        .select("cakto_subscription_id")
        .eq("id", userId)
        .maybeSingle();
      const scope = refundScopeFor({
        plan,
        payloadSubscriptionId: subscriptionId ?? null,
        profileSubscriptionId: current?.cakto_subscription_id ?? null,
      });

      if (scope.kind === "review") {
        // Sem certeza do que estornar: nada é retirado automaticamente.
        await log.security("webhook_refund_review", {
          severity: "warning",
          status: 200,
          detail: { reason: scope.reason, event_type, plan: plan ?? null, cakto_id: cakto_id ?? null },
        });
        await admin.from("payment_events")
          .update({ processed: true, error_message: `refund_needs_review:${scope.reason}` })
          .eq("id", eventRowId);
        return json({ ok: true, action, note: "refund needs manual review" });
      }

      if (scope.cancelSubscription) {
        await admin.from("profiles").update({
          subscription_status: "canceled",
          plan: "free",
          cakto_subscription_id: null,
        }).eq("id", userId);
      }
      const { data: revoked, error: revokeErr } = await admin.rpc("revoke_order_credits", {
        _uid: userId,
        _order_id: cakto_id ?? `${event_type}:${subscriptionId ?? "sem-id"}`,
        _revoke_bonus: scope.revokeBonus,
        _zero_monthly: scope.zeroMonthly,
        _type: "refund_revoke",
      });
      if (revokeErr) log.error("revoke_order_credits_failed", { message: revokeErr.message });
      else log.info("credits_revoked", { revoked, scope: scope.kind });

    } else if (action === "canceled") {
      // Não apaga o plano: apenas marca canceled. Pelos Termos (seção 7), o
      // acesso e a cota continuam até subscription_renews_at — fim do período
      // pago — e só então o entitlement pausa as gerações (o bônus segue valendo).
      await admin.from("profiles").update({
        subscription_status: "canceled",
      }).eq("id", userId);
    } else if (action === "paused" || action === "resumed") {
      // Pausa suspende a cota mensal (o bônus permanente segue valendo);
      // retomar reativa sem recreditar — a cota volta na próxima renovação.
      const { data: cur } = await admin.from("profiles")
        .select("plan, cakto_subscription_id").eq("id", userId).maybeSingle();
      const sameSub = !subscriptionId || !cur?.cakto_subscription_id || cur.cakto_subscription_id === subscriptionId;
      if (cur?.plan && (SUBSCRIPTION_PLANS as readonly string[]).includes(cur.plan) && sameSub) {
        await admin.from("profiles").update({
          subscription_status: action === "paused" ? "paused" : "active",
        }).eq("id", userId);
      } else {
        log.info("pause_resume_skipped", { event_type, sameSub });
      }
    } else {
      log.info("event_ignored", { event_type, status });
    }

    await admin.from("payment_events").update({ processed: true }).eq("id", eventRowId);
  } catch (e) {
    log.error("process_error", { message: e instanceof Error ? e.message : String(e) });
    await raiseOpsAlert(admin, {
      kind: "payment_process_error", severity: "critical", dedupeKey: `payment_process_error:${eventRowId}`,
      title: "Erro ao processar evento de pagamento",
      details: { evento: event_type, usuario: userId, payment_event: eventRowId, erro: e instanceof Error ? e.message : String(e) },
    });
    await admin.from("payment_events").update({
      error_message: e instanceof Error ? e.message : String(e),
    }).eq("id", eventRowId);
  }

  log.info("processed", { event_type, action, plan });
  await flushOpsAlerts(admin);
  return json({ ok: true, event: event_type, action, plan, userId });
});
