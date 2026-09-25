// Catálogo semântico do motor de cenas (motor criativo v2).
//
// Fonte ÚNICA das listas que antes eram mantidas à mão em dois runtimes —
// o mesmo padrão de transitionNames.ts: este arquivo não importa nada além de
// outro módulo puro de _shared e não usa nenhuma API específica de Deno ou do
// navegador, então o Deno o resolve como vizinho em _shared/ e o Vite como um
// módulo TS comum. Um teste de paridade (src/test/sceneCatalogs.test.ts) falha
// se alguma ponta voltar a declarar uma cópia local.
//
// O que vive aqui:
//   • NARRATIVE_ACTS  — o Círculo Narrativo do Story Engine. Antes era
//     declarado em storyEngine.ts e, "em sincronia manual", em CinematicHUD.tsx.
//   • VISUAL_INTENTS  — a intenção visual de cada beat (o QUE o slide precisa
//     mostrar), decidida por quem já planeja a função do slide (Story Engine).
//   • DOMAINS         — os domínios dos packs da biblioteca visual, usados pelo
//     Plano Visual para afinidade de comando e pelo Image Director para estilo.

import { normalizePresentationType } from "./presentationType.ts";

/** Posição no Círculo Narrativo (Hook→Tensão→Jornada→Prova→Clímax). */
export const NARRATIVE_ACTS = ["hook", "tension", "journey", "proof", "climax"] as const;
export type NarrativeActName = (typeof NARRATIVE_ACTS)[number];

export const isNarrativeAct = (v: unknown): v is NarrativeActName =>
  typeof v === "string" && (NARRATIVE_ACTS as readonly string[]).includes(v);

/** O que o slide precisa FAZER o público enxergar — não como desenhar. */
export const VISUAL_INTENTS = [
  "EXPLAIN",
  "COMPARE",
  "DECOMPOSE",
  "SHOW_PROCESS",
  "SHOW_EVOLUTION",
  "SHOW_SCALE",
  "SHOW_RELATIONSHIP",
  "REVEAL_INTERNAL",
  "SHOW_CHANGE",
  "SHOW_HIERARCHY",
  "SHOW_DATA",
  "SHOW_LOCATION",
  "SHOW_CAUSE_EFFECT",
  "CREATE_METAPHOR",
  "CREATE_SCENARIO",
  "EMPHASIZE",
  "RECONSTRUCT",
] as const;
export type VisualIntent = (typeof VISUAL_INTENTS)[number];

export const isVisualIntent = (v: unknown): v is VisualIntent =>
  typeof v === "string" && (VISUAL_INTENTS as readonly string[]).includes(v);

