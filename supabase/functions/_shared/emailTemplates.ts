// Modelos dos e-mails da plataforma (código puro, sem Deno nem rede: roda
// também no vitest e em scripts/email-preview.ts). O envio fica em email.ts.
//
// Cada evento vira um conjunto de blocos (parágrafo, citação, lista, passos,
// tabela) renderizado em HTML (layout em tabelas, compatível com
// Gmail/Outlook/Apple Mail) e em texto puro, enviados juntos. A versão em
// texto melhora a entrega e é o que leitores de tela e relógios mostram.
// Pré-visualização de todos os modelos: `npm run email:preview`.
//
// Os e-mails de cadastro, confirmação e senha são do sistema de login da
// Lovable Cloud (domínio próprio de envio) e seguem esta mesma identidade —
// ver docs/operacao/emails.md.

export const SITE_URL = "https://slideai.com.br";
export const FROM = "SlideAI <contato@slideai.com.br>";
/** Respostas vão para o atendimento citado nos Termos (src/lib/legal.ts). */
export const REPLY_TO = "suporte@slideai.com.br";

// Identidade visual (src/index.css): --primary 252 100% 64%, --accent 280 95% 65%.
const BRAND = {
  primary: "#6C47FF",
  accent: "#C251FB",
  ink: "#17172B",
  body: "#3F3F5C",
  muted: "#7A7A96",
  line: "#E9E6FB",
  page: "#F5F3FF",
  card: "#FFFFFF",
  quote: "#F3F0FF",
  logo: `${SITE_URL}/email-logo.png`,
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
};

export const escapeHtml = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// ───────────── Blocos de conteúdo ─────────────
// Texto dos blocos é sempre texto puro: o HTML é escapado aqui. A única
// marcação aceita é **negrito**, aplicada depois do escape.
export type Block =
  | { p: string }
  | { quote: string; label?: string }
  | { list: string[] }
  | { steps: string[] }
  | { rows: [string, string][] }
  | { note: string };

const inline = (t: string) => escapeHtml(t).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${BRAND.ink}">$1</strong>`);
const plain = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1");

