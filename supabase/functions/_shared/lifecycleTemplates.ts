// Modelos dos avisos de ciclo de vida (docs/produto/plano-de-avisos-por-email.md).
//
// Cada modelo recebe a SITUAÇÃO da pessoa (LifecycleContext: perfil, plano,
// forma de pagamento, saldo, cobrança pendente…) e monta o e-mail para ela:
// saudação pelo perfil do onboarding, renovação automática × manual, link de
// pagamento certo. Código puro (sem Deno nem rede): roda no vitest e no
// scripts/email-preview.ts. O envio e a reavaliação ficam em lifecycle.ts.
import { type Block, type EmailContent, type EmailKind, SITE_URL } from "./emailTemplates.ts";
import {
  CHECKOUT_URLS, isMaxPlan, isSubscriptionPlan, maxPlanFor, type PaidPlan, PLAN_LABELS, PLAN_MONTHLY_CREDITS,
  PLAN_PRICES, SINGLE_PURCHASE_CREDITS, TYPICAL_DECK_CREDITS,
} from "./plans.ts";

// ───────────── Configuração ─────────────

/** Remetentes: avisos e compras saem da equipe; relacionamento, de uma pessoa do time. */
export const SENDERS = {
  team: "SlideAI <contato@slideai.com.br>",
  relationship: "Rebeca, do SlideAI <contato@slideai.com.br>",
};
const TEAM_SIGNOFF = "Equipe SlideAI";
const RELATIONSHIP_SIGNOFF = "Um abraço,\nRebeca, do time criativo do SlideAI";

/**
 * Cupons, só nos últimos contatos de cada sequência. Os códigos precisam
 * existir no painel da Cakto com estes percentuais.
 */
export const COUPONS = {
  /** Último e-mail para quem criou conta e nunca comprou (dia 30). */
  firstPurchase: { code: "COMECE10", percent: 10 },
  /** Último e-mail de reconquista após o fim da assinatura (dia 30). */
  winback: { code: "VOLTA20", percent: 20 },
} as const;

/**
 * Formas de pagamento com renovação automática (valor de `paymentMethod` da
 * Cakto). "pix_automatico" foi definido pelo dono; os demais apelidos cobrem
 * variações até a confirmação com um pagamento real.
 */
export const AUTO_RENEW_METHODS = ["credit_card", "pix_automatico", "pix_auto", "automatic_pix"];
export const isAutoRenewMethod = (m?: string | null): boolean =>
  !!m && AUTO_RENEW_METHODS.includes(m.toLowerCase());

// ───────────── Tipos ─────────────

export type Persona = "professor" | "estudante" | "profissional" | "criador";

export const normalizePersona = (role?: string | null): Persona | null => {
  const r = (role ?? "").trim().toLowerCase();
  return r === "professor" || r === "estudante" || r === "profissional" || r === "criador" ? r : null;
};

/** Primeiro nome "apresentável": só letras, 2+ caracteres. Senão, sem nome. */
export const firstNameOf = (fullName?: string | null, username?: string | null): string | null => {
  const pick = (raw?: string | null) => {
    const w = (raw ?? "").trim().split(/\s+/)[0] ?? "";
    if (!/^[\p{L}][\p{L}'-]{1,}$/u.test(w)) return null;
    return w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1).toLocaleLowerCase("pt-BR");
  };
  return pick(fullName) ?? pick(username);
};

export interface PendingCharge {
  kind: "pix" | "boleto";
  url: string | null;
  code?: string | null;
  expiresAt: string | null;
  amount?: number | null;
}

export interface LifecycleContext {
  firstName: string | null;
  persona: Persona | null;
  email: string;
  plan: string | null;
  subscriptionStatus: string | null;
  /** Fim do período pago (profiles.subscription_renews_at). */
  renewsAt: string | null;
  autoRenew: boolean;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  /** Próxima cobrança informada pela Cakto. */
  nextPaymentDate: string | null;
  /** Créditos utilizáveis agora (bônus + cota do mês, se a assinatura vale). */
  balance: number;
  hasPurchased: boolean;
  generations: number;
  pending?: PendingCharge | null;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}

export type LifecycleTemplate =
  | "welcome" | "nurture"
  | "purchase_single" | "subscription_created" | "subscription_upgraded"
  | "renewal_reminder" | "renewal_success" | "renewal_refused"
  | "subscription_late" | "subscription_late_followup" | "subscription_reactivated"
  | "subscription_paused" | "subscription_canceled"
  | "refund_requested" | "refund_done" | "chargeback"
  | "purchase_refused" | "pix_pending" | "boleto_pending" | "checkout_abandoned"
  | "winback" | "first_deck" | "credits_low" | "generation_refunded";

/** Relacionamento = dicas e ofertas: precisa de descadastro e respeita a preferência. */
export const RELATIONSHIP_TEMPLATES: LifecycleTemplate[] = ["nurture", "checkout_abandoned", "winback"];
export const templateKind = (t: LifecycleTemplate): EmailKind =>
  RELATIONSHIP_TEMPLATES.includes(t) ? "relationship" : "transactional";

export interface LifecycleEmail extends EmailContent {
  from: string;
}

// ───────────── Formatação ─────────────

const TZ = "America/Sao_Paulo";
export const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }) : "";
export const fmtDateLong = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "numeric", month: "long" }) : "";
const fmtInt = (n: number) => Math.max(0, Math.round(n)).toLocaleString("pt-BR");
const decks = (credits: number) => Math.floor(Math.max(0, credits) / TYPICAL_DECK_CREDITS);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const CARD_BRANDS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", master: "Mastercard", amex: "American Express", elo: "Elo",
  hipercard: "Hipercard", diners: "Diners",
};

/** "Visa final 4323", "Pix Automático", "Pix", "boleto"… */
export const paymentLabel = (ctx: Pick<LifecycleContext, "paymentMethod" | "cardBrand" | "cardLast4">): string => {
  const m = (ctx.paymentMethod ?? "").toLowerCase();
  if (m === "credit_card") {
    const brand = ctx.cardBrand ? (CARD_BRANDS[ctx.cardBrand.toLowerCase()] ?? capitalize(ctx.cardBrand)) : "Cartão";
    return ctx.cardLast4 ? `${brand} final ${ctx.cardLast4}` : `${brand === "Cartão" ? "cartão de crédito" : brand}`;
  }
  if (isAutoRenewMethod(m)) return "Pix Automático";
  if (m === "pix") return "Pix";
  if (m === "boleto") return "boleto";
  if (m === "picpay") return "PicPay";
  return "último meio de pagamento";
};

