// Composição visual determinística dos slides (pós-processamento).
//
// Esta lógica vivia inline dentro do handler de generate-presentation, no meio
// de uma função de ~900 linhas, e por isso nunca teve teste: era o trecho que
// decide o modelo de página e os acentos visuais de CADA slide — ou seja, o
// que o usuário efetivamente vê. Extraída aqui, continua 100% determinística
// (nenhuma chamada de IA) e passa a ser verificável.
//
// Duas correções de comportamento vieram junto:
//
//  1) Variedade de modelo de página. A regra antiga só impedia dois layouts
//     IGUAIS consecutivos, então "image-right, two-columns, image-right,
//     two-columns…" passava batido — e a lista de fallback começava em
//     "image-right", puxando ainda mais para esse lado. Agora a checagem usa
//     uma janela dos 2 slides anteriores.
//
//  2) Menos slides "imagem + texto". image-right/image-left são os layouts em
//     que a imagem divide a tela com o texto, e o prompt os tratava como
//     "cavalo de batalha" (pedia ≥60% de slides com imagem). O resultado era
//     um deck monótono. Aqui existe um TETO explícito para esses dois: o
//     excedente é remanejado para modelos que usam o espaço de outra forma.
//     Importante: isso não remove imagens do deck — image_query continua em
//     todos os slides, e full-image/stat-highlight/data-chart seguem exibindo
//     imagem. O que muda é o ARRANJO, não a presença de imagem.

/**
 * Repertório completo de modelos de página — fonte única.
 *
 * Esta lista existia em três lugares: o enum da tool create_presentation
 * (Deno), a constante LAYOUTS do Editor (Vite) e o pool de fallback do
 * pós-processamento. Mesma armadilha dos nomes de transição: um modelo novo
 * exigia lembrar de todos, e esquecer um deixava o Editor sem a opção ou a
 * IA emitindo algo que a tela não sabe montar.
 */
export const LEGACY_SLIDE_LAYOUTS = [
  "title-only", "title-content", "two-columns", "image-right", "image-left",
  "full-image", "quote", "data-chart", "centered", "split-hero", "stat-highlight",
] as const;

/**
 * Modelos de página do motor v2 (no máximo dois novos, de propósito):
 *   • visual-hero  — o bloco visual domina, texto de apoio ao lado;
 *   • diagram-full — faixa de título e o diagrama ocupando a largura toda.
 * Ficam FORA do enum e do rodízio do motor v1 (assignLayouts valida contra
 * LEGACY_SLIDE_LAYOUTS), então o v1 continua exatamente como antes. O Editor
 * oferece todos; um slide sem bloco visual num desses modelos cai no layout
 * de texto padrão, nunca em tela vazia.
 */
export const SCENE_ONLY_LAYOUTS = ["visual-hero", "diagram-full"] as const;

export const SLIDE_LAYOUTS = [...LEGACY_SLIDE_LAYOUTS, ...SCENE_ONLY_LAYOUTS] as const;

export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

/** Modelos em que a imagem divide a tela com o texto — os "imagem + texto". */
export const SIDE_IMAGE_LAYOUTS: string[] = ["image-right", "image-left"];

/**
 * Modelos usados para preencher e remanejar. "title-only" e "split-hero"
 * ficam de fora de propósito: são modelos de abertura/divisória, não de
 * conteúdo, e entrariam no rodízio produzindo slides quase vazios.
 */
export const NON_SIDE_IMAGE_LAYOUTS = [
  "two-columns", "stat-highlight", "quote", "centered",
  "data-chart", "title-content", "full-image",
];

/** Teto de slides "imagem + texto lateral", como fração dos slides de conteúdo. */
export const SIDE_IMAGE_SHARE_CAP = 0.3;

/** Quantos slides anteriores não podem repetir o mesmo modelo. */
const REPEAT_WINDOW = 2;

export interface LayoutInput {
  /** layout_template proposto pela IA (pode vir vazio/ inválido). */
  layout?: string;
  slide_type?: string;
}

/**
 * Distribui os modelos de página respeitando a janela anti-repetição e o teto
 * de layouts de imagem lateral. O slide 0 (capa) mantém o que veio — a capa
 * tem variantes próprias (cover_variant) e não entra no rodízio.
 */
export function assignLayouts(slides: LayoutInput[]): string[] {
  const total = slides.length;
  const contentCount = Math.max(0, total - 1);
  const sideImageBudget = Math.max(1, Math.round(contentCount * SIDE_IMAGE_SHARE_CAP));

  const result: string[] = [];
  let sideImageUsed = 0;

  const repeatsRecently = (layout: string, at: number): boolean =>
    result.slice(Math.max(0, at - REPEAT_WINDOW), at).includes(layout);

  for (let i = 0; i < total; i++) {
    // Nome fora do repertório é tratado como ausente: o renderer degrada para
    // o slide de conteúdo padrão, e o Editor não teria a opção no seletor.
    const raw = slides[i].layout?.trim();
    const proposed = raw && (LEGACY_SLIDE_LAYOUTS as readonly string[]).includes(raw) ? raw : undefined;

    if (i === 0) {
      result.push(proposed || "split-hero");
      continue;
    }

    let layout = proposed || NON_SIDE_IMAGE_LAYOUTS[i % NON_SIDE_IMAGE_LAYOUTS.length];

    // Teto de imagem lateral: além do orçamento, vira outro modelo.
    if (SIDE_IMAGE_LAYOUTS.includes(layout)) {
      if (sideImageUsed >= sideImageBudget) {
        layout = pickAlternative(i, result);
      } else {
        sideImageUsed++;
      }
    }

    // Anti-repetição por janela (não só o slide imediatamente anterior).
    if (repeatsRecently(layout, i)) {
      const wasSideImage = SIDE_IMAGE_LAYOUTS.includes(layout);
      layout = pickAlternative(i, result);
      // O remanejamento devolve o crédito de imagem lateral não usado.
      if (wasSideImage) sideImageUsed--;
    }

    result.push(layout);
  }

  return result;
}