const blockHtml = (b: Block): string => {
  const p = `margin:0 0 16px;font-size:15px;line-height:24px;color:${BRAND.body}`;
  if ("p" in b) return `<p style="${p}">${inline(b.p)}</p>`;
  if ("note" in b) return `<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${BRAND.muted}">${inline(b.note)}</p>`;
  if ("quote" in b) {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px"><tr><td style="background:${BRAND.quote};border-left:3px solid ${BRAND.primary};border-radius:8px;padding:14px 16px">`
      + (b.label ? `<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:6px">${escapeHtml(b.label)}</div>` : "")
      + `<div style="font-size:14px;line-height:22px;color:${BRAND.ink};white-space:pre-wrap">${escapeHtml(b.quote)}</div></td></tr></table>`;
  }
  if ("list" in b) {
    return `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:24px;color:${BRAND.body}">`
      + b.list.map((i) => `<li style="margin:0 0 6px">${inline(i)}</li>`).join("") + `</ul>`;
  }
  if ("steps" in b) {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 16px">`
      + b.steps.map((s, i) => `<tr><td width="36" valign="top" style="padding:0 0 12px"><div style="width:26px;height:26px;border-radius:13px;background:${BRAND.quote};color:${BRAND.primary};font-size:13px;font-weight:700;line-height:26px;text-align:center">${i + 1}</div></td><td valign="top" style="padding:3px 0 12px;font-size:15px;line-height:22px;color:${BRAND.body}">${inline(s)}</td></tr>`).join("")
      + `</table>`;
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px;border:1px solid ${BRAND.line};border-radius:8px">`
    + b.rows.map(([k, v], i) => `<tr><td style="padding:10px 14px;font-size:13px;color:${BRAND.muted};${i ? `border-top:1px solid ${BRAND.line};` : ""}width:40%">${escapeHtml(k)}</td><td style="padding:10px 14px;font-size:13px;color:${BRAND.ink};${i ? `border-top:1px solid ${BRAND.line};` : ""}word-break:break-word">${escapeHtml(v)}</td></tr>`).join("")
    + `</table>`;
};

const blockText = (b: Block): string => {
  if ("p" in b) return plain(b.p);
  if ("note" in b) return plain(b.note);
  if ("quote" in b) return (b.label ? `${b.label}:\n` : "") + b.quote.split("\n").map((l) => `> ${l}`).join("\n");
  if ("list" in b) return b.list.map((i) => `• ${plain(i)}`).join("\n");
  if ("steps" in b) return b.steps.map((s, i) => `${i + 1}. ${plain(s)}`).join("\n");
  return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
};

export interface EmailContent {
  subject: string;
  /** Linha de prévia mostrada pela caixa de entrada ao lado do assunto. */
  preheader: string;
  title: string;
  blocks: Block[];
  cta?: { label: string; url: string };
  /** Por que a pessoa recebeu (rodapé). */
  reason: string;
  /** Alertas internos: sem rodapé público. */
  internal?: boolean;
}

const ctaHtml = (cta: { label: string; url: string }) => `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr>
<td bgcolor="${BRAND.primary}" style="border-radius:10px;background:${BRAND.primary};background-image:linear-gradient(135deg,${BRAND.primary},${BRAND.accent})">
<a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${BRAND.font};font-size:15px;font-weight:600;line-height:18px;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(cta.label)}</a>
</td></tr></table>
<p style="margin:0 0 8px;font-size:12px;line-height:18px;color:${BRAND.muted}">Se o botão não abrir, copie este endereço no navegador:<br><a href="${escapeHtml(cta.url)}" style="color:${BRAND.primary};word-break:break-all">${escapeHtml(cta.url)}</a></p>`;

const footerLink = (label: string, path: string) =>
  `<a href="${SITE_URL}${path}" style="color:${BRAND.muted};text-decoration:underline">${label}</a>`;

export const renderLayout = (c: EmailContent): string => `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(c.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${BRAND.page}" style="background:${BRAND.page}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;font-family:${BRAND.font}">
<tr><td style="padding:0 4px 20px">
  <a href="${SITE_URL}" style="text-decoration:none;color:${BRAND.ink}">
  <img src="${BRAND.logo}" width="32" height="32" alt="" style="vertical-align:middle;border:0;border-radius:8px">
  <span style="vertical-align:middle;margin-left:8px;font-size:18px;font-weight:700;letter-spacing:-.01em;color:${BRAND.ink}">SlideAI</span>
  </a>
</td></tr>
<tr><td bgcolor="${BRAND.card}" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden">
  <div style="height:4px;line-height:4px;font-size:0;background:${BRAND.primary};background-image:linear-gradient(90deg,${BRAND.primary},${BRAND.accent})">&nbsp;</div>
  <div style="padding:32px 32px 16px">
    <h1 style="margin:0 0 20px;font-size:22px;line-height:30px;font-weight:700;letter-spacing:-.01em;color:${BRAND.ink}">${escapeHtml(c.title)}</h1>
    ${c.blocks.map(blockHtml).join("\n    ")}
    ${c.cta ? ctaHtml(c.cta) : ""}
  </div>
</td></tr>
<tr><td style="padding:24px 8px 0;font-size:12px;line-height:18px;color:${BRAND.muted};text-align:center">
  ${c.internal ? escapeHtml(c.reason) : `${escapeHtml(c.reason)}<br>
  Dúvidas? Responda este e-mail ou acesse a ${footerLink("Central de Ajuda", "/ajuda")}.<br><br>
  ${footerLink("Termos de Uso", "/termos")} &nbsp;·&nbsp; ${footerLink("Privacidade", "/privacidade")} &nbsp;·&nbsp; <a href="${SITE_URL}" style="color:${BRAND.muted};text-decoration:none">slideai.com.br</a>`}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

export const renderText = (c: EmailContent): string => [
  c.title,
  "",
  ...c.blocks.map((b) => blockText(b) + "\n"),
  ...(c.cta ? [`${c.cta.label}: ${c.cta.url}`, ""] : []),
  "—",
  c.reason,
  ...(c.internal ? [] : [
    `Dúvidas? Responda este e-mail ou acesse a Central de Ajuda: ${SITE_URL}/ajuda`,
    `SlideAI · ${SITE_URL}`,
  ]),
].join("\n");

// ───────────── Eventos ─────────────
export type EmailEvent =
  | { type: "welcome"; name?: string | null }
  | { type: "ticket_opened"; ticketId: string; subject?: string | null; conversationId?: string | null }
  | { type: "ticket_escalated"; ticketId: string; conversationId?: string | null }
  | { type: "support_reply"; ticketId: string; reply: string; resolved: boolean; conversationId?: string | null }
  | { type: "access_requested"; requesterName: string; message?: string | null }
  | { type: "access_decided"; ownerName: string; ownerUsername?: string | null; approved: boolean }
  | {
    type: "ops_alert";
    title: string;
    severity: "info" | "warning" | "critical";
    kind: string;
    details?: Record<string, unknown>;
    occurredAt?: string;
  };

const ticketUrl = (conversationId?: string | null) =>
  `${SITE_URL}/suporte${conversationId ? `/${encodeURIComponent(conversationId)}` : ""}`;
const ticketLabel = (id: string) => (id ? ` ${id}` : "");

const SEVERITY_LABEL = { info: "Informativo", warning: "Atenção", critical: "Crítico" } as const;

const whenBr = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) + " (Brasília)";

const detailValue = (v: unknown): string =>
  v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

export const buildEmail = (e: EmailEvent): EmailContent => {
  switch (e.type) {
    case "welcome":
      return {
        subject: "Boas-vindas ao SlideAI",
        preheader: "Sua conta está pronta. Veja como criar a primeira apresentação em poucos minutos.",
        title: `Que bom ter você aqui${e.name ? `, ${e.name}` : ""}!`,
        blocks: [
          { p: "Sua conta no SlideAI está pronta. A partir de um tema, a IA monta o roteiro, escreve os slides, escolhe imagens e cria gráficos — você revisa e apresenta." },
          {
            steps: [
              "**Descreva o tema** e escolha o número de slides, o tom e a profundidade do texto.",
              "**Gere** e acompanhe a criação. Leva cerca de um minuto.",
              "**Ajuste no editor** ou peça mudanças ao assistente, e depois apresente, compartilhe o link ou exporte em PDF e PowerPoint.",
            ],
          },
          { note: "Antes de gerar, a tela mostra quantos créditos a apresentação vai usar. Revise sempre o conteúdo: textos gerados por IA podem conter imprecisões." },
        ],
        cta: { label: "Criar minha primeira apresentação", url: `${SITE_URL}/gerar` },
        reason: "Você recebeu este e-mail porque criou uma conta no SlideAI.",
      };
    case "ticket_opened":
      return {
        subject: `Recebemos seu chamado${ticketLabel(e.ticketId)}`,
        preheader: "Seu atendimento foi aberto. Você pode acompanhar a conversa pelo suporte.",
        title: "Recebemos seu chamado",
        blocks: [
          { p: `Seu atendimento${e.ticketId ? ` **${e.ticketId}**` : ""} foi aberto. O assistente do suporte já está analisando e, quando for preciso, um atendente da equipe assume a conversa.` },
          ...(e.subject ? [{ quote: e.subject, label: "Sua mensagem" } as Block] : []),
          { note: "Guarde o número do chamado: ele agiliza o atendimento se você precisar falar com a gente por outro canal." },
        ],
        cta: { label: "Acompanhar chamado", url: ticketUrl(e.conversationId) },
        reason: "Você recebeu este e-mail porque abriu um chamado no suporte do SlideAI.",
      };
    case "ticket_escalated":
      return {
        subject: `Chamado${ticketLabel(e.ticketId)} encaminhado à equipe`,
        preheader: "Um atendente vai cuidar do seu caso. Avisaremos por e-mail quando houver resposta.",
        title: "Um atendente vai cuidar do seu caso",
        blocks: [
          { p: `O chamado${e.ticketId ? ` **${e.ticketId}**` : ""} foi encaminhado para a nossa equipe. Você recebe um e-mail assim que houver resposta, e o histórico fica disponível no suporte.` },
          { note: "Respondemos em até 1 dia útil." },
        ],
        cta: { label: "Ver chamado", url: ticketUrl(e.conversationId) },
        reason: "Você recebeu este e-mail porque tem um chamado aberto no suporte do SlideAI.",
      };
    case "support_reply":
      return {
        subject: e.resolved ? `Chamado${ticketLabel(e.ticketId)} resolvido` : `Nova resposta no chamado${ticketLabel(e.ticketId)}`,
        preheader: e.resolved ? "A equipe marcou seu chamado como resolvido." : "A equipe do SlideAI respondeu seu chamado.",
        title: e.resolved ? "Seu chamado foi resolvido" : "A equipe respondeu seu chamado",
        blocks: [
          { quote: e.reply, label: "Resposta da equipe" },
          {
            p: e.resolved
              ? "Se o problema continuar, responda pelo suporte e o chamado é reaberto."
              : "Para continuar a conversa, responda pelo suporte: assim tudo fica no mesmo histórico.",
          },
        ],
        cta: { label: e.resolved ? "Ver chamado" : "Responder", url: ticketUrl(e.conversationId) },
        reason: "Você recebeu este e-mail porque tem um chamado no suporte do SlideAI.",
      };
    case "access_requested":
      return {
        subject: `${e.requesterName} pediu acesso ao seu portfólio`,
        preheader: "Aprove ou recuse o pedido no seu perfil.",
        title: "Novo pedido de acesso ao portfólio",
        blocks: [
          { p: `**${e.requesterName}** quer ver o seu portfólio privado.` },
          ...(e.message ? [{ quote: e.message, label: "Mensagem" } as Block] : []),
          { note: "Quem for aprovado vê as apresentações do portfólio enquanto ele estiver privado. Você pode revogar o acesso quando quiser." },
        ],
        cta: { label: "Aprovar ou recusar", url: `${SITE_URL}/perfil` },
        reason: "Você recebeu este e-mail porque alguém pediu acesso ao seu portfólio no SlideAI.",
      };
    case "access_decided":
      return {
        subject: e.approved ? `Acesso liberado ao portfólio de ${e.ownerName}` : `Pedido de acesso ao portfólio de ${e.ownerName}`,
        preheader: e.approved ? "Você já pode ver as apresentações." : "O dono preferiu manter o portfólio privado.",
        title: e.approved ? "Seu acesso foi aprovado" : "Seu pedido não foi aprovado",
        blocks: [{
          p: e.approved
            ? `**${e.ownerName}** liberou o acesso ao portfólio. Você já pode ver as apresentações.`
            : `**${e.ownerName}** preferiu manter o portfólio privado por enquanto.`,
        }],
        cta: e.approved && e.ownerUsername
          ? { label: "Ver portfólio", url: `${SITE_URL}/u/${encodeURIComponent(e.ownerUsername)}` }
          : undefined,
        reason: "Você recebeu este e-mail porque pediu acesso a um portfólio no SlideAI.",
      };
    case "ops_alert": {
      const rows = Object.entries(e.details ?? {}).map(([k, v]) => [k, detailValue(v)] as [string, string]);
      return {
        subject: `[SlideAI · ${SEVERITY_LABEL[e.severity]}] ${e.title}`,
        preheader: `${e.kind} — ${e.title}`,
        title: e.title,
        blocks: [
          { rows: [["Gravidade", SEVERITY_LABEL[e.severity]], ["Tipo", e.kind], ["Quando", whenBr(e.occurredAt)]] },
          ...(rows.length ? [{ rows } as Block] : []),
          { p: "O que fazer em cada tipo de alerta está em docs/operacao/runbooks.md (seção Alertas)." },
        ],
        cta: { label: "Abrir painel", url: `${SITE_URL}/__dev` },
        reason: "Alerta automático da operação do SlideAI, enviado aos administradores.",
        internal: true,
      };
    }
  }
};

export const renderEmail = (e: EmailEvent): { subject: string; html: string; text: string } => {
  const c = buildEmail(e);
  return { subject: c.subject, html: renderLayout(c), text: renderText(c) };
};
