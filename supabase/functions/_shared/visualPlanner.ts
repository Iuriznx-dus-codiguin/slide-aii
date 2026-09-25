// Plano Visual (motor criativo v2) — 100% determinístico, nenhuma chamada de IA.
//
// Princípio: a IA decide só o que exige julgamento semântico (conteúdo,
// dados, intenção visual e a ESCOLHA ENTRE CANDIDATOS). Regra, estilo,
// layout, ritmo, animação e orçamento são código. Este módulo absorve e
// estende o papel de assignLayouts/accentsFor (slideComposition.ts): em vez de
// sortear um layout depois que o texto já foi escrito, ele planeja ANTES, para
// cada beat do Story Engine, que forma o slide pode ter.
//
// Para cada beat cruza: visual_intent, domain, narrative_act, densidade e
// abstração do brief e orçamento → 2-3 comandos candidatos (com render_mode e
// layouts compatíveis). Aplica o ritmo do deck:
//   • capa sempre como herói;
//   • nenhum comando repetido em sequência;
//   • no máximo 2 slides seguidos só de texto e no máximo 30% do deck assim;
//   • teto de visuais gerados por IA derivado do max_budget_usd (economia = 0);
//   • includeImages=false desliga só mídia raster; includeCharts=false só
//     visuais de dados — diagramas nativos continuam.
//
// Mesmo input → mesmo plano (desempate por hash estável do título), para que
// custo e qualidade sejam comparáveis entre gerações.

import {
  defaultIntentForAct,
  isVisualIntent,
  normalizeKeyObjects,
  type Domain,
  type NarrativeActName,
  type VisualIntent,
} from "./sceneCatalog.ts";
import {
  commandsForIntent,
  getCommand,
  needsMedia,
  VISUAL_COMMANDS,
  type VisualCommandSpec,
} from "./visualCommands.ts";
import { TEXT_ONLY_MAX_RUN, TEXT_ONLY_SHARE_CAP } from "./qualityGate.ts";
import type { BudgetMode } from "./modelRegistry.ts";

export interface PlannerBeat {
  narrative_act: NarrativeActName;
  visual_intent?: VisualIntent | string;
  key_objects?: string[];
}

export interface PlannerBrief {
  domain?: Domain;
  visual_density?: "sparse" | "balanced" | "dense";
  abstraction_degree?: number;
  minimalism_degree?: number;
}

export interface PlannerOptions {
  includeImages: boolean;
  includeCharts: boolean;
  budgetMode: BudgetMode;
  /** Teto de visuais de IA (maxAiVisualsFor). Economia força 0. */
  maxAiVisuals: number;
  /** Semente de desempate estável (normalmente o título). */
  seed?: string;
}

export type SlideRole = "cover" | "content" | "closing";

export interface SlidePlan {
  index: number;
  role: SlideRole;
  act: NarrativeActName;
  intent: VisualIntent;
  keyObjects: string[];
  /** 0-3 comandos, em ordem de preferência. Vazio = slide tipográfico. */
  candidates: string[];
  /** O plano prefere um slide tipográfico (citação, número, fechamento). */
  textFirst: boolean;
  /** Este slide reservou uma das vagas de visual gerado por IA. */
  aiVisual: boolean;
  /** Uma foto real (Pexels) está prevista. */
  photo: boolean;
}

export interface DeckPlan {
  slides: SlidePlan[];
  maxAiVisuals: number;
  aiSlots: number;
  photoSlots: number;
  textOnlyBudget: number;
}

/** Fração máxima de slides de conteúdo com foto (evita deck "banco de imagens"). */
export const PHOTO_SHARE_CAP = 0.4;

/** Hash estável (FNV-1a) → [0,1). Desempate determinístico. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** Comando cabe nas opções do usuário (imagens/gráficos) — sem olhar orçamento. */
export function allowedByOptions(spec: VisualCommandSpec, opts: Pick<PlannerOptions, "includeImages" | "includeCharts">): boolean {
  if (!spec.mvp) return false;
  if (spec.dataVisual && !opts.includeCharts) return false;
  if (needsMedia(spec) && !opts.includeImages) {
    // Sem mídia raster, só sobrevivem os híbridos cujo desenho nativo é fiel
    // (camadas/corte viram uma pilha de camadas nativa).
    return nativeFaithful(spec);
  }
  return true;
}

/** Precisa de IA de verdade (não pode ser servido por foto real). */
export const needsAi = (spec: VisualCommandSpec): boolean => needsMedia(spec) && !spec.photoEligible;