/** Domínios dos packs da biblioteca visual. */
export const DOMAINS = [
  "science", "tech", "business", "marketing", "history", "geography", "education",
  "engineering", "medical", "finance", "architecture", "product", "general",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const isDomain = (v: unknown): v is Domain =>
  typeof v === "string" && (DOMAINS as readonly string[]).includes(v);

/** Tipo de apresentação (já normalizado) → domínio. É o sinal do fallback. */
const DOMAIN_BY_TYPE: Record<string, Domain> = {
  acadêmico: "education",
  científico: "science",
  escolar: "education",
  corporativo: "business",
  marketing: "marketing",
  criativo: "general",
  "pitch de negócios": "business",
};

export function domainFromType(type?: string | null): Domain {
  return DOMAIN_BY_TYPE[normalizePresentationType(type)] ?? "general";
}

// Palavras-chave do título/descrição, testadas SEM acento, do domínio mais
// específico para o mais genérico: "anatomia do coração" é medical antes de
// ser science; "funil de vendas" é marketing antes de ser business.
const DOMAIN_KEYWORDS: [Domain, RegExp][] = [
  ["medical", /\b(saude|medic\w*|doenc\w*|anatomi\w*|coracao|cardi\w*|virus|vacin\w*|hospital\w*|clinic\w*|enferm\w*|farmac\w*|cirurg\w*|health|disease|anatomy|medicine)\b/],
  ["history", /\b(histori\w*|guerra\w*|imperio\w*|revoluc\w*|medieval|antiguidade|seculo\w*|dinasti\w*|coloni\w*|history|war|empire|ancient)\b/],
  ["geography", /\b(geograf\w*|clima\w*|relevo|bioma\w*|continente\w*|paises|oceano\w*|rios|hidrograf\w*|geography|climate|biome)\b/],
  ["finance", /\b(financ\w*|invest\w*|acoes|bolsa de valores|juros|inflac\w*|orcament\w*|contab\w*|bancari\w*|finance|stock market|interest rate)\b/],
  ["marketing", /\b(marketing|branding|marca\w*|campanha\w*|redes sociais|funil|conversao|leads?|publicidade|anuncio\w*|audiencia)\b/],
  ["architecture", /\b(arquitet\w*|urbanis\w*|edificio\w*|construcao civil|interiores|architecture)\b/],
  ["engineering", /\b(engenhari\w*|mecanic\w*|motor\w*|circuito\w*|eletric\w*|eletronic\w*|maquina\w*|robo\w*|manufatura|turbina\w*|engineering)\b/],
  ["tech", /\b(tecnologi\w*|software|inteligencia artificial|ia|ai|algoritm\w*|cloud|nuvem|ciberseguranca|blockchain|internet|programac\w*|computac\w*|dados|machine learning|tech)\b/],
  ["product", /\b(produto\w*|lancamento\w*|roadmap|features?|ux|mvp|product)\b/],
  ["science", /\b(ciencia\w*|fisic\w*|quimic\w*|biolog\w*|fotossintese|atomo\w*|molecul\w*|genetic\w*|universo|astronom\w*|ecolog\w*|celula\w*|science|physics|chemistry|biology)\b/],
  ["business", /\b(negocio\w*|empresa\w*|estrategi\w*|gestao|lideranca|vendas|mercado|startup\w*|pitch|business|strategy|management)\b/],
  ["education", /\b(aula\w*|ensino|aprendizag\w*|educac\w*|escola\w*|didatic\w*|pedagog\w*|education|teaching)\b/],
];

const stripAccents = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Domínio a partir do contexto real do formulário. O título e a descrição
 * são o sinal mais forte (dizem o ASSUNTO); o tipo diz só o público. Usado
 * no fallback do Creative Director e como rede de segurança quando a IA
 * devolve um domínio fora do catálogo.
 */
export function domainFromContext(input: { type?: string | null; title?: string | null; description?: string | null }): Domain {
  const text = stripAccents(`${input.title ?? ""} ${input.description ?? ""}`);
  for (const [domain, re] of DOMAIN_KEYWORDS) {
    if (re.test(text)) return domain;
  }
  return domainFromType(input.type);
}

/**
 * Intenção visual padrão por ato narrativo — usada quando o Story Engine não
 * devolve uma intenção válida (fallback determinístico ou IA fora do enum).
 * Alterna dentro do ato para que dois beats vizinhos do mesmo ato não peçam
 * exatamente a mesma coisa.
 */
const INTENTS_BY_ACT: Record<NarrativeActName, VisualIntent[]> = {
  hook: ["EMPHASIZE", "CREATE_SCENARIO"],
  tension: ["SHOW_CAUSE_EFFECT", "COMPARE", "SHOW_CHANGE"],
  journey: ["EXPLAIN", "SHOW_PROCESS", "DECOMPOSE", "SHOW_RELATIONSHIP"],
  proof: ["SHOW_DATA", "COMPARE", "SHOW_EVOLUTION"],
  climax: ["EMPHASIZE", "CREATE_METAPHOR"],
};

export function defaultIntentForAct(act: NarrativeActName | undefined, index: number): VisualIntent {
  const pool = INTENTS_BY_ACT[act ?? "journey"] ?? INTENTS_BY_ACT.journey;
  return pool[index % pool.length];
}

/** Normaliza key_objects: 0-5 substantivos curtos, sem duplicata. */
export function normalizeKeyObjects(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    // eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
    const clean = v.replace(/[\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 40);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length === 5) break;
  }
  return out;
}
