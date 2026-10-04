// Alertas operacionais por e-mail para a equipe.
//
// Fluxo: quem detecta o problema grava em `ops_alerts` (edge function via
// raiseOpsAlert, ou rotina SQL como refund_stale_generations). flushOpsAlerts
// envia os pendentes aos administradores e marca `notified_at`. O
// `dedupe_key` (único) segura repetições: use hourBucket() para "no máximo um
// alerta deste tipo por hora", ou um id do evento para "um por ocorrência".
//
// Destinatários: contas com papel `admin` (user_roles) e, se configurado, o
// secret OPS_ALERT_EMAILS (lista separada por vírgula). O que fazer em cada
// alerta: docs/operacao/runbooks.md, seção "Alertas".
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendPlatformEmail } from "./email.ts";

export type OpsSeverity = "info" | "warning" | "critical";

export interface OpsAlert {
  kind: string;
  title: string;
  severity?: OpsSeverity;
  details?: Record<string, unknown>;
  dedupeKey: string;
}

/** Hora UTC (ex.: "2026-10-04T13"): um alerta do mesmo tipo por hora. */
export const hourBucket = (d: Date = new Date()): string => d.toISOString().slice(0, 13);

const recipients = async (admin: SupabaseClient): Promise<string[]> => {
  const fromEnv = (Deno.env.get("OPS_ALERT_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
  let fromRoles: string[] = [];
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("email").in("id", ids);
    fromRoles = (profs ?? []).map((p: { email: string | null }) => (p.email ?? "").trim().toLowerCase()).filter(Boolean);
  }
  return [...new Set([...fromEnv, ...fromRoles])];
};

/** Envia os alertas pendentes. Nunca lança. */
export const flushOpsAlerts = async (admin: SupabaseClient, limit = 10): Promise<number> => {
  try {
    const { data: pending } = await admin.from("ops_alerts")
      .select("id, kind, severity, title, details, created_at")
      .is("notified_at", null).order("created_at", { ascending: true }).limit(limit);
    if (!pending?.length) return 0;
    const to = await recipients(admin);
    if (!to.length) {
      console.warn("ops_alert_no_recipients", { pending: pending.length });
      return 0;
    }
    let sent = 0;
    for (const a of pending) {
      // Reivindica antes de enviar: duas funções em paralelo não mandam em dobro.
      const { data: claimed } = await admin.from("ops_alerts")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", a.id).is("notified_at", null).select("id");
      if (!claimed?.length) continue;
      for (const email of to) {
        const r = await sendPlatformEmail(admin, {
          to: email,
          dedupeKey: `ops:${a.id}:${email}`,
          event: {
            type: "ops_alert", kind: a.kind, title: a.title, severity: a.severity,
            details: a.details ?? {}, occurredAt: a.created_at,
          },
        });
        if (r === "sent") sent++;
      }
    }
    return sent;
  } catch (e) {
    console.error("ops_alert_flush_failed", e instanceof Error ? e.message : String(e));
    return 0;
  }
};

/** Registra um alerta (ignora repetição pelo dedupeKey) e tenta enviar. Nunca lança. */
export const raiseOpsAlert = async (admin: SupabaseClient, alert: OpsAlert): Promise<void> => {
  try {
    const { error } = await admin.from("ops_alerts").insert({
      kind: alert.kind,
      severity: alert.severity ?? "warning",
      title: alert.title.slice(0, 200),
      details: alert.details ?? {},
      dedupe_key: alert.dedupeKey.slice(0, 300),
    });
    if (error && error.code !== "23505") console.error("ops_alert_insert_failed", error.message);
    await flushOpsAlerts(admin);
  } catch (e) {
    console.error("ops_alert_failed", e instanceof Error ? e.message : String(e));
  }
};
