// Envio de e-mails da plataforma via Resend (gateway de conectores Lovable).
// Toda mensagem passa por `email_log` com chave única: o mesmo evento nunca
// gera dois e-mails, mesmo com reenvios ou cliques repetidos.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
export const SITE_URL = "https://slideai.com.br";
const FROM = "SlideAI <contato@slideai.com.br>";
const REPLY_TO = "contato@slideai.com.br";

export const escapeHtml = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const layout = (title: string, bodyHtml: string, cta?: { label: string; url: string }) => `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-size:20px;font-weight:700;color:#2563eb;margin-bottom:24px">SlideAI</div>
  <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">${escapeHtml(title)}</h1>
  <div style="font-size:15px;line-height:1.6;color:#334155">${bodyHtml}</div>
  ${cta ? `<p style="margin:28px 0"><a href="${escapeHtml(cta.url)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>` : ""}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px">
  <p style="font-size:12px;color:#94a3b8;margin:0">Você recebeu este e-mail por causa de uma ação na sua conta SlideAI. Dúvidas? Responda este e-mail.</p>
</div></body></html>`;

const p = (t: string) => `<p style="margin:0 0 12px">${t}</p>`;
const quote = (t: string) =>
  `<blockquote style="margin:16px 0;padding:12px 16px;background:#f1f5f9;border-left:3px solid #2563eb;border-radius:4px;white-space:pre-wrap">${escapeHtml(t)}</blockquote>`;

export type EmailEvent =
  | { type: "welcome"; name?: string | null }
  | { type: "ticket_opened"; ticketId: string; subject?: string | null }
  | { type: "ticket_escalated"; ticketId: string }
  | { type: "support_reply"; ticketId: string; reply: string; resolved: boolean }
  | { type: "access_requested"; requesterName: string; message?: string | null }
  | { type: "access_decided"; ownerName: string; ownerUsername?: string | null; approved: boolean };

export const renderEmail = (e: EmailEvent): { subject: string; html: string } => {
  switch (e.type) {
    case "welcome":
      return {
        subject: "Bem-vindo ao SlideAI",
        html: layout(`Olá${e.name ? `, ${e.name}` : ""}! Sua conta está pronta.`,
          p("Agora você pode criar apresentações completas com IA em poucos minutos: escolha o tema, ajuste as opções e deixe o SlideAI montar os slides.") +
          p("Se precisar de ajuda, a Central de Ajuda e o suporte estão disponíveis dentro da plataforma."),
          { label: "Criar minha apresentação", url: `${SITE_URL}/gerar` }),
      };
    case "ticket_opened":
      return {
        subject: `Chamado ${e.ticketId} aberto`,
        html: layout(`Recebemos seu chamado ${e.ticketId}`,
          (e.subject ? quote(e.subject) : "") +
          p("Nosso assistente já está analisando. Você pode acompanhar a conversa a qualquer momento."),
          { label: "Ver chamado", url: `${SITE_URL}/suporte` }),
      };
    case "ticket_escalated":
      return {
        subject: `Chamado ${e.ticketId} encaminhado à equipe`,
        html: layout("Um atendente vai cuidar do seu caso",
          p(`O chamado <strong>${escapeHtml(e.ticketId)}</strong> foi encaminhado para a nossa equipe. Você receberá um e-mail assim que houver resposta.`),
          { label: "Ver chamado", url: `${SITE_URL}/suporte` }),
      };
    case "support_reply":
      return {
        subject: e.resolved ? `Chamado ${e.ticketId} resolvido` : `Nova resposta no chamado ${e.ticketId}`,
        html: layout(e.resolved ? "Seu chamado foi resolvido" : "A equipe respondeu seu chamado",
          quote(e.reply) +
          p(e.resolved ? "Se o problema continuar, é só responder pelo suporte para reabrir." : "Responda pela plataforma para continuar a conversa."),
          { label: "Abrir chamado", url: `${SITE_URL}/suporte` }),
      };
    case "access_requested":
      return {
        subject: `${e.requesterName} pediu acesso ao seu portfólio`,
        html: layout("Novo pedido de acesso ao portfólio",
          p(`<strong>${escapeHtml(e.requesterName)}</strong> quer ver o seu portfólio privado.`) +
          (e.message ? quote(e.message) : ""),
          { label: "Aprovar ou recusar", url: `${SITE_URL}/perfil` }),
      };
    case "access_decided":
      return {
        subject: e.approved ? `Acesso liberado ao portfólio de ${e.ownerName}` : `Pedido de acesso a ${e.ownerName}`,
        html: layout(e.approved ? "Seu acesso foi aprovado" : "Seu pedido não foi aprovado",
          p(e.approved
            ? `${escapeHtml(e.ownerName)} liberou o acesso ao portfólio. Você já pode ver as apresentações.`
            : `${escapeHtml(e.ownerName)} preferiu manter o portfólio privado por enquanto.`),
          e.approved && e.ownerUsername ? { label: "Ver portfólio", url: `${SITE_URL}/u/${encodeURIComponent(e.ownerUsername)}` } : undefined),
      };
  }
};

/**
 * Envia uma vez por `dedupeKey`. Retorna "sent" | "duplicate" | "failed".
 * Nunca lança: falha de e-mail não deve derrubar o fluxo que a disparou.
 */
export const sendPlatformEmail = async (
  admin: SupabaseClient,
  opts: { to: string; event: EmailEvent; dedupeKey: string; userId?: string | null },
): Promise<"sent" | "duplicate" | "failed"> => {
  const to = opts.to?.trim().toLowerCase();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return "failed";

  const { data: row, error: insErr } = await admin.from("email_log").insert({
    dedupe_key: opts.dedupeKey, event: opts.event.type, recipient: to, user_id: opts.userId ?? null,
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
    const { subject, html } = renderEmail(opts.event);
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
        "Idempotency-Key": opts.dedupeKey.slice(0, 256),
      },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`resend_failed [${res.status}]: ${text.slice(0, 500)}`);
      await mark({ status: "failed", error: `${res.status}: ${text.slice(0, 500)}` });
      return "failed";
    }
    let id: string | null = null;
    try { id = JSON.parse(text)?.id ?? null; } catch { /* ignore */ }
    await mark({ status: "sent", provider_id: id });
    return "sent";
  } catch (e) {
    await mark({ status: "failed", error: e instanceof Error ? e.message : String(e) });
    return "failed";
  }
};
