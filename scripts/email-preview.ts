// Gera a pré-visualização de todos os e-mails da plataforma.
//   npm run email:preview            → .email-previews/*.html e *.txt
// Abra os .html no navegador para conferir layout, textos e links.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type EmailEvent, renderEmail, renderLayout, renderText } from "../supabase/functions/_shared/emailTemplates.ts";
import {
  buildLifecycleEmail, type LifecycleContext, type LifecycleTemplate,
} from "../supabase/functions/_shared/lifecycleTemplates.ts";

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

const base: LifecycleContext = {
  firstName: "Fernando", persona: "professor", email: "fernando@escola.com.br",
  plan: "mensal", subscriptionStatus: "active", renewsAt: "2026-11-12T12:00:00Z", autoRenew: false,
  paymentMethod: "pix", cardBrand: null, cardLast4: null, nextPaymentDate: "2026-11-12T12:00:00Z",
  balance: 2840, hasPurchased: true, generations: 12,
  unsubscribeUrl: "https://slideai.com.br/emails/preferencias?t=exemplo&sair=1",
  preferencesUrl: "https://slideai.com.br/emails/preferencias?t=exemplo",
};
const card: Partial<LifecycleContext> = { autoRenew: true, paymentMethod: "credit_card", cardBrand: "visa", cardLast4: "4323" };
const newUser: Partial<LifecycleContext> = { plan: "free", subscriptionStatus: null, renewsAt: null, paymentMethod: null, balance: 0, hasPurchased: false, generations: 0 };

/** Ciclo de vida: modelo, situação e dados do evento. */
export const SAMPLE_LIFECYCLE: Record<string, [LifecycleTemplate, Partial<LifecycleContext>, Record<string, unknown>?]> = {
  "ciclo-boas-vindas-sem-compra-professor": ["welcome", newUser],
  "ciclo-boas-vindas-com-compra-estudante": ["welcome", { firstName: "Ana", persona: "estudante", plan: "single", balance: 500 }],
  "ciclo-nutricao-d1-estudante": ["nurture", { ...newUser, firstName: "Ana", persona: "estudante" }, { day: 1 }],
  "ciclo-nutricao-d3-profissional": ["nurture", { ...newUser, firstName: "Carla", persona: "profissional" }, { day: 3 }],
  "ciclo-nutricao-d5-criador": ["nurture", { ...newUser, firstName: "Lucas", persona: "criador" }, { day: 5 }],
  "ciclo-nutricao-d10-professor": ["nurture", newUser, { day: 10 }],
  "ciclo-nutricao-d15-sem-perfil": ["nurture", { ...newUser, firstName: "Jo", persona: null }, { day: 15 }],
  "ciclo-nutricao-d30-cupom": ["nurture", { ...newUser, firstName: "Ana", persona: "estudante" }, { day: 30 }],
  "ciclo-compra-avulsa": ["purchase_single", { firstName: "Ana", persona: "estudante", plan: "single", balance: 500 }],
  "ciclo-assinatura-criada-pix": ["subscription_created", { balance: 4000 }, { bonus: 800 }],
  "ciclo-upgrade-max": ["subscription_upgraded", { ...card, plan: "max_mensal", firstName: "Lucas", persona: "criador" }],
  "ciclo-lembrete-d5-manual-pix": ["renewal_reminder", { firstName: "Ana", persona: "estudante" }, { days: 5, due: "2026-11-12T12:00:00Z" }],
  "ciclo-lembrete-d3-automatico-cartao": ["renewal_reminder", { ...card, firstName: "Carla", persona: "profissional", plan: "anual" }, { days: 3, due: "2026-11-15T12:00:00Z" }],
  "ciclo-lembrete-d1-pix-automatico": ["renewal_reminder", { autoRenew: true, paymentMethod: "pix_automatico" }, { days: 1, due: "2026-11-12T12:00:00Z" }],
  "ciclo-lembrete-d3-cancelada": ["renewal_reminder", { ...card, subscriptionStatus: "canceled" }, { days: 3, due: "2026-11-12T12:00:00Z" }],
  "ciclo-renovado": ["renewal_success", { ...card, balance: 3200 }],
  "ciclo-renovacao-recusada": ["renewal_refused", { ...card, plan: "max_mensal", firstName: "Lucas", persona: "criador", cardLast4: "1188" }],
  "ciclo-atrasada": ["subscription_late", { firstName: "Ana", persona: "estudante" }],
  "ciclo-atrasada-d3": ["subscription_late_followup", {}],
  "ciclo-reativada": ["subscription_reactivated", card],
  "ciclo-pausada": ["subscription_paused", card],
  "ciclo-cancelada": ["subscription_canceled", { ...card, subscriptionStatus: "canceled" }],
  "ciclo-reembolso-pedido": ["refund_requested", {}],
  "ciclo-reembolso-feito": ["refund_done", {}],
  "ciclo-chargeback": ["chargeback", {}],
  "ciclo-compra-recusada": ["purchase_refused", newUser, { checkoutUrl: "https://pay.cakto.com.br/yw7ej87_856334" }],
  "ciclo-pix-pendente": ["pix_pending", { ...newUser, pending: { kind: "pix", url: "https://pay.cakto.com.br/exemplo", code: "00020126580014BR.GOV.BCB.PIX0136exemplo", expiresAt: "2026-11-12T15:30:00Z" } }],
  "ciclo-boleto-pendente": ["boleto_pending", { ...newUser, pending: { kind: "boleto", url: "https://pay.cakto.com.br/boleto", expiresAt: "2026-11-14T12:00:00Z" } }],
  "ciclo-carrinho-abandonado": ["checkout_abandoned", { ...newUser, firstName: "Carla", persona: "profissional" }, { checkoutUrl: "https://pay.cakto.com.br/yw7ej87_856334" }],
  "ciclo-reconquista-d7": ["winback", { ...card, plan: "anual", subscriptionStatus: "canceled" }, { day: 7, previous_plan: "anual" }],
  "ciclo-reconquista-d30-cupom": ["winback", { ...card, plan: "anual", subscriptionStatus: "canceled" }, { day: 30, previous_plan: "anual" }],
  "ciclo-primeira-apresentacao": ["first_deck", { firstName: "Ana", persona: "estudante" }, { title: "Ciclo da água" }],
  "ciclo-saldo-baixo-avulso": ["credits_low", { plan: "single", balance: 60, firstName: "Ana", persona: "estudante" }],
  "ciclo-saldo-baixo-assinante": ["credits_low", { ...card, balance: 80 }],
  "ciclo-estorno-geracao": ["generation_refunded", {}, { credits: 170 }],
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = join(process.cwd(), ".email-previews");
  mkdirSync(out, { recursive: true });
  for (const [name, event] of Object.entries(SAMPLE_EMAILS)) {
    const { subject, html, text } = renderEmail(event);
    writeFileSync(join(out, `${name}.html`), html);
    writeFileSync(join(out, `${name}.txt`), `Assunto: ${subject}\n\n${text}`);
  }
  for (const [name, [tpl, ctx, data]] of Object.entries(SAMPLE_LIFECYCLE)) {
    const c = buildLifecycleEmail(tpl, { ...base, ...ctx }, data ?? {});
    writeFileSync(join(out, `${name}.html`), renderLayout(c));
    writeFileSync(join(out, `${name}.txt`), `De: ${c.from}\nAssunto: ${c.subject}\n\n${renderText(c)}`);
  }
  console.log(`${Object.keys(SAMPLE_EMAILS).length + Object.keys(SAMPLE_LIFECYCLE).length} e-mails → ${out}`);
}
