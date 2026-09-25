// Métricas de texto compartilhadas entre o renderer (Vite) e o Quality Gate
// do servidor (Deno).
//
// `densityScore` vivia em src/lib/compositionEngine.ts (Fase 4 — Design
// Intelligence), onde calibra padding/gap. O Quality Gate do motor v2 precisa
// da MESMA régua no servidor para decidir, antes de gravar, se o texto cabe na
// caixa do layout escolhido. Movido para cá sem mudar a fórmula;
// compositionEngine.ts reexporta, então nenhum import existente muda.

export interface ContentDensityInput {
  headline?: string;
  subtitle?: string;
  bodyText?: string;
  bullets?: string[];
  hasChart?: boolean;
}

export function wordCount(s?: string | null): number {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

/**
 * 0 (muito esparso) .. 1 (muito denso). Calibrado contra a faixa de
 * densidade que o prompt de geração pede: body_text de 40-90 palavras OU 3-5
 * bullets de 8-16 palavras — o centro esperado fica perto de ~0.5-0.6.
 */
export function densityScore(input: ContentDensityInput): number {
  const bulletWords = (input.bullets ?? []).reduce((sum, b) => sum + wordCount(b), 0);
  const totalWords = wordCount(input.headline) + wordCount(input.subtitle) + wordCount(input.bodyText) + bulletWords;
  const elementCount = (input.bodyText ? 1 : 0) + (input.bullets?.length ?? 0) + (input.hasChart ? 1.5 : 0);
  const raw = totalWords / 160 + elementCount / 8;
  return Math.max(0, Math.min(1, raw));
}

// ────────────────────────────────────────────────────────────────
// Capacidade por caixa (Quality Gate)
// ────────────────────────────────────────────────────────────────

export type TextDepth = "short" | "balanced" | "long";

export interface TextCapacity {
  headlineChars: number;
  subtitleWords: number;
  bodyWords: number;
  bullets: number;
  bulletWords: number;
  /** Palavras por `detail` de item do bloco visual. */
  itemDetailWords: number;
  itemLabelChars: number;
}

// Medido nas caixas reais dos layouts em 1920×1080 com a escala tipográfica
// fixa do SceneSlide (título 3.2vw, corpo 1.25vw, itens 1.05vw). Slide com
// bloco visual cede à imagem/diagrama a maior parte da área de texto.
const BASE: Record<string, TextCapacity> = {
  text: { headlineChars: 60, subtitleWords: 18, bodyWords: 140, bullets: 5, bulletWords: 24, itemDetailWords: 0, itemLabelChars: 0 },
  "visual-hero": { headlineChars: 48, subtitleWords: 16, bodyWords: 55, bullets: 3, bulletWords: 14, itemDetailWords: 16, itemLabelChars: 32 },
  "diagram-full": { headlineChars: 56, subtitleWords: 18, bodyWords: 28, bullets: 0, bulletWords: 0, itemDetailWords: 14, itemLabelChars: 28 },
  "image-left": { headlineChars: 48, subtitleWords: 16, bodyWords: 75, bullets: 4, bulletWords: 16, itemDetailWords: 12, itemLabelChars: 26 },
  "image-right": { headlineChars: 48, subtitleWords: 16, bodyWords: 75, bullets: 4, bulletWords: 16, itemDetailWords: 12, itemLabelChars: 26 },
  "full-image": { headlineChars: 44, subtitleWords: 16, bodyWords: 40, bullets: 0, bulletWords: 0, itemDetailWords: 12, itemLabelChars: 26 },
  "title-content": { headlineChars: 56, subtitleWords: 18, bodyWords: 40, bullets: 0, bulletWords: 0, itemDetailWords: 14, itemLabelChars: 28 },
  "two-columns": { headlineChars: 48, subtitleWords: 16, bodyWords: 70, bullets: 3, bulletWords: 16, itemDetailWords: 12, itemLabelChars: 26 },
};

/** A profundidade de texto escolhida pelo usuário continua valendo: "long" ganha folga. */
const DEPTH_FACTOR: Record<TextDepth, number> = { short: 0.8, balanced: 1, long: 1.25 };

export function capacityFor(layout: string | undefined, hasVisual: boolean, itemCount = 0, depth: TextDepth = "balanced"): TextCapacity {
  const base = hasVisual ? BASE[layout ?? ""] ?? BASE["visual-hero"] : BASE.text;
  const f = DEPTH_FACTOR[depth] ?? 1;
  // Mais itens no diagrama → menos espaço por detalhe.
  const crowd = itemCount > 5 ? 0.75 : itemCount > 3 ? 0.9 : 1;
  return {
    headlineChars: base.headlineChars,
    subtitleWords: base.subtitleWords,
    bodyWords: Math.round(base.bodyWords * f),
    bullets: base.bullets,
    bulletWords: Math.round(base.bulletWords * f),
    itemDetailWords: Math.max(6, Math.round(base.itemDetailWords * f * crowd)),
    itemLabelChars: base.itemLabelChars,
  };
}

/**
 * Corta um texto em no máximo `max` palavras, preferindo fim de frase.
 * `overflow` é o que sobrou — o Quality Gate move isso para as notas do
 * orador em vez de apagar informação.
 */
export function trimToWords(text: string | undefined | null, max: number): { kept: string; overflow: string } {
  const src = (text ?? "").trim();
  if (!src) return { kept: "", overflow: "" };
  const words = src.split(/\s+/);
  if (words.length <= max) return { kept: src, overflow: "" };
  if (max <= 0) return { kept: "", overflow: src };
  const head = words.slice(0, max).join(" ");
  // Último fim de frase dentro da janela, se não descartar mais que 40% dela.
  const lastStop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "), head.endsWith(".") ? head.length - 1 : -1);
  if (lastStop > head.length * 0.6) {
    const kept = head.slice(0, lastStop + 1).trim();
    return { kept, overflow: src.slice(kept.length).trim() };
  }
  const kept = `${head.replace(/[,;:\-–—]+$/, "")}…`;
  return { kept, overflow: words.slice(max).join(" ") };
}

/** Corta um rótulo curto em caracteres, na última palavra inteira. */
export function trimChars(text: string, max: number): string {
  const s = text.trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[,;:\-–—]+$/, "")}…`;
}