// ───────────── Voz por perfil ─────────────

const PERSONA: Record<Persona | "default", {
  next: string;
  ideas: string[];
  d5: { subject: string; title: string; steps: string[] };
}> = {
  professor: {
    next: "sua próxima aula",
    ideas: ["Aula de revisão para a prova", "Sequência didática da semana", "Apresentação para a reunião de pais"],
    d5: {
      subject: "Uma aula de revisão inteira, montada pela IA",
      title: "Do conteúdo da prova à aula pronta",
      steps: [
        "Escreva o tema e o ano da turma, por exemplo: **Revisão de frações, 6º ano**.",
        "Escolha 10 slides, profundidade **equilibrada** e ligue as **falas do apresentador**.",
        "Ajuste no editor e projete em tela cheia, ou exporte em PowerPoint para levar no pen drive.",
      ],
    },
  },
  estudante: {
    next: "seu próximo trabalho",
    ideas: ["Seminário em grupo sobre o tema da aula", "Defesa de TCC em 15 minutos", "Trabalho de história com linha do tempo"],
    d5: {
      subject: "Seminário chegando? A gente ajuda",
      title: "Seminário pronto sem virar a noite",
      steps: [
        "Escreva o tema do seminário e, se quiser, cole os tópicos que o professor pediu.",
        "Defina quantas pessoas vão apresentar: as **falas** saem divididas entre o grupo.",
        "Revise o conteúdo, ajuste o visual e compartilhe o link com o grupo.",
      ],
    },
  },
  profissional: {
    next: "sua próxima reunião",
    ideas: ["Resultados do trimestre", "Kickoff de projeto", "Proposta comercial para cliente"],
    d5: {
      subject: "Sua próxima reunião começa com um deck pronto",
      title: "Do resumo ao deck executivo",
      steps: [
        "Descreva o objetivo da reunião e os números principais.",
        "Escolha o tom **executivo**: o SlideAI monta gráficos a partir dos dados.",
        "Exporte em PowerPoint ou PDF, ou compartilhe o link antes da reunião.",
      ],
    },
  },
  criador: {
    next: "seu próximo conteúdo",
    ideas: ["Módulo do seu curso online", "Roteiro de vídeo em slides", "Mídia kit para marcas"],
    d5: {
      subject: "Do roteiro aos slides do seu curso",
      title: "Seu conteúdo, em slides que prendem a atenção",
      steps: [
        "Cole o roteiro ou os tópicos do módulo.",
        "Ligue as **falas do apresentador**: viram o texto da gravação.",
        "Grave em cima do modo apresentação ou exporte as imagens para as redes.",
      ],
    },
  },
  default: {
    next: "sua próxima apresentação",
    ideas: ["Apresentação de um projeto", "Aula ou palestra sobre um tema que você domina", "Resumo de um livro ou artigo"],
    d5: {
      subject: "Uma apresentação completa em 3 passos",
      title: "Do tema à apresentação pronta",
      steps: [
        "Descreva o tema em uma frase.",
        "Escolha o número de slides e a profundidade do texto.",
        "Ajuste no editor e apresente, compartilhe ou exporte.",
      ],
    },
  },
};

const voice = (ctx: LifecycleContext) => PERSONA[ctx.persona ?? "default"];

/** Nome para usar no meio da frase: "prof. Fernando", "Ana" ou null. */
export const callName = (ctx: Pick<LifecycleContext, "firstName" | "persona">): string | null =>
  ctx.firstName ? (ctx.persona === "professor" ? `prof. ${ctx.firstName}` : ctx.firstName) : null;

/** Saudação adaptada ao perfil escolhido no onboarding. */
export const greeting = (ctx: Pick<LifecycleContext, "firstName" | "persona">): string => {
  const n = ctx.firstName;
  if (!n) return "Olá!";
  switch (ctx.persona) {
    case "professor": return `Olá, prof. ${n}! Tudo certo?`;
    case "estudante": return `Oi, ${n}! Tudo bem por aí?`;
    case "profissional": return `Olá, ${n}, tudo bem?`;
    case "criador": return `E aí, ${n}! Tudo certo?`;
    default: return `Olá, ${n}!`;
  }
};

// ───────────── Links ─────────────

const withUtm = (url: string, campaign: string): string => {
  const u = new URL(url);
  u.searchParams.set("utm_source", "email");
  u.searchParams.set("utm_medium", "lifecycle");
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
};

const links = (campaign: string) => ({
  generate: (tema?: string) => withUtm(`${SITE_URL}/gerar${tema ? `?tema=${encodeURIComponent(tema)}` : ""}`, campaign),
  plans: () => withUtm(`${SITE_URL}/gerar?planos=1`, campaign),
  checkout: (plan: PaidPlan) => withUtm(CHECKOUT_URLS[plan], campaign),
  subscription: () => withUtm(`${SITE_URL}/perfil?tab=assinatura`, campaign),
  credits: () => withUtm(`${SITE_URL}/perfil?tab=creditos`, campaign),
  dashboard: () => withUtm(`${SITE_URL}/dashboard`, campaign),
  templates: () => withUtm(`${SITE_URL}/templates`, campaign),
  help: (slug: string) => `${SITE_URL}/ajuda/${slug}`,
});

const paidPlan = (p?: string | null): PaidPlan =>
  (p && p in CHECKOUT_URLS ? p : "mensal") as PaidPlan;
const planLabel = (p?: string | null) => PLAN_LABELS[p ?? ""] ?? "seu plano";
const planPrice = (p?: string | null) => (p && p in PLAN_PRICES ? PLAN_PRICES[p as PaidPlan] : "");