// Domínios em que as vistas técnicas (explodida, corte, raio-x) rendem mais —
// recebem as vagas de IA primeiro quando o orçamento é curto.
const TECHNICAL_DOMAINS: readonly Domain[] = ["engineering", "medical", "tech", "science", "product", "architecture"];

function scoreCommand(
  spec: VisualCommandSpec,
  intent: VisualIntent,
  brief: PlannerBrief,
  beat: PlannerBeat,
  tie: number,
  ctx: { aiBudget: boolean; timesUsed: number } = { aiBudget: false, timesUsed: 0 },
): number {
  let score = 10;
  if (spec.intents[0] === intent) score += 2;
  if (brief.domain && spec.domains?.includes(brief.domain)) score += 4;
  const abs = brief.abstraction_degree ?? 0.4;
  if (spec.abstraction === "abstract") score += abs >= 0.6 ? 3 : abs <= 0.35 ? -2 : 0;
  if (spec.abstraction === "literal") score += abs <= 0.45 ? 2 : abs >= 0.7 ? -2 : 0;
  const dense = brief.visual_density === "dense";
  const sparse = brief.visual_density === "sparse";
  if (dense && ["graph", "components", "metrics", "rows"].includes(spec.itemShape)) score += 2;
  if (sparse && ["media", "concepts", "cycle"].includes(spec.itemShape)) score += 2;
  // Nativo: custo zero, texto editável, animável.
  if (spec.renderMode === "native") score += 3;
  // Com orçamento de IA, a vista técnica de um objeto real num domínio
  // técnico é o que um diagrama nativo não consegue mostrar.
  if (ctx.aiBudget && spec.imageRecipe === "technical" && brief.domain && TECHNICAL_DOMAINS.includes(brief.domain)) score += 4;
  const objects = normalizeKeyObjects(beat.key_objects);
  if (spec.requires?.subject && needsMedia(spec) && objects.length === 0) score -= 4;
  // Variedade no deck inteiro (além da regra de não repetir em sequência).
  score -= ctx.timesUsed * 2.5;
  return score + tie;
}

/**
 * Até 3 candidatos, preferindo componentes DIFERENTES entre si — a IA escolhe
 * entre formas realmente distintas, não entre três variantes do mesmo fluxo.
 */
function pickCandidates(ranked: VisualCommandSpec[], max = 3): VisualCommandSpec[] {
  const out: VisualCommandSpec[] = [];
  for (const spec of ranked) {
    if (out.length >= max) break;
    if (!out.some((o) => o.component === spec.component)) out.push(spec);
  }
  for (const spec of ranked) {
    if (out.length >= max) break;
    if (!out.includes(spec)) out.push(spec);
  }
  return out;
}

/** Pool genérico quando a intenção não tem comando permitido. */
const GENERIC_INTENTS: VisualIntent[] = ["EXPLAIN", "SHOW_PROCESS", "COMPARE"];

/**
 * Substituto semântico quando nenhum comando da intenção é permitido (sem
 * imagens, sem gráficos, sem orçamento de IA): a intenção mais próxima que
 * um diagrama nativo consegue cumprir.
 */
const INTENT_SUBSTITUTE: Partial<Record<VisualIntent, VisualIntent>> = {
  EMPHASIZE: "CREATE_METAPHOR",
  CREATE_METAPHOR: "EXPLAIN",
  CREATE_SCENARIO: "EXPLAIN",
  SHOW_LOCATION: "EXPLAIN",
  RECONSTRUCT: "SHOW_EVOLUTION",
  REVEAL_INTERNAL: "DECOMPOSE",
  SHOW_DATA: "COMPARE",
  SHOW_SCALE: "SHOW_EVOLUTION",
};

/** Um híbrido cujo desenho nativo é fiel (camadas) dispensa a mídia. */
const nativeFaithful = (spec: VisualCommandSpec): boolean => spec.nativeComponent === "LayerStack";

