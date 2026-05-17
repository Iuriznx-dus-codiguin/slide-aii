// Configurações do Modo Desenvolvedor — persistidas no localStorage.
// Estimativas baseadas em preços públicos (média): Gemini Flash Image ~$0.039/img,
// GPT-4.1 prompt+completion para um slide rico ~$0.02. Pexels é gratuito.

export type BudgetMode = "economy" | "balanced" | "premium";

export interface DevSettings {
  enabled: boolean;
  imageBudgetMode: BudgetMode;
  maxBudgetUsd: number; // teto por geração
  showCostOverlay: boolean;
  forcePexelsOnly: boolean;
  bypassPaywall: boolean;
}

const KEY = "slideai.devSettings";

export const DEFAULT_DEV_SETTINGS: DevSettings = {
  enabled: false,
  imageBudgetMode: "balanced",
  maxBudgetUsd: 0.5,
  showCostOverlay: true,
  forcePexelsOnly: false,
  bypassPaywall: true,
};

export const COSTS = {
  pexelsImage: { usd: 0, seconds: 0.5 },
  aiImage: { usd: 0.039, seconds: 3.5 },
  slideText: { usd: 0.022, seconds: 1.8 }, // por slide gerado (média)
};

export const loadDevSettings = (): DevSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_DEV_SETTINGS };
    return { ...DEFAULT_DEV_SETTINGS, ...JSON.parse(raw) };
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
}

export const estimateGenerationCost = (slidesCount: number, includeImages: boolean, mode: BudgetMode): CostEstimate => {
  const textUsd = slidesCount * COSTS.slideText.usd;
  let imagesAi = 0;
  let imagesPexels = 0;
  if (includeImages) {
    // ~75% dos slides costumam ter imagem.
    const withImages = Math.round(slidesCount * 0.75);
    if (mode === "economy") {
      imagesPexels = withImages;
    } else if (mode === "balanced") {
      // ~15% caem para fallback IA
      imagesAi = Math.round(withImages * 0.15);
      imagesPexels = withImages - imagesAi;
    } else {
      // premium ~40% IA (mais autoral)
      imagesAi = Math.round(withImages * 0.4);
      imagesPexels = withImages - imagesAi;
    }
  }
  const imageUsd = imagesAi * COSTS.aiImage.usd + imagesPexels * COSTS.pexelsImage.usd;
  const seconds = slidesCount * COSTS.slideText.seconds
    + imagesAi * COSTS.aiImage.seconds
    + imagesPexels * COSTS.pexelsImage.seconds;
  return {
    textUsd, imageUsd, totalUsd: textUsd + imageUsd,
    seconds, imagesAi, imagesPexels,
  };
};