/** A Cakto identifica a compra pelo e-mail digitado no checkout. */
const sameEmailNote = (ctx: LifecycleContext): Block => ({
  note: `No pagamento, use o e-mail **${ctx.email}**: é por ele que o plano e os créditos chegam na sua conta.`,
});

const ideasBlock = (ctx: LifecycleContext, l: ReturnType<typeof links>, title = "Ideias para começar"): Block => ({
  title,
  ideas: voice(ctx).ideas.map((label) => ({ label, url: l.generate(label) })),
});

const compareBlock: Block = {
  compare: {
    head: ["Opção", "Preço", "Rende"],
    rows: [
      ["Avulso", PLAN_PRICES.single, `${fmtInt(SINGLE_PURCHASE_CREDITS)} créditos · ~${decks(SINGLE_PURCHASE_CREDITS)} apresentações`],
      ["PRO", PLAN_PRICES.mensal, `${fmtInt(PLAN_MONTHLY_CREDITS.mensal)} créditos/mês · ~${decks(PLAN_MONTHLY_CREDITS.mensal)} por mês`],
      ["MAX", PLAN_PRICES.max_mensal, `até ${fmtInt(PLAN_MONTHLY_CREDITS.max_mensal)} créditos/mês (uso justo)`],
    ],
    highlight: 1,
  },
};

const planCard = (ctx: LifecycleContext, extra: [string, string][] = []): Block => {
  const due = ctx.autoRenew && ctx.nextPaymentDate ? ctx.nextPaymentDate : ctx.renewsAt;
  const rows: [string, string][] = [["Plano", planLabel(ctx.plan)]];
  if (planPrice(ctx.plan)) rows.push(["Valor", planPrice(ctx.plan)]);
  if (isSubscriptionPlan(ctx.plan)) {
    rows.push(["Créditos", isMaxPlan(ctx.plan)
      ? `até ${fmtInt(PLAN_MONTHLY_CREDITS[ctx.plan!])} por mês (uso justo)`
      : `${fmtInt(PLAN_MONTHLY_CREDITS[ctx.plan!] ?? 0)} por mês`]);
  }
  if (due) rows.push([ctx.subscriptionStatus === "canceled" ? "Acesso até" : "Próxima renovação", fmtDateLong(due)]);
  if (ctx.paymentMethod) rows.push(["Pagamento", paymentLabel(ctx)]);
  if (isSubscriptionPlan(ctx.plan) && ctx.subscriptionStatus !== "canceled") {
    rows.push(["Renovação", ctx.autoRenew ? "Automática" : "Manual (avisamos antes)"]);
  }
  return { title: "Seu plano", card: [...rows, ...extra] };
};

/** Link para pagar a renovação manual: cobrança pendente → checkout do plano. */
const renewUrl = (ctx: LifecycleContext, l: ReturnType<typeof links>, data: Record<string, unknown>): string =>
  ctx.pending?.url ?? (typeof data.checkoutUrl === "string" ? data.checkoutUrl : null) ?? l.checkout(paidPlan(ctx.plan));