export function planDeck(beats: PlannerBeat[], brief: PlannerBrief, opts: PlannerOptions): DeckPlan {
  const n = beats.length;
  const seed = opts.seed ?? "";
  const maxAi = opts.budgetMode === "economy" || !opts.includeImages ? 0 : Math.max(0, Math.floor(opts.maxAiVisuals));
  const contentCount = Math.max(0, n - 1);
  const textOnlyBudget = Math.floor(contentCount * TEXT_ONLY_SHARE_CAP);
  const photoCap = opts.includeImages ? Math.ceil(contentCount * PHOTO_SHARE_CAP) : 0;

  // ── 1) Candidatos por beat (sequencial: penaliza comando já usado) ────
  const ranked: VisualCommandSpec[][] = [];
  const usage = new Map<string, number>();
  const rank = (pool: VisualCommandSpec[], intent: VisualIntent, beat: PlannerBeat, i: number) =>
    pool
      .map((spec) => ({
        spec,
        score: scoreCommand(spec, intent, brief, beat, stableHash(`${seed}|${i}|${spec.id}`), {
          aiBudget: maxAi > 0,
          timesUsed: usage.get(spec.id) ?? 0,
        }),
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.spec);

  const slides: SlidePlan[] = beats.map((beat, i) => {
    const role: SlideRole = i === 0 ? "cover" : i === n - 1 && n > 2 ? "closing" : "content";
    const intent = isVisualIntent(beat.visual_intent) ? beat.visual_intent : defaultIntentForAct(beat.narrative_act, i);
    const keyObjects = normalizeKeyObjects(beat.key_objects);
    if (role === "cover") {
      ranked.push([]);
      return { index: i, role, act: beat.narrative_act, intent, keyObjects, candidates: [], textFirst: false, aiVisual: false, photo: opts.includeImages };
    }
    let pool = commandsForIntent(intent).filter((s) => allowedByOptions(s, opts));
    // Sem nenhuma chance de mídia de IA, comandos que só existem com IA saem
    // já aqui (a não ser que o desenho nativo seja fiel).
    if (maxAi === 0) pool = pool.filter((s) => !needsAi(s) || nativeFaithful(s));
    let sub = INTENT_SUBSTITUTE[intent];
    while (pool.length === 0 && sub) {
      pool = commandsForIntent(sub).filter((s) => allowedByOptions(s, opts) && (maxAi > 0 || !needsAi(s) || nativeFaithful(s)));
      sub = INTENT_SUBSTITUTE[sub];
    }
    if (pool.length === 0) {
      pool = VISUAL_COMMANDS.filter((s) => s.renderMode === "native" && s.intents.some((x) => GENERIC_INTENTS.includes(x)) && allowedByOptions(s, opts));
    }
    const scored = rank(pool, intent, beat, i);
    ranked.push(scored);
    const candidates = pickCandidates(scored).map((s) => s.id);
    if (candidates[0]) usage.set(candidates[0], (usage.get(candidates[0]) ?? 0) + 1);
    return {
      index: i, role, act: beat.narrative_act, intent, keyObjects,
      candidates,
      textFirst: false, aiVisual: false, photo: false,
    };
  });

  // ── 2) Slides tipográficos (dentro do teto de 30% e da sequência máxima) ─
  // Candidatos naturais: ênfase e fechamento — citação, número de impacto.
  const typographicWish = slides
    .filter((s) => s.role !== "cover" && (s.intent === "EMPHASIZE" || s.role === "closing"))
    .sort((a, b) => (a.role === "closing" ? -1 : 0) - (b.role === "closing" ? -1 : 0) || a.index - b.index);
  let textBudget = textOnlyBudget;
  // Tamanho da sequência de tipográficos que se formaria marcando o slide k.
  const runIfMarked = (k: number): number => {
    let left = 0;
    for (let j = k - 1; j >= 1 && slides[j].textFirst; j--) left++;
    let right = 0;
    for (let j = k + 1; j < n && slides[j].textFirst; j++) right++;
    return left + 1 + right;
  };
  for (const s of typographicWish) {
    if (textBudget <= 0) break;
    if (runIfMarked(s.index) > TEXT_ONLY_MAX_RUN) continue;
    s.textFirst = true;
    textBudget--;
  }

  // ── 3) Mídia: fotos reais primeiro (custo zero), depois vagas de IA ─────
  let photos = 0;
  const aiWanted: SlidePlan[] = [];
  for (const s of slides) {
    if (s.role === "cover") continue;
    const top = getCommand(s.candidates[0]);
    if (!top || !needsMedia(top)) continue;
    if (top.photoEligible && s.keyObjects.length > 0 && photos < photoCap) {
      s.photo = true;
      photos++;
      continue;
    }
    aiWanted.push(s);
  }
  // Prioridade das vagas de IA: vistas técnicas em domínios técnicos, depois
  // metáfora em briefs abstratos, depois o resto — sempre por ordem do deck.
  const priority = (s: SlidePlan): number => {
    const spec = getCommand(s.candidates[0])!;
    if (spec.imageRecipe === "technical" && brief.domain && TECHNICAL_DOMAINS.includes(brief.domain)) return 0;
    if (spec.imageRecipe === "technical") return 1;
    if (spec.id === "METAPHOR" && (brief.abstraction_degree ?? 0) >= 0.6) return 2;
    return 3;
  };
  aiWanted.sort((a, b) => priority(a) - priority(b) || a.index - b.index);
  let aiSlots = 0;
  for (const s of aiWanted) {
    if (aiSlots < maxAi) {
      s.aiVisual = true;
      aiSlots++;
      continue;
    }
    // Sem vaga: desce para o melhor candidato que não depende de IA. Um
    // híbrido com desenho nativo fiel (camadas) continua válido.
    const spec = getCommand(s.candidates[0])!;
    if (nativeFaithful(spec)) continue;
    const alternatives = ranked[s.index].filter((c) =>
      (!needsAi(c) || nativeFaithful(c)) && !(c.photoEligible && (s.keyObjects.length === 0 || photos >= photoCap)));
    const picked = pickCandidates(alternatives);
    if (picked.length) {
      s.candidates = picked.map((c) => c.id);
      const top = picked[0];
      if (top.photoEligible && needsMedia(top)) {
        s.photo = true;
        photos++;
      }
    } else {
      // Nenhuma alternativa da própria intenção: cai num nativo genérico
      // (explicar/processo/comparar) antes de aceitar slide só de texto.
      const generic = VISUAL_COMMANDS
        .filter((c) => c.renderMode === "native" && c.intents.some((x) => GENERIC_INTENTS.includes(x)) && allowedByOptions(c, opts))
        .map((spec) => ({ spec, score: scoreCommand(spec, s.intent, brief, beats[s.index], stableHash(`${seed}|${s.index}|${spec.id}`)) }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.spec);
      s.candidates = pickCandidates(generic).map((c) => c.id);
    }
  }
  // Os demais candidatos de um slide sem vaga de IA também não podem exigir IA.
  for (const s of slides) {
    if (s.role === "cover" || s.aiVisual) continue;
    s.candidates = s.candidates.filter((id) => {
      const spec = getCommand(id)!;
      if (!needsMedia(spec)) return true;
      if (nativeFaithful(spec)) return true;
      if (spec.photoEligible) return s.photo;
      return false;
    });
  }

  // ── 4) Ritmo: nenhum comando repetido em sequência ──────────────────────
  for (let i = 2; i < n; i++) {
    const prevTop = slides[i - 1].candidates[0];
    const cur = slides[i];
    if (prevTop && cur.candidates[0] === prevTop && cur.candidates.length > 1) {
      cur.candidates = [...cur.candidates.slice(1), cur.candidates[0]];
    }
  }

  return { slides, maxAiVisuals: maxAi, aiSlots, photoSlots: photos, textOnlyBudget };
}

// ────────────────────────────────────────────────────────────────
// Linhas compactas para o prompt de conteúdo
// ────────────────────────────────────────────────────────────────

/** Uma linha por slide: papel, intenção, objetos e candidatos permitidos. */
export function planLine(p: SlidePlan, beatFunction?: string, keyMessage?: string): string {
  const head = `S${p.index + 1} [${p.act}·${p.intent}]`;
  const msg = keyMessage ? ` "${keyMessage}"` : "";
  const fn = beatFunction ? ` (${beatFunction})` : "";
  const objs = p.keyObjects.length ? ` | objetos: ${p.keyObjects.join(", ")}` : "";
  // Capa só pede image_query quando o usuário quer imagens (senão são
  // tokens de saída pagos por um campo que o resolvedor descarta).
  if (p.role === "cover") return `${head}${msg}${fn} | CAPA (herói)${objs}${p.photo ? " | image_query: sim" : ""}`;
  const options = [...p.candidates, ...(p.textFirst || p.candidates.length === 0 ? ["NENHUM"] : [])];
  const photo = p.photo ? " | image_query: sim" : "";
  return `${head}${msg}${fn}${objs} | visual: ${options.join("|")}${photo}`;
}

/** Contrato compacto dos comandos que aparecem no plano (só esses). */
export function commandLegend(plan: DeckPlan): string {
  const used = new Set<string>();
  for (const s of plan.slides) for (const c of s.candidates) used.add(c);
  return [...used]
    .map((id) => getCommand(id))
    .filter((s): s is VisualCommandSpec => !!s)
    .map((s) => `- ${s.id}: ${s.contract}`)
    .join("\n");
}
