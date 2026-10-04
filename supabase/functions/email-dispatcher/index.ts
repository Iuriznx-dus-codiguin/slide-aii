// Despachante dos avisos agendados (pg_cron → pg_net, a cada 10 minutos).
//
// 1. Confere o segredo (Vault: email_dispatch_secret).
// 2. Roda o planejador (plan_lifecycle_emails), que agenda lembretes,
//    nutrição, reconquista etc.
// 3. Reserva os envios vencidos, reavalia a situação de cada pessoa
//    (lifecycleRules.shouldSend) e envia. Relacionamento respeita horário
//    (9 h–20 h de Brasília) e limite de frequência (1/dia, 3/semana).
// 4. Entrega alertas operacionais pendentes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decideAndSend } from "../_shared/lifecycle.ts";
import { frequencyDelay, nextAllowedTime } from "../_shared/lifecycleRules.ts";
import { type LifecycleTemplate, RELATIONSHIP_TEMPLATES } from "../_shared/lifecycleTemplates.ts";
import { flushOpsAlerts, hourBucket, raiseOpsAlert } from "../_shared/opsAlerts.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const secret = req.headers.get("x-dispatch-secret") ?? "";
  const { data: ok } = await admin.rpc("email_dispatch_secret_ok", { _secret: secret });
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const started = Date.now();
  const { data: planned, error: planErr } = await admin.rpc("plan_lifecycle_emails");
  if (planErr) console.error("plan_lifecycle_emails_failed", planErr.message);

  const { data: rows, error: claimErr } = await admin.rpc("claim_due_emails", { _limit: 40 });
  if (claimErr) {
    console.error("claim_due_emails_failed", claimErr.message);
    return json({ error: "claim_failed" }, 500);
  }

  const counts = { sent: 0, skipped: 0, failed: 0, postponed: 0 };
  const relationshipNames = RELATIONSHIP_TEMPLATES as string[];

  for (const row of (rows ?? []) as Array<{
    id: string; user_id: string; template: string; data: Record<string, unknown>; dedupe_key: string; created_at: string;
  }>) {
    // Edge function tem tempo limite: deixa o resto para a próxima rodada.
    if (Date.now() - started > 100_000) {
      await admin.from("email_schedule").update({ status: "pending" }).eq("id", row.id);
      continue;
    }
    const finish = (status: string, reason?: string, extra: Record<string, unknown> = {}) =>
      admin.from("email_schedule").update({ status, reason: reason ?? null, processed_at: new Date().toISOString(), ...extra }).eq("id", row.id);

    try {
      if (relationshipNames.includes(row.template)) {
        // Descadastrou? Descarta já, sem esperar horário ou frequência.
        const { data: pref } = await admin.from("email_preferences")
          .select("relationship_emails").eq("user_id", row.user_id).maybeSingle();
        if (pref?.relationship_emails === false) {
          await finish("skipped", "unsubscribed");
          counts.skipped++;
          continue;
        }
        const later = nextAllowedTime();
        if (later) {
          await admin.from("email_schedule").update({ status: "pending", send_at: later.toISOString() }).eq("id", row.id);
          counts.postponed++;
          continue;
        }
        const since = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
        const [{ count: c24 }, { count: c7 }] = await Promise.all([
          admin.from("email_log").select("id", { count: "exact", head: true })
            .eq("user_id", row.user_id).in("event", relationshipNames).eq("status", "sent").gte("created_at", since(24)),
          admin.from("email_log").select("id", { count: "exact", head: true })
            .eq("user_id", row.user_id).in("event", relationshipNames).eq("status", "sent").gte("created_at", since(24 * 7)),
        ]);
        const delay = frequencyDelay(c24 ?? 0, c7 ?? 0);
        if (delay) {
          await admin.from("email_schedule").update({
            status: "pending", send_at: new Date(Date.now() + delay * 3600_000).toISOString(),
          }).eq("id", row.id);
          counts.postponed++;
          continue;
        }
      }

      const r = await decideAndSend(admin, row);
      await finish(r.status, r.reason);
      counts[r.status]++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("dispatch_row_failed", row.template, msg);
      await finish("failed", msg.slice(0, 300));
      counts.failed++;
    }
  }

  if (counts.failed >= 5) {
    await raiseOpsAlert(admin, {
      kind: "email_dispatch_failures", severity: "warning", dedupeKey: `email_dispatch_failures:${hourBucket()}`,
      title: `${counts.failed} e-mails agendados falharam no envio`,
      details: { ...counts, observacao: "Veja email_log.error e email_schedule.reason." },
    });
  }
  await flushOpsAlerts(admin);

  return json({ ok: true, planned, ...counts, template_types: (rows ?? []).map((r: { template: LifecycleTemplate }) => r.template) });
});