const daysPhrase = (d: number) => (d <= 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`);

// ───────────── Modelos ─────────────

type Builder = (ctx: LifecycleContext, data: Record<string, unknown>) => Omit<LifecycleEmail, "from" | "kind"> & { from?: string };

const B: Record<LifecycleTemplate, Builder> = {
  welcome: (ctx) => {
    const l = links("welcome");
    const who = callName(ctx);
    if (ctx.hasPurchased) {
      return {
        subject: `Boas-vindas ao SlideAI${who ? `, ${who}` : ""}! ✨`,
        preheader: "Sua conta está pronta e com créditos. Bora criar?",
        greeting: greeting(ctx),
        title: "Tudo pronto para criar",
        tone: "success",
        blocks: [
          { stat: `${fmtInt(ctx.balance)} créditos`, label: `disponíveis agora · ~${decks(ctx.balance)} apresentações de 10 slides` },
          { p: `A partir de um tema, o SlideAI monta o roteiro, escreve os slides, escolhe imagens e ainda prepara as falas. ${capitalize(voice(ctx).next)} pode ficar pronta em cerca de um minuto.` },
          ideasBlock(ctx, l),
        ],
        cta: { label: "Criar minha apresentação", url: l.generate() },
        signoff: TEAM_SIGNOFF,
        reason: "Você recebeu este e-mail porque criou uma conta no SlideAI.",
      };
    }
    return {
      subject: `Boas-vindas ao SlideAI${who ? `, ${who}` : ""}! ✨`,
      preheader: "Sua conta está pronta. Escolha como quer criar suas apresentações.",
      greeting: greeting(ctx),
      title: "Sua conta está pronta. Agora é com a sua criatividade.",
      blocks: [
        { p: `Que bom ter você aqui! A partir de um tema, o SlideAI monta o roteiro, escreve os slides, escolhe imagens e ainda prepara as falas. ${capitalize(voice(ctx).next)} pode ficar pronta em cerca de um minuto.` },
        { p: "**Para começar, escolha como quer usar:**" },
        compareBlock,
        { guarantee: true },
        ideasBlock(ctx, l, "Ideias para a primeira apresentação"),
        sameEmailNote(ctx),
      ],
      cta: { label: "Escolher meu plano", url: l.plans() },
      secondary: { label: `Começar com o avulso por ${PLAN_PRICES.single}`, url: l.checkout("single") },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque criou uma conta no SlideAI.",
    };
  },

  nurture: (ctx, data) => {
    const day = Number(data.day ?? 1);
    const l = links(`nurture_d${day}`);
    const who = callName(ctx);
    const v = voice(ctx);
    const base = {
      greeting: greeting(ctx),
      signoff: RELATIONSHIP_SIGNOFF,
      reason: "Você recebe estas dicas porque criou uma conta no SlideAI.",
      from: SENDERS.relationship,
    };
    switch (day) {
      case 1:
        return {
          ...base,
          subject: who ? `${capitalize(who)}, ${v.next} pode ficar pronta em 1 minuto` : `${capitalize(v.next)} pode ficar pronta em 1 minuto`,
          preheader: "Do tema aos slides, com imagens, gráficos e falas.",
          title: "Do tema aos slides em cerca de um minuto",
          blocks: [
            { p: `Passando para mostrar como é simples: você escreve o tema, e o SlideAI cuida do resto — roteiro, texto, imagens, gráficos e até o que falar em cada slide. Pensei em algumas ideias para ${v.next}:` },
            ideasBlock(ctx, l, "Escolha uma e veja acontecer"),
            { p: `Com o **avulso** (${PLAN_PRICES.single}) você recebe ${fmtInt(SINGLE_PURCHASE_CREDITS)} créditos, o suficiente para umas ${decks(SINGLE_PURCHASE_CREDITS)} apresentações, sem assinatura.` },
            sameEmailNote(ctx),
          ],
          cta: { label: `Começar com o avulso (${PLAN_PRICES.single})`, url: l.checkout("single") },
          secondary: { label: "Ver todos os planos", url: l.plans() },
        };
      case 3:
        return {
          ...base,
          subject: "Quantas apresentações cabem no seu bolso?",
          preheader: "Fiz as contas: uma apresentação de 10 slides usa 120 créditos.",
          title: "Quanto rende cada opção",
          blocks: [
            { p: `Fiz as contas para você: uma apresentação de 10 slides usa **${TYPICAL_DECK_CREDITS} créditos** (com falas do apresentador, 170).` },
            compareBlock,
            { p: `No PRO, a primeira ativação ainda vem com **bônus de 800 créditos** que não expiram. Para quem cria toda semana, é o que mais compensa.` },
            { guarantee: true },
          ],
          cta: { label: "Comparar e escolher", url: l.plans() },
          secondary: { label: `Prefiro o avulso (${PLAN_PRICES.single})`, url: l.checkout("single") },
        };
      case 5:
        return {
          ...base,
          subject: v.d5.subject,
          preheader: "Três passos, e a apresentação está pronta.",
          title: v.d5.title,
          blocks: [
            { p: "Um jeito rápido de usar o SlideAI no seu dia a dia:" },
            { steps: v.d5.steps },
            { p: "Se preferir partir de algo pronto, temos modelos para aula, seminário, reunião e curso." },
          ],
          cta: { label: "Ver modelos prontos", url: l.templates() },
          secondary: { label: `Liberar créditos (${PLAN_PRICES.single})`, url: l.checkout("single") },
        };
      case 10:
        return {
          ...base,
          subject: "Slides + o que falar em cada um: tudo pronto",
          preheader: "Falas do apresentador, PowerPoint, PDF e link para compartilhar.",
          title: "O que vem junto com cada apresentação",
          blocks: [
            { p: "Muita gente descobre depois, então resolvi contar antes:" },
            {
              list: [
                "**Falas do apresentador:** o roteiro do que dizer em cada slide, dividido entre quem vai apresentar.",
                "**Exportação:** PowerPoint, PDF e imagens, para usar onde quiser.",
                "**Link público:** apresente direto do navegador, em qualquer tela.",
                "**Edição com IA:** peça \"deixe mais curto\" ou \"troque a imagem\" e pronto.",
              ],
            },
          ],
          cta: { label: `Testar com o avulso (${PLAN_PRICES.single})`, url: l.checkout("single") },
          secondary: { label: "Ver planos", url: l.plans() },
        };
      case 15:
        return {
          ...base,
          subject: "Sem pegadinha: como funciona o pagamento",
          preheader: "Pagamento seguro, 7 dias para desistir e cancelamento quando quiser.",
          title: "Respostas rápidas antes de você decidir",
          blocks: [
            {
              list: [
                "**O pagamento é seguro:** feito pela Cakto, com cartão, Pix ou boleto.",
                "**Você tem 7 dias para desistir**, com reembolso integral.",
                "**Cancele quando quiser:** o acesso continua até o fim do período pago.",
                "**Créditos do avulso e bônus não expiram.**",
                "**Suas apresentações são suas**, mesmo depois de cancelar.",
              ],
            },
            { p: "Ficou alguma dúvida? Responda este e-mail que eu mesma respondo." },
          ],
          cta: { label: `Assinar o PRO (${PLAN_PRICES.mensal})`, url: l.checkout("mensal") },
          secondary: { label: `Ou começar pelo avulso (${PLAN_PRICES.single})`, url: l.checkout("single") },
        };
      default: {
        const c = COUPONS.firstPurchase;
        return {
          ...base,
          subject: "Ainda faz sentido pra você? (tem um presente aqui)",
          preheader: `${c.percent}% de desconto para a sua primeira compra.`,
          title: "Um presente para a sua primeira apresentação",
          blocks: [
            { p: "Faz um mês que você criou sua conta e ainda não testamos juntos. Para facilitar, separei um desconto para a sua primeira compra:" },
            { coupon: c.code, text: `**${c.percent}% de desconto** — use este cupom no checkout` },
            { p: "E se o SlideAI não for para você agora, me conta o porquê? É só responder este e-mail. Prometo que leio." },
            sameEmailNote(ctx),
          ],
          cta: { label: "Usar meu cupom", url: l.plans() },
          secondary: { label: `Avulso (${PLAN_PRICES.single})`, url: l.checkout("single") },
        };
      }
    }
  },

  purchase_single: (ctx) => {
    const l = links("purchase_single");
    return {
      subject: `${fmtInt(SINGLE_PURCHASE_CREDITS)} créditos liberados 🎉`,
      preheader: "Seus créditos já estão na conta. Bora criar?",
      greeting: greeting(ctx),
      title: "Seus créditos já estão na conta",
      tone: "success",
      blocks: [
        { stat: `${fmtInt(ctx.balance)} créditos`, label: `disponíveis agora · ~${decks(ctx.balance)} apresentações de 10 slides` },
        { p: `Pagamento confirmado! Os créditos do avulso **não expiram**: use no seu ritmo, em ${voice(ctx).next} e nas próximas.` },
        ideasBlock(ctx, l),
        { note: "O comprovante do pagamento chega pela Cakto, em um e-mail separado." },
      ],
      cta: { label: "Criar minha apresentação", url: l.generate() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque fez uma compra no SlideAI.",
    };
  },

  subscription_created: (ctx, data) => {
    const l = links("subscription_created");
    const bonus = Number(data.bonus ?? 0);
    return {
      subject: `Boas-vindas ao ${planLabel(ctx.plan)}! 🚀`,
      preheader: "Seu plano está ativo e os créditos do mês já chegaram.",
      greeting: greeting(ctx),
      title: "Seu plano está ativo",
      tone: "success",
      blocks: [
        { stat: `${fmtInt(ctx.balance)} créditos`, label: "disponíveis agora" },
        planCard(ctx, bonus > 0 ? [["Bônus de ativação", `+${fmtInt(bonus)} créditos (não expiram)`]] : []),
        { p: "A cota do plano renova a cada mês, e os créditos de bônus ficam guardados: são usados depois da cota." },
        ...(ctx.autoRenew ? [] : [{ p: `Como o pagamento foi por **${paymentLabel(ctx)}**, a renovação não é automática. Sem preocupação: avisamos 5, 3 e 1 dia antes, com o link para renovar.` } as Block]),
        ideasBlock(ctx, l),
      ],
      cta: { label: "Criar minha apresentação", url: l.generate() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque assinou um plano do SlideAI.",
    };
  },

  subscription_upgraded: (ctx) => {
    const l = links("subscription_upgraded");
    return {
      subject: `Agora você é ${planLabel(ctx.plan)} ⚡`,
      preheader: "Upgrade feito: mais créditos para criar sem parar.",
      greeting: greeting(ctx),
      title: "Upgrade feito!",
      tone: "success",
      blocks: [
        planCard(ctx),
        { p: isMaxPlan(ctx.plan)
          ? "No MAX você gera sem contar créditos, dentro do uso justo. Ideal para quem cria toda semana."
          : "Sua cota mensal foi atualizada para o novo plano." },
        { note: "O bônus de ativação é um por conta e não se repete na troca de plano." },
      ],
      cta: { label: "Criar apresentação", url: l.generate() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque mudou de plano no SlideAI.",
    };
  },

  renewal_reminder: (ctx, data) => {
    const days = Number(data.days ?? 5);
    const due = typeof data.due === "string" ? data.due : (ctx.autoRenew && ctx.nextPaymentDate) || ctx.renewsAt;
    const l = links(`renewal_d${days}`);
    const label = planLabel(ctx.plan);
    const when = daysPhrase(days);

    if (ctx.subscriptionStatus === "canceled") {
      return {
        subject: `Seu ${label} termina ${when}`,
        preheader: `Seu acesso vai até ${fmtDate(due)}. Quer continuar? Reative em um clique.`,
        greeting: greeting(ctx),
        title: `Seu plano termina ${when}`,
        tone: "warning",
        blocks: [
          { stat: days === 1 ? "Amanhã" : `${days} dias`, label: `seu ${label} vai até ${fmtDateLong(due)}` },
          { p: `Você cancelou a renovação, então o plano vale até **${fmtDateLong(due)}**. Depois disso, a cota mensal para; seu bônus e todas as suas apresentações continuam com você.` },
          { p: "Mudou de ideia? Reativar leva um minuto e você não perde o ritmo." },
          sameEmailNote(ctx),
        ],
        cta: { label: "Reativar meu plano", url: l.checkout(paidPlan(ctx.plan)) },
        signoff: TEAM_SIGNOFF,
        reason: "Você recebeu este e-mail porque tem um plano no SlideAI.",
      };
    }

    if (ctx.autoRenew) {
      return {
        subject: `Sua assinatura renova ${when}`,
        preheader: `Renovação automática no ${paymentLabel(ctx)} em ${fmtDate(due)}. Não precisa fazer nada.`,
        greeting: `${greeting(ctx)} ${days === 1 ? `Passando para lembrar que a renovação do seu ${label} é amanhã.` : `Passando apenas para lembrar que faltam ${days} dias para a renovação do seu ${label}.`}`,
        title: "Tudo certo para a renovação",
        blocks: [
          planCard(ctx),
          { p: `Não precisa fazer nada: a cobrança sai no **${paymentLabel(ctx)}** e os ${fmtInt(PLAN_MONTHLY_CREDITS[ctx.plan ?? ""] ?? 0)} créditos do novo ciclo chegam na hora.` },
          { note: "Mudou de cartão ou quer trocar de plano? Faça antes da data para não perder o ritmo." },
        ],
        cta: { label: "Ver meu plano", url: l.subscription() },
        signoff: TEAM_SIGNOFF,
        reason: "Você recebeu este e-mail porque tem uma assinatura no SlideAI.",
      };
    }

    return {
      subject: days === 1 ? `Amanhã: renove seu ${label}` : `Faltam ${days} dias para renovar seu ${label}`,
      preheader: `Seu plano vence em ${fmtDate(due)}. A renovação não é automática: o link está aqui.`,
      greeting: `${greeting(ctx)} ${days === 1 ? `Passando para lembrar que o seu ${label} vence amanhã.` : `Passando apenas para lembrar que faltam ${days} dias para o seu ${label} vencer.`}`,
      title: days === 1 ? "Seu plano vence amanhã" : `Renove até ${fmtDateLong(due)} e siga criando`,
      tone: days === 1 ? "warning" : "brand",
      blocks: [
        { stat: days === 1 ? "Amanhã" : `${days} dias`, label: `vence em ${fmtDateLong(due)}` },
        planCard(ctx),
        { p: `Como o último pagamento foi por **${paymentLabel(ctx)}**, a renovação não é automática. Renovando até ${fmtDate(due)}, os ${fmtInt(PLAN_MONTHLY_CREDITS[ctx.plan ?? ""] ?? 0)} créditos do próximo ciclo chegam na hora — e seu bônus continua guardado.` },
        sameEmailNote(ctx),
      ],
      cta: { label: ctx.pending?.kind === "pix" ? "Renovar com Pix" : "Renovar agora", url: renewUrl(ctx, l, data) },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque tem um plano no SlideAI.",
    };
  },

  renewal_success: (ctx) => {
    const l = links("renewal_success");
    const credits = PLAN_MONTHLY_CREDITS[ctx.plan ?? ""] ?? 0;
    return {
      subject: `Renovado! ${isMaxPlan(ctx.plan) ? "Seu MAX segue ativo" : `Seus ${fmtInt(credits)} créditos do mês chegaram`}`,
      preheader: "Plano renovado com sucesso. Bora para o próximo projeto?",
      greeting: greeting(ctx),
      title: "Plano renovado",
      tone: "success",
      blocks: [
        { stat: `${fmtInt(ctx.balance)} créditos`, label: "disponíveis no novo ciclo" },
        planCard(ctx),
        ideasBlock(ctx, l, `Ideias para ${voice(ctx).next}`),
      ],
      cta: { label: "Criar apresentação", url: l.generate() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque sua assinatura do SlideAI foi renovada.",
    };
  },

  renewal_refused: (ctx, data) => {
    const l = links("renewal_refused");
    const label = planLabel(ctx.plan);
    return {
      subject: "Não conseguimos renovar seu plano",
      preheader: "Acontece. Resolver leva um minuto, e seu acesso continua por enquanto.",
      greeting: ctx.firstName ? `Oi, ${callName(ctx)}.` : "Olá.",
      title: "A renovação não passou",
      tone: "danger",
      blocks: [
        { p: `A cobrança do seu **${label}** no **${paymentLabel(ctx)}** foi recusada. Acontece: limite, cartão vencido ou bloqueio do banco.` },
        { p: `${ctx.renewsAt ? `Seu acesso continua até **${fmtDateLong(ctx.renewsAt)}**. ` : ""}A Cakto tenta cobrar de novo automaticamente; se preferir resolver agora, é só atualizar o pagamento.` },
        sameEmailNote(ctx),
      ],
      cta: { label: "Atualizar pagamento", url: renewUrl(ctx, l, data) },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque tem uma assinatura no SlideAI.",
    };
  },

  subscription_late: (ctx, data) => {
    const l = links("subscription_late");
    return {
      subject: "Seu plano está em atraso",
      preheader: "Falta só regularizar o pagamento. Seu bônus e suas apresentações continuam.",
      greeting: ctx.firstName ? `Oi, ${callName(ctx)}.` : "Olá.",
      title: "Falta só regularizar o pagamento",
      tone: "danger",
      blocks: [
        { p: `O pagamento do seu **${planLabel(ctx.plan)}** ainda não foi confirmado. Enquanto isso, a cota mensal fica pausada — seu bônus e todas as suas apresentações continuam com você.` },
        { p: "Regularizando, tudo volta na hora." },
        sameEmailNote(ctx),
      ],
      cta: { label: "Regularizar agora", url: renewUrl(ctx, l, data) },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque tem uma assinatura no SlideAI.",
    };
  },

  subscription_late_followup: (ctx, data) => {
    const l = links("subscription_late_d3");
    return {
      subject: "Ainda dá tempo de manter seu plano",
      preheader: "Um minuto para regularizar e voltar a criar.",
      greeting: greeting(ctx),
      title: "Ainda dá tempo",
      tone: "warning",
      blocks: [
        { p: `Seu **${planLabel(ctx.plan)}** continua aguardando o pagamento. Assim que ele for confirmado, a cota do mês volta na hora.` },
        { p: "Se algo deu errado no pagamento, responda este e-mail que a gente ajuda." },
        sameEmailNote(ctx),
      ],
      cta: { label: "Regularizar meu plano", url: renewUrl(ctx, l, data) },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque tem uma assinatura no SlideAI.",
    };
  },

  subscription_reactivated: (ctx) => {
    const l = links("subscription_reactivated");
    return {
      subject: "Que bom ter você de volta! 💜",
      preheader: "Seu plano está ativo de novo.",
      greeting: greeting(ctx),
      title: "Plano ativo de novo",
      tone: "success",
      blocks: [
        { stat: `${fmtInt(ctx.balance)} créditos`, label: "disponíveis agora" },
        planCard(ctx),
      ],
      cta: { label: "Criar apresentação", url: l.generate() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque sua assinatura do SlideAI foi reativada.",
    };
  },

  subscription_paused: (ctx) => {
    const l = links("subscription_paused");
    return {
      subject: "Sua assinatura foi pausada",
      preheader: "Enquanto estiver pausada, a cota mensal fica suspensa.",
      greeting: greeting(ctx),
      title: "Assinatura pausada",
      blocks: [
        { p: `Seu **${planLabel(ctx.plan)}** está pausado. Enquanto isso, a cota mensal fica suspensa; seu bônus e suas apresentações continuam disponíveis.` },
        { p: "Quando retomar, avisamos por aqui." },
      ],
      cta: { label: "Ver meu plano", url: l.subscription() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque tem uma assinatura no SlideAI.",
    };
  },

  subscription_canceled: (ctx) => {
    const l = links("subscription_canceled");
    return {
      subject: "Cancelamento confirmado",
      preheader: ctx.renewsAt ? `Você continua com tudo até ${fmtDate(ctx.renewsAt)}.` : "Sua assinatura foi cancelada.",
      greeting: greeting(ctx),
      title: "Sua assinatura foi cancelada",
      blocks: [
        { p: ctx.renewsAt
          ? `Tudo certo: a renovação do seu **${planLabel(ctx.plan)}** foi cancelada. Você continua com tudo do plano até **${fmtDateLong(ctx.renewsAt)}**.`
          : `Tudo certo: a renovação do seu **${planLabel(ctx.plan)}** foi cancelada.` },
        {
          list: [
            "**Suas apresentações continuam suas**, e o link público segue funcionando.",
            "**O bônus fica guardado** e pode ser usado depois.",
            "**A cota mensal para** quando o período terminar.",
          ],
        },
        { p: "Mudou de ideia? Dá para reativar a qualquer momento." },
        { note: "Não foi você quem cancelou? Responda este e-mail agora." },
      ],
      cta: { label: "Reativar plano", url: l.checkout(paidPlan(ctx.plan)) },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque cancelou uma assinatura no SlideAI.",
    };
  },

  refund_requested: (ctx) => ({
    subject: "Recebemos seu pedido de reembolso",
    preheader: "Seu pedido já está em andamento.",
    greeting: ctx.firstName ? `Olá, ${callName(ctx)}.` : "Olá.",
    title: "Pedido de reembolso recebido",
    blocks: [
      { p: "Recebemos seu pedido de reembolso, e ele já está com a Cakto, que processa os pagamentos do SlideAI. Quando for concluído, você recebe outro e-mail." },
      {
        list: [
          "Os créditos concedidos por esse pedido são cancelados.",
          "Se for uma assinatura, ela é encerrada.",
          "No cartão, o estorno costuma aparecer em até duas faturas.",
        ],
      },
    ],
    cta: { label: "Como funciona o reembolso", url: links("refund_requested").help("reembolso") },
    signoff: TEAM_SIGNOFF,
    reason: "Você recebeu este e-mail porque pediu um reembolso no SlideAI.",
  }),

  refund_done: (ctx) => ({
    subject: "Reembolso concluído",
    preheader: "O valor foi devolvido pelo mesmo meio de pagamento.",
    greeting: ctx.firstName ? `Olá, ${callName(ctx)}.` : "Olá.",
    title: "Reembolso concluído",
    blocks: [
      { p: "Seu reembolso foi processado pela Cakto, pelo mesmo meio de pagamento. No cartão, o estorno costuma aparecer em até duas faturas." },
      { p: "Os créditos desse pedido foram retirados da conta. Sua conta continua ativa, e suas apresentações também." },
      { p: "Se quiser voltar um dia, é só escolher um plano." },
    ],
    cta: { label: "Ver planos", url: links("refund_done").plans() },
    signoff: TEAM_SIGNOFF,
    reason: "Você recebeu este e-mail porque teve um reembolso no SlideAI.",
  }),

  chargeback: (ctx) => ({
    subject: "Contestação de pagamento registrada",
    preheader: "Recebemos uma contestação de pagamento da sua conta.",
    greeting: ctx.firstName ? `Olá, ${ctx.firstName}.` : "Olá.",
    title: "Contestação de pagamento",
    tone: "warning",
    blocks: [
      { p: "Recebemos da operadora do cartão uma contestação (chargeback) de um pagamento feito na sua conta. Por isso, o plano e os créditos desse pedido foram encerrados." },
      { p: "Se você não reconhece essa contestação, ou quer resolver de outro jeito, responda este e-mail que a gente ajuda." },
    ],
    signoff: TEAM_SIGNOFF,
    reason: "Você recebeu este e-mail por causa de uma contestação de pagamento na sua conta SlideAI.",
  }),

  purchase_refused: (ctx, data) => {
    const l = links("purchase_refused");
    const url = typeof data.checkoutUrl === "string" ? data.checkoutUrl : l.plans();
    return {
      subject: "O pagamento não passou, mas dá para tentar de novo",
      preheader: "Outro cartão ou Pix resolvem em um minuto.",
      greeting: greeting(ctx),
      title: "O pagamento não foi aprovado",
      tone: "warning",
      blocks: [
        { p: "A operadora não aprovou o pagamento. Nada foi cobrado. Algumas saídas rápidas:" },
        { list: ["Tentar com **outro cartão**.", "Pagar com **Pix**: a liberação é na hora.", "Conferir o limite ou desbloquear compras online no app do banco."] },
        sameEmailNote(ctx),
      ],
      cta: { label: "Tentar de novo", url },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque tentou fazer uma compra no SlideAI.",
    };
  },

  pix_pending: (ctx) => {
    const l = links("pix_pending");
    const p = ctx.pending;
    return {
      subject: "Seu Pix está te esperando ⏳",
      preheader: "Falta só pagar para concluir seu pedido.",
      greeting: greeting(ctx),
      title: "Falta só o Pix",
      tone: "warning",
      blocks: [
        { p: "Seu pedido está pronto: assim que o Pix for pago, a confirmação é na hora, e o plano ou os créditos já ficam liberados na sua conta." },
        ...(p?.code ? [{ quote: p.code, label: "Pix copia e cola" } as Block] : []),
        ...(p?.expiresAt ? [{ note: `O código vale até ${new Date(p.expiresAt).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })} de ${fmtDate(p.expiresAt)}. Depois disso, é só gerar outro no checkout.` } as Block] : []),
      ],
      cta: { label: "Pagar com Pix", url: p?.url ?? l.plans() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque gerou um Pix no SlideAI.",
    };
  },

  boleto_pending: (ctx) => {
    const l = links("boleto_pending");
    const p = ctx.pending;
    const due = p?.expiresAt;
    return {
      subject: due ? `Seu boleto vence em ${fmtDate(due)}` : "Seu boleto está aguardando pagamento",
      preheader: "Pague até o vencimento para liberar seu plano.",
      greeting: greeting(ctx),
      title: "Seu boleto está aguardando",
      tone: "warning",
      blocks: [
        { p: "Assim que o boleto for compensado, o plano ou os créditos ficam liberados na sua conta. A compensação leva até 3 dias úteis." },
        { note: "Quer liberar na hora? No checkout dá para trocar por Pix." },
      ],
      cta: { label: "Abrir boleto", url: p?.url ?? l.plans() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque gerou um boleto no SlideAI.",
    };
  },

  checkout_abandoned: (ctx, data) => {
    const l = links("checkout_abandoned");
    const url = typeof data.checkoutUrl === "string" ? data.checkoutUrl : l.plans();
    return {
      subject: "Ficou alguma dúvida?",
      preheader: "Vi que você começou e não terminou. Posso ajudar?",
      greeting: greeting(ctx),
      title: "Seu plano ficou pela metade",
      blocks: [
        { p: "Vi que você começou a compra no SlideAI e não terminou. Se ficou alguma dúvida — preço, forma de pagamento, como funcionam os créditos —, é só responder este e-mail. Eu leio e respondo." },
        { guarantee: true },
        sameEmailNote(ctx),
      ],
      cta: { label: "Continuar de onde parei", url },
      signoff: RELATIONSHIP_SIGNOFF,
      reason: "Você recebe este e-mail porque começou uma compra no SlideAI.",
      from: SENDERS.relationship,
    };
  },

  winback: (ctx, data) => {
    const day = Number(data.day ?? 7);
    const prev = typeof data.previous_plan === "string" ? data.previous_plan : ctx.plan;
    const l = links(`winback_d${day}`);
    const base = {
      greeting: greeting(ctx),
      signoff: RELATIONSHIP_SIGNOFF,
      reason: "Você recebe este e-mail porque já foi assinante do SlideAI.",
      from: SENDERS.relationship,
    };
    if (day >= 30) {
      const c = COUPONS.winback;
      return {
        ...base,
        subject: `Um presente para você voltar: ${c.percent}% off`,
        preheader: "Separei um desconto especial para você retomar.",
        title: "Que tal voltar a criar?",
        blocks: [
          { p: `Faz um mês que seu ${planLabel(prev)} terminou. Suas apresentações continuam aqui, esperando as próximas. Para facilitar a volta:` },
          { coupon: c.code, text: `**${c.percent}% de desconto** — use este cupom no checkout` },
          ideasBlock(ctx, l, "Para recomeçar"),
          sameEmailNote(ctx),
        ],
        cta: { label: "Voltar com desconto", url: l.checkout(paidPlan(prev)) },
        secondary: { label: "Ver outros planos", url: l.plans() },
      };
    }
    return {
      ...base,
      subject: "Sentimos sua falta por aqui",
      preheader: "Suas apresentações continuam guardadas.",
      title: "Suas apresentações continuam aqui",
      blocks: [
        { p: `Seu ${planLabel(prev)} terminou há uma semana. Tudo o que você criou continua salvo, e o seu bônus também.` },
        ideasBlock(ctx, l, "Algumas ideias para a próxima"),
      ],
      cta: { label: "Reativar meu plano", url: l.checkout(paidPlan(prev)) },
      secondary: { label: "Ver planos", url: l.plans() },
    };
  },

  first_deck: (ctx, data) => {
    const l = links("first_deck");
    const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : null;
    return {
      subject: "Sua primeira apresentação ficou pronta! 🎉",
      preheader: "Veja o que dá para fazer com ela agora.",
      greeting: greeting(ctx),
      title: title ? `"${title}" está pronta` : "Sua primeira apresentação está pronta",
      tone: "success",
      blocks: [
        { p: "Parabéns pela primeira! Agora dá para:" },
        {
          list: [
            "**Apresentar em tela cheia**, direto do navegador.",
            "**Compartilhar o link** com a turma, o grupo ou o cliente.",
            "**Exportar** em PowerPoint ou PDF.",
            "**Pedir ajustes à IA:** \"deixe mais curto\", \"troque a imagem do slide 3\".",
          ],
        },
      ],
      cta: { label: "Abrir minhas apresentações", url: l.dashboard() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque criou sua primeira apresentação no SlideAI.",
    };
  },

  credits_low: (ctx) => {
    const l = links("credits_low");
    const subscriber = isSubscriptionPlan(ctx.plan) && ctx.subscriptionStatus !== "canceled";
    const due = (ctx.autoRenew && ctx.nextPaymentDate) || ctx.renewsAt;
    return {
      subject: "Seus créditos estão acabando",
      preheader: `Restam ${fmtInt(ctx.balance)} créditos na sua conta.`,
      greeting: greeting(ctx),
      title: "Seus créditos estão acabando",
      tone: "warning",
      blocks: [
        { meter: ctx.balance, max: TYPICAL_DECK_CREDITS, label: `Restam ${fmtInt(ctx.balance)} créditos · uma apresentação de 10 slides usa ${TYPICAL_DECK_CREDITS}` },
        subscriber
          ? { p: `Sua cota renova${due ? ` em **${fmtDateLong(due)}**` : " no próximo ciclo"}. Precisa de mais antes disso? Dá para comprar créditos avulsos ou passar para o MAX.` }
          : { p: `Para não parar no meio de ${voice(ctx).next}, garanta mais créditos. No PRO são ${fmtInt(PLAN_MONTHLY_CREDITS.mensal)} por mês, mais bônus na primeira ativação.` },
        sameEmailNote(ctx),
      ],
      cta: subscriber
        ? { label: `Comprar ${fmtInt(SINGLE_PURCHASE_CREDITS)} créditos (${PLAN_PRICES.single})`, url: l.checkout("single") }
        : { label: `Assinar o PRO (${PLAN_PRICES.mensal})`, url: l.checkout("mensal") },
      secondary: subscriber
        ? { label: "Conhecer o MAX", url: l.checkout(maxPlanFor(ctx.plan)) }
        : { label: `Ou mais um avulso (${PLAN_PRICES.single})`, url: l.checkout("single") },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque seu saldo de créditos no SlideAI está baixo.",
    };
  },

  generation_refunded: (ctx, data) => {
    const l = links("generation_refunded");
    const credits = Number(data.credits ?? 0);
    return {
      subject: "Tivemos um problema, e seus créditos voltaram",
      preheader: `${fmtInt(credits)} créditos devolvidos ao seu saldo.`,
      greeting: greeting(ctx),
      title: "Seus créditos voltaram",
      blocks: [
        { p: `Uma geração sua foi interrompida sem resposta por um problema nosso. Os **${fmtInt(credits)} créditos** daquela tentativa já voltaram para o seu saldo.` },
        { p: "Desculpe o transtorno. Pode tentar de novo quando quiser." },
      ],
      cta: { label: "Tentar de novo", url: l.generate() },
      secondary: { label: "Ver extrato de créditos", url: l.credits() },
      signoff: TEAM_SIGNOFF,
      reason: "Você recebeu este e-mail porque uma geração da sua conta foi estornada.",
    };
  },
};

export const LIFECYCLE_TEMPLATES = Object.keys(B) as LifecycleTemplate[];

/** Monta o e-mail para a situação da pessoa. */
export const buildLifecycleEmail = (
  template: LifecycleTemplate,
  ctx: LifecycleContext,
  data: Record<string, unknown> = {},
): LifecycleEmail => {
  const built = B[template](ctx, data);
  const kind = templateKind(template);
  return {
    ...built,
    kind,
    from: built.from ?? SENDERS.team,
    unsubscribeUrl: kind === "relationship" ? ctx.unsubscribeUrl : undefined,
    preferencesUrl: kind === "relationship" ? ctx.preferencesUrl : undefined,
  };
};
