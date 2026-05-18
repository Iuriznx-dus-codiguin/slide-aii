// Configurações do Modo Desenvolvedor — persistidas no localStorage com
// sincronização cross-tab via storage events e CustomEvent local.
//
// Estimativas: Gemini Flash Image ~$0.039/img, GPT-4.1 (texto rico/slide) ~$0.022.
// Pexels = $0. A partir de UM ÚNICO controle (maxBudgetUsd) derivamos
// automaticamente o modo (economy/balanced/premium) — quanto maior o teto,
// mais a IA é usada para imagens autorais.

export type BudgetMode = "economy" | "balanced" | "premium";

export interface DevSettings {
  /** Sempre true para devs — mantido por compat. */
  enabled: boolean;
  /** Teto único por geração (USD). Todo o resto é derivado disto. */
  maxBudgetUsd: number;
  showCostOverlay: boolean;
  bypassPaywall: boolean;
}

const KEY = "slideai.devSettings";

export const DEFAULT_DEV_SETTINGS: DevSettings = {
  enabled: true,
  maxBudgetUsd: 0.30,
  showCostOverlay: true,
  bypassPaywall: true,
};

export const COSTS = {
  pexelsImage: { usd: 0, seconds: 0.5 },
  aiImage: { usd: 0.039, seconds: 3.5 },
  slideText: { usd: 0.022, seconds: 1.8 },
};

/** Deriva o modo de orçamento a partir do teto único. */
export const modeFromBudget = (usd: number): BudgetMode => {
  if (usd <= 0.15) return "economy";
  if (usd <= 0.45) return "balanced";
  return "premium";
};

export const modeLabel = (m: BudgetMode) =>
  m === "economy" ? "Economia" : m === "balanced" ? "Balanceado" : "Premium";

export const modeDescription = (m: BudgetMode) =>
  m === "economy"
    ? "100% Pexels. Sem IA de imagem. Custo de imagem zero."
    : m === "balanced"
      ? "Pexels-first com ~15% fallback IA para conceitos abstratos."
      : "Pexels-first com ~40% IA autoral em slides estratégicos.";

export const loadDevSettings = (): DevSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_DEV_SETTINGS };
    const parsed = JSON.parse(raw);
    // Migração: remove campos antigos (forcePexelsOnly, imageBudgetMode).
    const { forcePexelsOnly: _f, imageBudgetMode: _m, ...clean } = parsed ?? {};
    return { ...DEFAULT_DEV_SETTINGS, ...clean };
  } catch {
    return { ...DEFAULT_DEV_SETTINGS };
  }
};

export const saveDevSettings = (s: DevSettings) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("devsettings:changed", { detail: s }));
};

export interface CostEstimate {
  textUsd: number;
  imageUsd: number;
  totalUsd: number;
  seconds: number;
  imagesAi: number;
  imagesPexels: number;
  mode: BudgetMode;
}

export const estimateGenerationCost = (
  slidesCount: number,
  includeImages: boolean,
  modeOrBudget: BudgetMode | number,
): CostEstimate => {
  const mode: BudgetMode =
    typeof modeOrBudget === "number" ? modeFromBudget(modeOrBudget) : modeOrBudget;
  const textUsd = slidesCount * COSTS.slideText.usd;
  let imagesAi = 0;
  let imagesPexels = 0;
  if (includeImages) {
    const withImages = Math.round(slidesCount * 0.75);
    if (mode === "economy") {
      imagesPexels = withImages;
    } else if (mode === "balanced") {
      imagesAi = Math.round(withImages * 0.15);
      imagesPexels = withImages - imagesAi;
    } else {
      imagesAi = Math.round(withImages * 0.4);
      imagesPexels = withImages - imagesAi;
    }
  }
  const imageUsd = imagesAi * COSTS.aiImage.usd + imagesPexels * COSTS.pexelsImage.usd;
  const seconds =
    slidesCount * COSTS.slideText.seconds +
    imagesAi * COSTS.aiImage.seconds +
    imagesPexels * COSTS.pexelsImage.seconds;
  return { textUsd, imageUsd, totalUsd: textUsd + imageUsd, seconds, imagesAi, imagesPexels, mode };
};
