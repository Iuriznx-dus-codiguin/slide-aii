// Design Intelligence Engine (Fase 4 da nova arquitetura de motores).
//
// Por que existe: antes desta mudança, TODO slide usava um de ~4 valores de
// padding fixos (p-[6%] citação, p-[5%] a maioria, p-[4%] gráfico/split de
// imagem) e um gap fixo (gap-[3%]) para grids — independente do quanto de
// conteúdo o slide realmente tinha, do tema visual da apresentação, ou de
// qualquer outro sinal. Um slide com 90 palavras de body_text e um slide com
// só um headline+stat recebiam exatamente o mesmo respiro visual.
//
// Este módulo computa esses valores dinamicamente, de forma 100%
// determinística e síncrona (nenhuma chamada de IA, ao contrário do Creative
// Director/Story Engine) a partir de dois sinais:
//   1) creative_brief.spacing (Fase 1) — a faixa PERMITIDA pelo tema
//      ("tight" | "balanced" | "generous")
//   2) a densidade real de conteúdo deste slide especificamente — dentro da
//      faixa do tema, conteúdo denso empurra para o extremo apertado (mais
//      espaço útil pro texto) e conteúdo esparso empurra para o extremo
//      generoso (evita a sensação de slide vazio perdido no centro)
//
// Integração: o resultado vira parte de containerStyle em SlideRenderer.tsx
// (padding/gap como propriedades CSS inline), que JÁ é passado para todos os
// 7 sub-componentes de slide via a prop `style` — nenhuma mudança de JSX foi
// necessária em nenhum deles (style inline tem precedência sobre a classe
// Tailwind p-[5%]/gap-[3%] existente, então a substituição é automática).

export interface CompositionSpec {
  /** Padding do container principal do slide, ex: "5.8%". */
  padding: string;
  /** Gap de grid para layouts em coluna (two-columns, image-split), ex: "3.2%". */
  gap: string;
  /** 0 (muito esparso) a 1 (muito denso) — exposto para debug/DevDashboard. */
  density: number;
}

export interface ContentDensityInput {
  headline?: string;
  subtitle?: string;
  bodyText?: string;
  bullets?: string[];
  hasChart?: boolean;
}

/** Only os campos do CreativeBrief relevantes aqui — evita acoplar a um import pesado. */
export interface SpacingBrief {
  spacing?: "tight" | "balanced" | "generous";
}

function wordCount(s?: string): number {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

/**
 * 0 (muito esparso) .. 1 (muito denso). Calibrado contra a faixa de
 * densidade que o próprio prompt de geração pede em PASSO C/D
 * (generate-presentation/index.ts): body_text de 40-90 palavras OU 3-5
 * bullets de 8-16 palavras cada — ou seja, o "centro" esperado da faixa já
 * fica perto de densidade ~0.5-0.6 por construção.
 */
export function densityScore(input: ContentDensityInput): number {
  const bulletWords = (input.bullets ?? []).reduce((sum, b) => sum + wordCount(b), 0);
  const totalWords = wordCount(input.headline) + wordCount(input.subtitle) + wordCount(input.bodyText) + bulletWords;
  const elementCount = (input.bodyText ? 1 : 0) + (input.bullets?.length ?? 0) + (input.hasChart ? 1.5 : 0);
  const raw = totalWords / 160 + elementCount / 8;
  return Math.max(0, Math.min(1, raw));
}

// Faixas em % de padding permitidas por preferência de espaçamento do tema.
const SPACING_RANGE: Record<NonNullable<SpacingBrief["spacing"]>, [number, number]> = {
  tight: [3.5, 5],
  balanced: [4.5, 6.5],
  generous: [6, 9],
};

/**
 * Calcula padding/gap para um slide específico. Nunca lança exceção e nunca
 * depende de rede — sempre resolve sincronamente, mesmo sem creative_brief
 * (cai para a faixa "balanced", equivalente ao comportamento anterior).
 */
export function computeCompositionSpec(content: ContentDensityInput, brief?: SpacingBrief | null): CompositionSpec {
  const [min, max] = SPACING_RANGE[brief?.spacing ?? "balanced"];
  const density = densityScore(content);
  // Interpolação linear dentro da faixa do tema: densidade alta → padding
  // menor (mais espaço útil); densidade baixa → padding maior.
  const padding = max - density * (max - min);
  const gap = Math.max(2, padding * 0.6);
  return {
    padding: `${padding.toFixed(1)}%`,
    gap: `${gap.toFixed(1)}%`,
    density,
  };
}
