// Gera a pré-visualização de todos os e-mails da plataforma.
//   npm run email:preview            → .email-previews/*.html e *.txt
// Abra os .html no navegador para conferir layout, textos e links.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type EmailEvent, renderEmail } from "../supabase/functions/_shared/emailTemplates.ts";

export const SAMPLE_EMAILS: Record<string, EmailEvent> = {
  "boas-vindas": { type: "welcome", name: "Marina" },
  "chamado-aberto": { type: "ticket_opened", ticketId: "SUP-1042", subject: "Não consigo exportar em PowerPoint", conversationId: "8b1f0c1e-0000-4000-8000-000000000000" },
  "chamado-encaminhado": { type: "ticket_escalated", ticketId: "SUP-1042", conversationId: "8b1f0c1e-0000-4000-8000-000000000000" },
  "chamado-resposta": { type: "support_reply", ticketId: "SUP-1042", resolved: false, conversationId: "8b1f0c1e-0000-4000-8000-000000000000", reply: "Oi! Corrigimos a exportação.\nPode tentar de novo e nos contar?" },
  "chamado-resolvido": { type: "support_reply", ticketId: "SUP-1042", resolved: true, reply: "Tudo certo por aqui. Qualquer coisa, é só chamar." },
  "portfolio-pedido": { type: "access_requested", requesterName: "Rafael Souza", message: "Vi sua palestra e queria ver os slides." },
  "portfolio-aprovado": { type: "access_decided", ownerName: "Marina Lopes", ownerUsername: "marina", approved: true },
  "portfolio-recusado": { type: "access_decided", ownerName: "Marina Lopes", approved: false },
  "alerta-operacao": { type: "ops_alert", kind: "generation_stale", severity: "warning", title: "2 gerações interrompidas sem resposta", details: { estornadas: 2, creditos_devolvidos: 240, estorno_com_falha: 0 } },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = join(process.cwd(), ".email-previews");
  mkdirSync(out, { recursive: true });
  for (const [name, event] of Object.entries(SAMPLE_EMAILS)) {
    const { subject, html, text } = renderEmail(event);
    writeFileSync(join(out, `${name}.html`), html);
    writeFileSync(join(out, `${name}.txt`), `Assunto: ${subject}\n\n${text}`);
  }
  console.log(`${Object.keys(SAMPLE_EMAILS).length} e-mails → ${out}`);
}
