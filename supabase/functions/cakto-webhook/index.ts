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
  billingAlertFor, billingSnapshotFrom, pendingChargeFrom,
  isOtherSubscriptionEvent, resolveUserId, safeEventLabel,
  looksLikeCaktoDelivery, paidEventAfterRefund, PAID_EVENT_TYPES,
} from "./lib.ts";
import { createLogger, fingerprint } from "../_shared/observability.ts";
import { clientIpKey } from "../_shared/clientIp.ts";
import { flushOpsAlerts, hourBucket, raiseOpsAlert } from "../_shared/opsAlerts.ts";
import { scheduleLifecycle, sendLifecycle } from "../_shared/lifecycle.ts";
import { planRank } from "../_shared/plans.ts";

// Tabelas de créditos por plano: ./lib.ts (usadas também pela regra de
// estorno, que precisa saber quanto cada pedido concedeu).

const MAX_WEBHOOK_BODY_CHARS = 256 * 1024;

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
  // Endpoint público (sem JWT): o corpo de um evento da Cakto tem poucos KB.
  if (rawBody.length > MAX_WEBHOOK_BODY_CHARS) {
    return json({ error: "payload too large" }, 413);
  }
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
    // Qualquer um pode chamar este endereço: sem teto, cada POST inválido
    // gravava um security_event (crescimento ilimitado da tabela). Além de
    // 30 por hora do mesmo IP, só responde 401.
    const { data: underLimit } = await admin.rpc("check_rate_limit", {
      _key: `ip:${await clientIpKey(req)}`, _fn: "cakto-webhook-invalid", _max_per_hour: 30,
    });
    if (underLimit === false) return json({ error: "unauthorized" }, 401);
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
        event_type: safeEventLabel(extractEventType(payload)),
      },
    });
    // Um por hora: o segredo do painel da Cakto e o da Lovable Cloud divergem.
    // "Crítico" só quando nenhuma entrega válida chegou nas últimas 6 horas:
    // qualquer um mandava um alerta crítico por hora a todos os admins. Com
    // entregas válidas chegando, um POST que parece da Cakto (traz segredo e
    // um tipo de evento conhecido) indica OUTRO webhook com segredo diferente
    // (ex.: o de uma oferta nova): vira aviso, uma vez por dia. O tipo do
    // evento vai filtrado: o texto é de quem chamou.
    const { count: recentValid } = await admin.from("payment_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 6 * 3_600_000).toISOString());
    if (!recentValid) {
      await raiseOpsAlert(admin, {
        kind: "webhook_invalid_secret", severity: "critical", dedupeKey: `webhook_invalid_secret:${hourBucket()}`,
        title: "Webhook da Cakto recusado: segredo diferente do configurado",
        details: {
          evento: safeEventLabel(extractEventType(payload)),
          impressao_recebida: providedFps.filter(Boolean).join(", ") || "nenhuma",
          impressao_esperada: expectedFps.join(", "),
        },
      });
    } else if (looksLikeCaktoDelivery(extractEventType(payload), providedFps.filter(Boolean).length)) {
      await raiseOpsAlert(admin, {
        kind: "webhook_invalid_secret_partial", severity: "warning",
        dedupeKey: `webhook_invalid_secret_partial:${new Date().toISOString().slice(0, 10)}`,
        title: "Entrega da Cakto recusada enquanto outras passam: um dos webhooks pode estar com outro segredo",
        details: {
          evento: safeEventLabel(extractEventType(payload)),
          impressao_recebida: providedFps.filter(Boolean).join(", "),
          impressao_esperada: expectedFps.join(", "),
        },
      });
    }
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

  // Conta do evento: assinatura → pedido → e-mail atual → e-mail de compra
  // anterior → cliente da Cakto (ver resolveUserId). Uma chave que aponta
  // para mais de uma conta não decide nada.
  const single = (ids: Array<string | null | undefined>): string | null => {
    const unique = [...new Set(ids.filter((v): v is string => !!v))];
    return unique.length === 1 ? unique[0] : null;
  };
  const existing = async (id: string | null): Promise<string | null> => {
    if (!id) return null;
    const { data } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
    return data?.id ?? null;
  };
  const { userId, via: userVia } = await resolveUserId(
    { subscriptionId, orderId: cakto_id, email, customerId },
    {
      bySubscription: async (id) => single(((await admin.from("profiles").select("id")
        .eq("cakto_subscription_id", id).limit(2)).data ?? []).map((r: { id: string }) => r.id)),
      byOrder: async (id) => existing(single(((await admin.from("payment_events").select("user_id")
        .eq("cakto_id", id).not("user_id", "is", null).limit(10)).data ?? []).map((r: { user_id: string }) => r.user_id))),
      byEmail: async (address) => {
        // profiles.email (sem curinga) → auth.users via find_user_id_by_email
        // (SECURITY DEFINER, só service_role): perfis antigos podem estar sem e-mail.
        const { data: profile } = await admin
          .from("profiles").select("id").ilike("email", escapeLike(address)).maybeSingle();
        if (profile?.id) return profile.id;
        const { data: foundId, error: findErr } = await admin.rpc("find_user_id_by_email", { _email: address });
        if (findErr) log.error("find_user_by_email_failed", { message: findErr.message });
        return typeof foundId === "string" && foundId ? foundId : null;
      },
      byPurchaseEmail: async (address) => existing((await admin.from("payment_events").select("user_id")
        .eq("user_email", address).not("user_id", "is", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.user_id ?? null),
      byCustomer: async (id) => single(((await admin.from("profiles").select("id")
        .eq("cakto_customer_id", id).limit(2)).data ?? []).map((r: { id: string }) => r.id)),
    },
  );
  if (userId && userVia !== "email") log.info("user_resolved", { via: userVia });

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

  // A assinatura já foi aplicada a esta conta antes (é antiga, não nova): uma
  // cota mensal concedida por ela, ou um evento PAGO dela, há mais de um dia.
  // Pix/boleto gerado e o evento irmão da mesma compra (que chegam juntos, às
  // vezes em paralelo) não contam: contavam, e a troca de plano paga por Pix
  // era ignorada.
  const subscriptionAppliedBefore = async (id: string): Promise<boolean> => {
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { count: grants } = await admin.from("credit_transactions").select("id", { count: "exact", head: true })
      .eq("user_id", userId).in("type", ["subscription_monthly", "subscription_renewal"])
      .eq("metadata->>subscription_id", id).lt("created_at", dayAgo);
    if ((grants ?? 0) > 0) return true;
    const paidSeen = async (shape: Record<string, unknown>) => {
      const { count } = await admin.from("payment_events").select("id", { count: "exact", head: true })
        .eq("user_id", userId).in("event_type", PAID_EVENT_TYPES).lt("created_at", dayAgo).contains("payload", shape);
      return (count ?? 0) > 0;
    };
    return (await paidSeen({ data: { subscription: { id } } })) || (await paidSeen({ subscription: { id } }));
  };
  // Estorno já registrado para este pedido ou esta assinatura.
  const refundRecorded = async (key: "order_id" | "subscription_id", value: string | null | undefined): Promise<boolean> => {
    if (!value) return false;
    const { count } = await admin.from("credit_transactions").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("type", "refund_revoke").eq(`metadata->>${key}`, value);
    return (count ?? 0) > 0;
  };

  // Para os avisos por e-mail (depois do processamento).
  let prevPlan: string | null = null;
  let prevWasSubscriber = false;
  let bonusForEmail = 0;
  // Evento de outra assinatura que não muda a conta: sem aviso por e-mail.
  let skipNotify = false;

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
      prevPlan = before?.plan ?? null;
      prevWasSubscriber = prevIsSubscriber;

      // Aprovação que chega depois do estorno do mesmo pedido (ou ativação
      // atrasada de assinatura já reembolsada): antes, reativava o plano com
      // cota mensal por todo o período e dava o bônus de ativação de novo.
      const afterRefund = paidEventAfterRefund({
        orderRefunded: await refundRecorded("order_id", cakto_id),
        subscriptionRefunded: plan !== "single" && await refundRecorded("subscription_id", subscriptionId),
        renewal: isRenewalEvent(event_type),
      });

      if (afterRefund) {
        skipNotify = true;
        log.warn("paid_after_refund", { event_type, cakto_id });
        await raiseOpsAlert(admin, {
          kind: "payment_after_refund", severity: "warning", dedupeKey: `payment_after_refund:${eventRowId}`,
          title: "Pagamento de um pedido já reembolsado: nada foi reativado",
          details: {
            evento: event_type, usuario: userId, pedido: cakto_id ?? null, assinatura: subscriptionId ?? null,
            payment_event: eventRowId,
          },
        });
        await admin.from("payment_events")
          .update({ processed: true, error_message: "paid_after_refund" })
          .eq("id", eventRowId);
        return json({ ok: true, note: "paid event of a refunded order ignored" });
      } else if (plan === "single" && !cakto_id) {
        // Sem o id do pedido não há como garantir crédito uma única vez por
        // compra (nem estornar depois): acerto manual.
        await raiseOpsAlert(admin, {
          kind: "payment_without_order_id", severity: "critical", dedupeKey: `payment_without_order_id:${eventRowId}`,
          title: "Compra avulsa sem id de pedido: crédito não aplicado automaticamente",
          details: { evento: event_type, usuario: userId, payment_event: eventRowId },
        });
        await admin.from("payment_events")
          .update({ processed: true, error_message: "single_without_order_id" })
          .eq("id", eventRowId);
        return json({ ok: true, note: "single purchase without order id needs review" });
      } else if (plan === "single") {
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

        // Uma vez por PEDIDO: a idempotência de payment_events é por
        // (evento, pedido), e um segundo evento "pago" do mesmo pedido (tipo
        // novo classificado pela heurística, por exemplo) creditava de novo.
        const { data: granted, error: creditErr } = await admin.rpc("grant_order_bonus_credits", {
          _uid: userId, _order_id: String(cakto_id), _amount: SINGLE_PURCHASE_CREDITS, _type: "single_purchase",
        });
        if (creditErr && (creditErr.code === "PGRST202" || creditErr.code === "42883")) {
          // Migração 0010 ainda não aplicada.
          const { error: legacyErr } = await admin.rpc("grant_bonus_credits", {
            _uid: userId, _amount: SINGLE_PURCHASE_CREDITS, _type: "single_purchase",
          });
          if (legacyErr) log.error("grant_bonus_credits_failed", { message: legacyErr.message });
        } else if (creditErr) {
          log.error("grant_order_bonus_credits_failed", { message: creditErr.message });
        } else if ((granted as { granted?: boolean } | null)?.granted === false) {
          log.info("single_purchase_already_granted", { cakto_id, reason: (granted as { reason?: string }).reason });
        }
      } else if (isOtherSubscriptionEvent({
        action, payloadSubscriptionId: subscriptionId, profileSubscriptionId: before?.cakto_subscription_id,
        profileIsActive: prevIsSubscriber, renewal: isRenewalEvent(event_type),
        // Só consulta o histórico quando pode ser uma assinatura antiga.
        knownSubscription: !!subscriptionId && prevIsSubscriber && !isRenewalEvent(event_type)
          && !!before?.cakto_subscription_id && before.cakto_subscription_id !== subscriptionId
          && await subscriptionAppliedBefore(subscriptionId),
      })) {
        // Cobrança de uma assinatura antiga enquanto outra está ativa: a
        // conta paga duas vezes. Não troca plano nem cota; o suporte resolve.
        skipNotify = true;
        log.warn("payment_other_subscription", { event_type });
        await raiseOpsAlert(admin, {
          kind: "payment_other_subscription", severity: "warning", dedupeKey: `payment_other_subscription:${eventRowId}`,
          title: "Cobrança de uma assinatura que não é a vigente da conta (cliente pagando duas assinaturas?)",
          details: {
            evento: event_type, usuario: userId, plano_do_evento: plan, plano_atual: before?.plan ?? null,
            assinatura_do_evento: subscriptionId ?? null, assinatura_atual: before?.cakto_subscription_id ?? null,
            pedido: cakto_id ?? null, payment_event: eventRowId,
          },
        });
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
        // Uma vez por PEDIDO (grant_monthly_for_order): purchase_approved e
        // subscription_created do mesmo pedido, ou um reenvio tardio, não
        // devolvem a cota já gasta entre um e outro.
        const monthly = PLAN_MONTHLY_CREDITS[plan] ?? 0;
        const monthlyType = isRenewal ? "subscription_renewal" : "subscription_monthly";
        const { data: monthlyResult, error: orderMonthlyErr } = await admin.rpc("grant_monthly_for_order", {
          _uid: userId, _order_id: cakto_id ?? null, _subscription_id: subscriptionId ?? null, _amount: monthly, _type: monthlyType,
        });
        if (orderMonthlyErr && (orderMonthlyErr.code === "PGRST202" || orderMonthlyErr.code === "42883")) {
          // Migração 0010 ainda não aplicada.
          const { error: monthlyErr } = await admin.rpc("set_monthly_credits", { _uid: userId, _amount: monthly, _type: monthlyType });
          if (monthlyErr) log.error("set_monthly_credits_failed", { message: monthlyErr.message });
        } else if (orderMonthlyErr) {
          log.error("grant_monthly_for_order_failed", { message: orderMonthlyErr.message });
        } else if ((monthlyResult as { granted?: boolean } | null)?.granted === false) {
          log.info("monthly_already_granted", { cakto_id, reason: (monthlyResult as { reason?: string }).reason });
        }

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
          // Pedido e assinatura ficam na transação: o estorno só retira o
          // bônus quando é o pedido que o concedeu.
          const bonusArgs = { _uid: userId, _amount: signupBonus, _type: "subscription_signup_bonus" };
          let { data: bonusResult, error: bonusErr } = await admin.rpc("grant_bonus_credits_once", {
            ...bonusArgs, _metadata: { order_id: cakto_id ?? null, subscription_id: subscriptionId ?? null },
          });
          if (bonusErr && (bonusErr.code === "PGRST202" || bonusErr.code === "42883")) {
            // Migração 0010 ainda não aplicada (função de três argumentos).
            ({ data: bonusResult, error: bonusErr } = await admin.rpc("grant_bonus_credits_once", bonusArgs));
          }
          if (bonusErr) log.error("grant_signup_bonus_failed", { message: bonusErr.message });
          else bonusGranted = (bonusResult as { granted?: boolean } | null)?.granted === true;
        }
        if (bonusGranted) bonusForEmail = signupBonus;
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
      // Teto do estorno: o bônus que ESTA compra concedeu (o pedido avulso,
      // ou a assinatura reembolsada). Antes, o reembolso de uma reassinatura
      // (que não dá bônus) retirava o bônus de ativação inteiro, levando junto
      // créditos avulsos pagos.
      const { data: granted, error: grantedErr } = await admin.rpc("order_granted_bonus", {
        _uid: userId, _order_id: cakto_id ?? null,
        _subscription_id: scope.kind === "single" ? null : subscriptionId ?? null,
        _type: scope.kind === "single" ? "single_purchase" : "subscription_signup_bonus",
      });
      if (grantedErr) log.warn("order_granted_bonus_unavailable", { code: grantedErr.code });
      // Sem a migração 0010, mantém o teto anterior (o valor do plano).
      const revokeBonus = grantedErr ? scope.revokeBonus : Math.min(scope.revokeBonus, Number(granted) || 0);
      // A assinatura vai junto no registro do estorno: desconta o bônus já
      // retirado num segundo reembolso dela e reconhece a ativação atrasada.
      const revokeArgs = {
        _uid: userId,
        _order_id: cakto_id ?? `${event_type}:${subscriptionId ?? "sem-id"}`,
        _revoke_bonus: revokeBonus,
        _zero_monthly: scope.zeroMonthly,
        _type: "refund_revoke",
      };
      let { data: revoked, error: revokeErr } = await admin.rpc("revoke_order_credits", {
        ...revokeArgs, _subscription_id: scope.kind === "single" ? null : subscriptionId ?? null,
      });
      if (revokeErr && (revokeErr.code === "PGRST202" || revokeErr.code === "42883")) {
        // Migração 0010 ainda não aplicada (função de cinco argumentos).
        ({ data: revoked, error: revokeErr } = await admin.rpc("revoke_order_credits", revokeArgs));
      }
      if (revokeErr) log.error("revoke_order_credits_failed", { message: revokeErr.message });
      else log.info("credits_revoked", { revoked, scope: scope.kind, revokeBonus });
      // Créditos do pedido já gastos: o estorno não tem de onde tirar. Sem
      // saldo negativo; a equipe decide (chargeback depois de usar tudo).
      const r = revoked as { reason?: string; revoked_bonus?: number } | null;
      if (!revokeErr && r?.reason !== "already_revoked" && (r?.revoked_bonus ?? 0) < revokeBonus) {
        await raiseOpsAlert(admin, {
          kind: "refund_after_consumption", severity: "warning", dedupeKey: `refund_after_consumption:${eventRowId}`,
          title: "Reembolso ou chargeback de créditos que já tinham sido usados",
          details: {
            evento: event_type, usuario: userId, pedido: cakto_id ?? null, payment_event: eventRowId,
            creditos_do_pedido: revokeBonus, estornados: r?.revoked_bonus ?? 0, ja_usados: revokeBonus - (r?.revoked_bonus ?? 0),
          },
        });
      }

    } else if (action === "canceled") {
      // Não apaga o plano: apenas marca canceled. Pelos Termos (seção 7), o
      // acesso e a cota continuam até subscription_renews_at — fim do período
      // pago — e só então o entitlement pausa as gerações (o bônus segue valendo).
      // Cancelar a assinatura ANTIGA depois de assinar outra (troca de plano)
      // não cancela a nova.
      const { data: cur } = await admin.from("profiles")
        .select("cakto_subscription_id").eq("id", userId).maybeSingle();
      if (isOtherSubscriptionEvent({
        action, payloadSubscriptionId: subscriptionId, profileSubscriptionId: cur?.cakto_subscription_id,
        profileIsActive: true, renewal: false, knownSubscription: true,
      })) {
        skipNotify = true;
        log.info("cancel_other_subscription_skipped", { event_type });
      } else {
        await admin.from("profiles").update({
          subscription_status: "canceled",
        }).eq("id", userId);
      }
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

  // ── Avisos por e-mail: dados de cobrança + envio/agendamento ──
  // Nunca derruba o webhook: o pagamento já foi processado acima.
  try {
    if (!skipNotify) await notifyLifecycle({
      admin, userId, eventType: event_type, action, plan: plan ?? null, payload, eventRowId,
      orderId: cakto_id ?? null, subscriptionId: subscriptionId ?? null,
      prevPlan, prevWasSubscriber, bonus: bonusForEmail,
    });
  } catch (e) {
    log.error("lifecycle_email_failed", { message: e instanceof Error ? e.message : String(e) });
  }

  log.info("processed", { event_type, action, plan });
  await flushOpsAlerts(admin);
  return json({ ok: true, event: event_type, action, plan, userId });
});

// ───────────── Avisos por e-mail ─────────────
// docs/produto/plano-de-avisos-por-email.md, seções 6.3 a 6.5.
const spDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

async function notifyLifecycle(o: {
  admin: any; userId: string; eventType: string; action: string; plan: string | null; payload: any;
  eventRowId: string; orderId: string | null; subscriptionId: string | null;
  prevPlan: string | null; prevWasSubscriber: boolean; bonus: number;
}) {
  const { admin, userId, payload } = o;
  const ev = (o.eventType ?? "").toLowerCase();
  const checkoutUrl = dig(payload, ["data.checkoutUrl", "checkoutUrl"]);
  const ref = o.orderId ?? o.eventRowId;

  // 1) Forma de pagamento e próxima cobrança da assinatura.
  const { data: prevBilling } = await admin.from("billing_profiles").select("billing_alert").eq("user_id", userId).maybeSingle();
  const prevAlert: string | null = prevBilling?.billing_alert ?? null;
  const snap = billingSnapshotFrom(payload);
  const alert = billingAlertFor(ev, o.action as any);
  const patch: Record<string, unknown> = {};
  if (snap) Object.assign(patch, snap);
  // Compra avulsa (sem assinatura no payload) não apaga alerta da assinatura.
  if (alert !== undefined && (alert !== null || snap || o.action === "resumed")) {
    patch.billing_alert = alert;
    patch.billing_alert_at = alert ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length) {
    await admin.from("billing_profiles").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }

  // 2) Pix/boleto em aberto; pagamento confirmado fecha os pendentes.
  const pending = pendingChargeFrom(ev, payload);
  if (pending) {
    await admin.from("pending_charges").upsert(
      { user_id: userId, order_id: o.orderId, subscription_id: o.subscriptionId, ...pending },
      { onConflict: "order_id,kind" },
    );
  }
  if (o.action === "paid") {
    await admin.from("pending_charges").update({ resolved_at: new Date().toISOString() })
      .eq("user_id", userId).is("resolved_at", null);
  }

  const send = (template: any, dedupeKey: string, data: Record<string, unknown> = {}) =>
    sendLifecycle(admin, { userId, template, dedupeKey, data });
  const schedule = (template: any, sendAt: Date, dedupeKey: string, data: Record<string, unknown> = {}) =>
    scheduleLifecycle(admin, { userId, template, sendAt, dedupeKey, data });
  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);

  // 3) E-mails do evento.
  if (o.action === "paid" && o.plan) {
    if (o.plan === "single") {
      await send("purchase_single", `purchase_single:${ref}`);
    } else if (isRenewalEvent(ev)) {
      const wasLate = !!prevAlert;
      await send(wasLate ? "subscription_reactivated" : "renewal_success", `renewal:${userId}:${spDate()}`);
    } else {
      // purchase_approved e subscription_created chegam juntos: a chave por
      // conta + plano + dia garante um e-mail só.
      const upgraded = o.prevWasSubscriber && planRank(o.prevPlan) < planRank(o.plan);
      await send(upgraded ? "subscription_upgraded" : "subscription_created",
        `subscription_start:${userId}:${o.plan}:${spDate()}`, { bonus: o.bonus });
    }
  } else if (o.action === "canceled") {
    await send("subscription_canceled", `canceled:${userId}:${o.subscriptionId ?? spDate()}`);
  } else if (o.action === "paused") {
    await send("subscription_paused", `paused:${userId}:${spDate()}`);
  } else if (o.action === "resumed") {
    await send("subscription_reactivated", `resumed:${userId}:${spDate()}`);
  } else if (o.action === "refund") {
    await send(ev === "chargeback" ? "chargeback" : "refund_done", `${ev === "chargeback" ? "chargeback" : "refund"}:${ref}`);
  } else if (ev === "refund_requested") {
    await send("refund_requested", `refund_requested:${ref}`);
  } else if (ev === "purchase_refused") {
    await send("purchase_refused", `purchase_refused:${ref}`, { checkoutUrl });
  } else if (ev === "subscription_renewal_refused") {
    await send("renewal_refused", `renewal_refused:${userId}:${spDate()}`, { checkoutUrl });
  } else if (ev === "subscription_late") {
    await send("subscription_late", `late:${userId}:${spDate()}`, { checkoutUrl });
  } else if (pending?.kind === "pix") {
    await schedule("pix_pending", inMinutes(10), `pix_pending:${ref}`, { order_id: o.orderId });
  } else if (pending?.kind === "boleto") {
    // Véspera do vencimento às 9 h; se vence antes disso, em 1 hora.
    const exp = pending.expires_at ? new Date(pending.expires_at) : null;
    const eve = exp ? new Date(new Date(`${spDate(new Date(exp.getTime() - 86_400_000))}T09:00:00-03:00`)) : null;
    const at = eve && eve.getTime() > Date.now() + 3_600_000 ? eve : inMinutes(60);
    await schedule("boleto_pending", at, `boleto_pending:${ref}`, { order_id: o.orderId });
  } else if (ev === "checkout_abandonment") {
    const data = { checkoutUrl };
    await schedule("checkout_abandoned", inMinutes(60), `checkout_abandoned_1h:${ref}`, data);
    await schedule("checkout_abandoned", inMinutes(24 * 60), `checkout_abandoned_24h:${ref}`, data);
  }
}
