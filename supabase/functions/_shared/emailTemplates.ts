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

/** Cor de destaque por situação (faixa do topo e número em destaque). Sempre acompanhada de texto. */
export type Tone = "brand" | "success" | "warning" | "danger";
const TONE: Record<Tone, [string, string]> = {
  brand: [BRAND.primary, BRAND.accent],
  success: ["#16A34A", "#22C55E"],
  warning: ["#D97706", "#F59E0B"],
  danger: ["#DC2626", "#F97316"],
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
  | { note: string }
  /** Número em destaque: "5 dias", "500 créditos". */
  | { stat: string; label: string }
  /** Cartão do plano: linhas rótulo → valor, com título opcional. */
  | { card: [string, string][]; title?: string }
  /** Medidor de créditos. */
  | { meter: number; max: number; label: string }
  /** Ideias de apresentação com link para gerar. */
  | { ideas: { label: string; url: string }[]; title?: string }
  /** Mini-tabela comparativa; `highlight` = índice da linha em destaque. */
  | { compare: { head: string[]; rows: string[][]; highlight?: number } }
  /** Cupom de desconto. */
  | { coupon: string; text: string }
  /** Faixa de garantias da compra. */
  | { guarantee: true };

const inline = (t: string) => escapeHtml(t).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${BRAND.ink}">$1</strong>`);
const plain = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1");

export const GUARANTEE_TEXT = "Pagamento seguro · Cancele quando quiser · 7 dias para desistir";

const blockHtml = (b: Block, tone: Tone): string => {
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
  if ("stat" in b) {
    const [c1] = TONE[tone];
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px"><tr><td align="center" style="background:${BRAND.quote};border-radius:12px;padding:20px 16px">`
      + `<div style="font-size:38px;line-height:44px;font-weight:800;letter-spacing:-.02em;color:${c1}">${escapeHtml(b.stat)}</div>`
      + `<div style="margin-top:4px;font-size:13px;line-height:18px;color:${BRAND.muted}">${escapeHtml(b.label)}</div></td></tr></table>`;
  }
  if ("card" in b) {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px;border:1px solid ${BRAND.line};border-radius:12px;background:#FBFAFF">`
      + (b.title ? `<tr><td colspan="2" style="padding:14px 16px 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:${BRAND.primary}">${escapeHtml(b.title)}</td></tr>` : "")
      + b.card.map(([k, v]) => `<tr><td style="padding:8px 16px;font-size:13px;color:${BRAND.muted};width:45%">${escapeHtml(k)}</td><td style="padding:8px 16px;font-size:14px;font-weight:600;color:${BRAND.ink};word-break:break-word">${escapeHtml(v)}</td></tr>`).join("")
      + `<tr><td colspan="2" style="height:6px;font-size:0;line-height:0">&nbsp;</td></tr></table>`;
  }
  if ("meter" in b) {
    const pct = Math.max(0, Math.min(100, Math.round((b.meter / Math.max(b.max, 1)) * 100)));
    const [c1, c2] = TONE[tone];
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px"><tr><td>`
      + `<div style="font-size:13px;color:${BRAND.muted};margin-bottom:6px">${escapeHtml(b.label)}</div>`
      + `<div style="height:10px;border-radius:5px;background:${BRAND.line};overflow:hidden"><div style="height:10px;width:${pct}%;border-radius:5px;background:${c1};background-image:linear-gradient(90deg,${c1},${c2})"></div></div>`
      + `</td></tr></table>`;
  }
  if ("ideas" in b) {
    return `<div style="margin:4px 0 20px">`
      + (b.title ? `<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:${BRAND.primary};margin-bottom:8px">${escapeHtml(b.title)}</div>` : "")
      + b.ideas.map((i) => `<a href="${escapeHtml(i.url)}" target="_blank" style="display:block;margin:0 0 8px;padding:12px 14px;border:1px solid ${BRAND.line};border-radius:10px;background:#FBFAFF;font-size:14px;line-height:20px;color:${BRAND.ink};text-decoration:none">✦ ${escapeHtml(i.label)} <span style="color:${BRAND.primary};font-weight:600">→</span></a>`).join("")
      + `</div>`;
  }
  if ("compare" in b) {
    const { head, rows, highlight } = b.compare;
    const th = head.map((h) => `<td style="padding:10px 12px;font-size:12px;font-weight:700;color:${BRAND.muted};border-bottom:1px solid ${BRAND.line}">${escapeHtml(h)}</td>`).join("");
    const tr = rows.map((r, i) => `<tr style="${i === highlight ? `background:${BRAND.quote};` : ""}">${r.map((c, j) => `<td style="padding:10px 12px;font-size:14px;${j === 0 ? "font-weight:700;" : ""}color:${BRAND.ink};${i ? `border-top:1px solid ${BRAND.line};` : ""}">${inline(c)}</td>`).join("")}</tr>`).join("");
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px;border:1px solid ${BRAND.line};border-radius:10px;border-collapse:separate;overflow:hidden"><tr>${th}</tr>${tr}</table>`;
  }
  if ("coupon" in b) {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px"><tr><td align="center" style="border:2px dashed ${BRAND.primary};border-radius:12px;padding:16px">`
      + `<div style="font-size:13px;color:${BRAND.body};margin-bottom:6px">${inline(b.text)}</div>`
      + `<div style="font-size:24px;font-weight:800;letter-spacing:.12em;color:${BRAND.primary};font-family:Menlo,Consolas,monospace">${escapeHtml(b.coupon)}</div>`
      + `</td></tr></table>`;
  }
  if ("guarantee" in b) {
    return `<p style="margin:0 0 16px;font-size:12px;line-height:18px;color:${BRAND.muted};text-align:center">🔒 ${escapeHtml(GUARANTEE_TEXT)}</p>`;
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
  if ("stat" in b) return `[ ${b.stat} ] ${b.label}`;
  if ("card" in b) return (b.title ? `${b.title}\n` : "") + b.card.map(([k, v]) => `${k}: ${v}`).join("\n");
  if ("meter" in b) return b.label;
  if ("ideas" in b) return (b.title ? `${b.title}\n` : "") + b.ideas.map((i) => `✦ ${i.label}: ${i.url}`).join("\n");
  if ("compare" in b) return [b.compare.head.join(" | "), ...b.compare.rows.map((r) => r.map(plain).join(" | "))].join("\n");
  if ("coupon" in b) return `${plain(b.text)}\nCupom: ${b.coupon}`;
  if ("guarantee" in b) return GUARANTEE_TEXT;
  return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
};

/**
 * transactional: aviso de conta ou compra (rodapé padrão).
 * relationship: dicas e ofertas, com descadastro (List-Unsubscribe).
 * internal: alerta para a equipe.
 */
export type EmailKind = "transactional" | "relationship" | "internal";

export interface EmailContent {
  subject: string;
  /** Linha de prévia mostrada pela caixa de entrada ao lado do assunto. */
  preheader: string;
  /** Saudação adaptada ao perfil, antes do título. */
  greeting?: string;
  title: string;
  blocks: Block[];
  cta?: { label: string; url: string };
  /** Link secundário, discreto, abaixo do botão. */
  secondary?: { label: string; url: string };
  /** Assinatura ("Equipe SlideAI", "Rebeca, do time criativo do SlideAI"). */
  signoff?: string;
  tone?: Tone;
  /** Por que a pessoa recebeu (rodapé). */
  reason: string;
  kind?: EmailKind;
  /** Alertas internos: sem rodapé público. Mantido por compatibilidade (= kind "internal"). */
  internal?: boolean;
  /** Relacionamento: links de descadastro e de preferências. */
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}

const kindOf = (c: EmailContent): EmailKind => c.kind ?? (c.internal ? "internal" : "transactional");

const ctaHtml = (cta: { label: string; url: string }, secondary?: { label: string; url: string }) => `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 ${secondary ? "12px" : "24px"}"><tr>
<td bgcolor="${BRAND.primary}" style="border-radius:10px;background:${BRAND.primary};background-image:linear-gradient(135deg,${BRAND.primary},${BRAND.accent})">
<a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${BRAND.font};font-size:15px;font-weight:600;line-height:18px;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(cta.label)}</a>
</td></tr></table>
${secondary ? `<p style="margin:0 0 24px;font-size:14px"><a href="${escapeHtml(secondary.url)}" target="_blank" style="color:${BRAND.primary};font-weight:600;text-decoration:none">${escapeHtml(secondary.label)} →</a></p>` : ""}
<p style="margin:0 0 8px;font-size:12px;line-height:18px;color:${BRAND.muted}">Se o botão não abrir, copie este endereço no navegador:<br><a href="${escapeHtml(cta.url)}" style="color:${BRAND.primary};word-break:break-all">${escapeHtml(cta.url)}</a></p>`;

const footerLink = (label: string, path: string) =>
  `<a href="${SITE_URL}${path}" style="color:${BRAND.muted};text-decoration:underline">${label}</a>`;
const footerUrl = (label: string, url: string) =>
  `<a href="${escapeHtml(url)}" style="color:${BRAND.muted};text-decoration:underline">${label}</a>`;

const footerHtml = (c: EmailContent): string => {
  const kind = kindOf(c);
  if (kind === "internal") return escapeHtml(c.reason);
  const legal = `${footerLink("Termos de Uso", "/termos")} &nbsp;·&nbsp; ${footerLink("Privacidade", "/privacidade")} &nbsp;·&nbsp; <a href="${SITE_URL}" style="color:${BRAND.muted};text-decoration:none">slideai.com.br</a>`;
  const opt = kind === "relationship" && c.unsubscribeUrl
    ? `<br>Não quer mais receber dicas e ofertas? ${footerUrl("Descadastrar", c.unsubscribeUrl)}${c.preferencesUrl ? ` &nbsp;·&nbsp; ${footerUrl("Preferências de e-mail", c.preferencesUrl)}` : ""}<br>`
    : "";
  return `${escapeHtml(c.reason)}<br>
  Dúvidas? Responda este e-mail ou acesse a ${footerLink("Central de Ajuda", "/ajuda")}.<br>${opt}<br>
  ${legal}`;
};

export const renderLayout = (c: EmailContent): string => {
  const [t1, t2] = TONE[c.tone ?? "brand"];
  return `<!doctype html>
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
  <div style="height:4px;line-height:4px;font-size:0;background:${t1};background-image:linear-gradient(90deg,${t1},${t2})">&nbsp;</div>
  <div style="padding:32px 28px 16px">
    ${c.greeting ? `<p style="margin:0 0 8px;font-size:15px;line-height:22px;color:${BRAND.body}">${escapeHtml(c.greeting)}</p>` : ""}
    <h1 style="margin:0 0 20px;font-size:22px;line-height:30px;font-weight:700;letter-spacing:-.01em;color:${BRAND.ink}">${escapeHtml(c.title)}</h1>
    ${c.blocks.map((b) => blockHtml(b, c.tone ?? "brand")).join("\n    ")}
    ${c.cta ? ctaHtml(c.cta, c.secondary) : ""}
    ${c.signoff ? `<p style="margin:8px 0 16px;font-size:15px;line-height:22px;color:${BRAND.body};white-space:pre-line">${escapeHtml(c.signoff)}</p>` : ""}
  </div>
</td></tr>
<tr><td style="padding:24px 8px 0;font-size:12px;line-height:18px;color:${BRAND.muted};text-align:center">
  ${footerHtml(c)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
};

export const renderText = (c: EmailContent): string => {
  const kind = kindOf(c);
  return [
    ...(c.greeting ? [c.greeting, ""] : []),
    c.title,
    "",
    ...c.blocks.map((b) => blockText(b) + "\n"),
    ...(c.cta ? [`${c.cta.label}: ${c.cta.url}`] : []),
    ...(c.secondary ? [`${c.secondary.label}: ${c.secondary.url}`] : []),
    ...(c.cta || c.secondary ? [""] : []),
    ...(c.signoff ? [c.signoff, ""] : []),
    "—",
    c.reason,
    ...(kind === "internal" ? [] : [
      `Dúvidas? Responda este e-mail ou acesse a Central de Ajuda: ${SITE_URL}/ajuda`,
      ...(kind === "relationship" && c.unsubscribeUrl ? [`Descadastrar: ${c.unsubscribeUrl}`] : []),
      `SlideAI · ${SITE_URL}`,
    ]),
  ].join("\n");
};

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