/** Primeiro modelo sem imagem lateral que não apareceu na janela recente. */
function pickAlternative(at: number, chosen: string[]): string {
  const recent = chosen.slice(Math.max(0, at - REPEAT_WINDOW), at);
  const offset = at % NON_SIDE_IMAGE_LAYOUTS.length;
  for (let k = 0; k < NON_SIDE_IMAGE_LAYOUTS.length; k++) {
    const candidate = NON_SIDE_IMAGE_LAYOUTS[(offset + k) % NON_SIDE_IMAGE_LAYOUTS.length];
    if (!recent.includes(candidate)) return candidate;
  }
  return NON_SIDE_IMAGE_LAYOUTS[offset];
}

// ────────────────────────────────────────────────────────────────
// Acentos visuais
// ────────────────────────────────────────────────────────────────
// O fallback antigo era puramente posicional — ACCENT_POOL[i % 14] mais
// ACCENT_POOL[(i+3) % 14] —, então um slide de citação e um de gráfico
// recebiam a mesma decoração só por estarem em posições vizinhas. O
// repertório de 14 acentos existe e está todo implementado no
// SlideRenderer; o que faltava era escolher por CONTEÚDO.

/** Repertório por papel do slide — espelha a tabela do PASSO E do prompt. */
const ACCENTS_BY_ROLE: Record<string, string[]> = {
  "emphasis-stat": ["animated-blob", "pulse-grid", "reactive-dots"],
  "data-reveal": ["dot-grid", "wave-form", "pulse-grid", "data-pattern"],
  "quote-spotlight": ["particle-field", "orbital-rings", "corner-brackets"],
  "section-break": ["diagonal-lines", "layered-panels"],
  "hero-impact": ["gradient-drift", "orbital-rings", "particle-field"],
  "narrative-build": ["floating-shapes", "card-stack", "layered-panels"],
  "calm-fade": ["floating-shapes", "diagonal-lines"],
};

const ACCENTS_BY_SLIDE_TYPE: Record<string, string[]> = {
  title_slide: ["gradient-drift", "orbital-rings"],
  stat: ["animated-blob", "pulse-grid", "reactive-dots"],
  data_chart: ["dot-grid", "wave-form", "data-pattern"],
  quote: ["particle-field", "orbital-rings", "corner-brackets"],
  comparison: ["card-stack", "layered-panels"],
  section_divider: ["diagonal-lines"],
  conclusion: ["animated-blob", "particle-field"],
};

/**
 * Os 14 acentos implementados no SlideRenderer (AccentLayer). Um nome que não
 * esteja aqui é descartado em vez de chegar à tela e não renderizar nada.
 */
export const ALL_VISUAL_ACCENTS = [
  "floating-shapes", "diagonal-lines", "orbital-rings", "dot-grid",
  "corner-brackets", "wave-form", "data-pattern", "animated-blob",
  "pulse-grid", "particle-field", "layered-panels", "gradient-drift",
  "reactive-dots", "card-stack",
] as const;

const ACCENT_ROTATION: readonly string[] = ALL_VISUAL_ACCENTS;

export interface AccentInput {
  slide_type?: string;
  animation_intent?: string;
  visual_accents?: unknown;
  /** Slide com imagem pede decoração mais contida para não competir. */
  hasImage?: boolean;
}

/**
 * Quantos acentos este deck usa por slide, segundo a densidade de elementos
 * definida pelo Creative Director.
 */
export function accentCountFor(elementDensity?: string): number {
  if (elementDensity === "minimal") return 1;
  if (elementDensity === "rich") return 3;
  return 2;
}

/**
 * Acentos de um slide. Respeita o que a IA mandou quando é válido; caso
 * contrário escolhe pelo papel narrativo/tipo do slide, com rotação para que
 * dois slides do mesmo tipo não fiquem idênticos.
 */
export function accentsFor(slide: AccentInput, index: number, elementDensity?: string): string[] {
  const fromAi = Array.isArray(slide.visual_accents)
    ? slide.visual_accents.filter((a): a is string => typeof a === "string" && ACCENT_ROTATION.includes(a))
    : [];
  if (fromAi.length > 0) return Array.from(new Set(fromAi)).slice(0, 3);

  const pool =
    ACCENTS_BY_ROLE[slide.animation_intent ?? ""]
    ?? ACCENTS_BY_SLIDE_TYPE[slide.slide_type ?? ""]
    ?? ACCENT_ROTATION;

  // Slide com imagem recebe no máximo 1 acento: a foto já é o peso visual.
  const wanted = slide.hasImage ? 1 : Math.min(accentCountFor(elementDensity), pool.length);

  const picked: string[] = [];
  for (let k = 0; k < wanted; k++) {
    picked.push(pool[(index + k) % pool.length]);
  }
  return Array.from(new Set(picked));
}
