// Envio de e-mails da plataforma via Resend (gateway de conectores Lovable).
// Toda mensagem passa por `email_log` com chave única: o mesmo evento nunca
// gera dois e-mails, mesmo com reenvios ou cliques repetidos.
// Modelos e identidade visual: ./emailTemplates.ts e ./lifecycleTemplates.ts.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { type EmailEvent, FROM, REPLY_TO, renderEmail } from "./emailTemplates.ts";

export { escapeHtml, renderEmail, SITE_URL, type EmailEvent } from "./emailTemplates.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type SendResult = "sent" | "duplicate" | "failed";

/**
 * Envia um e-mail já renderizado, uma vez por `dedupeKey`.
 * Nunca lança: falha de e-mail não deve derrubar o fluxo que a disparou.
 */
export const sendRenderedEmail = async (
  admin: SupabaseClient,
  opts: {
    to: string;
    dedupeKey: string;
    userId?: string | null;
    /** Nome do evento/modelo, para o email_log. */
    event: string;
    subject: string;
    html: string;
    text: string;
    from?: string;
    /** Cabeçalhos extras (ex.: List-Unsubscribe). */
    headers?: Record<string, string>;
  },
): Promise<SendResult> => {
  const to = opts.to?.trim().toLowerCase();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return "failed";

  const { data: row, error: insErr } = await admin.from("email_log").insert({
    dedupe_key: opts.dedupeKey, event: opts.event, recipient: to, user_id: opts.userId ?? null,
  }).select("id").single();
  if (insErr) {
    if (insErr.code === "23505") return "duplicate";
    console.error("email_log_insert_failed", insErr.message);
    return "failed";
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const mark = (patch: Record<string, unknown>) => admin.from("email_log").update(patch).eq("id", row.id);
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    await mark({ status: "failed", error: "missing_credentials" });
    return "failed";
  }

  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
        "Idempotency-Key": opts.dedupeKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: opts.from ?? FROM, to: [to], reply_to: REPLY_TO,
        subject: opts.subject, html: opts.html, text: opts.text,
        ...(opts.headers ? { headers: opts.headers } : {}),
        tags: [{ name: "event", value: opts.event.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) }],
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`resend_failed [${res.status}]: ${body.slice(0, 500)}`);
      await mark({ status: "failed", error: `${res.status}: ${body.slice(0, 500)}` });
      return "failed";
    }
    let id: string | null = null;
    try { id = JSON.parse(body)?.id ?? null; } catch { /* ignore */ }
    await mark({ status: "sent", provider_id: id });
    return "sent";
  } catch (e) {
    await mark({ status: "failed", error: e instanceof Error ? e.message : String(e) });
    return "failed";
  }
};

/** E-mails de suporte, portfólio e alertas (modelos de emailTemplates.ts). */
export const sendPlatformEmail = async (
  admin: SupabaseClient,
  opts: { to: string; event: EmailEvent; dedupeKey: string; userId?: string | null },
): Promise<SendResult> => {
  try {
    const { subject, html, text } = renderEmail(opts.event);
    return await sendRenderedEmail(admin, {
      to: opts.to, dedupeKey: opts.dedupeKey, userId: opts.userId, event: opts.event.type, subject, html, text,
    });
  } catch (e) {
    console.error("email_render_failed", e instanceof Error ? e.message : String(e));
    return "failed";
  }
};
