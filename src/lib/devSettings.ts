// Configurações do Modo Desenvolvedor — persistidas no localStorage com
// sincronização cross-tab via storage events e CustomEvent local.
//
// Custos: vêm do registro único de modelos (supabase/functions/_shared/
// modelRegistry.ts), o mesmo usado pelas edge functions. Antes, COSTS.aiImage
// (0,039 — preço do Gemini Flash Image) estava duplicado aqui e no edge, e não
// era o custo do modelo primário; o painel mostrava um número errado.
// A partir de UM ÚNICO controle (maxBudgetUsd) derivamos o modo
// (economy/balanced/premium) e, no motor v2, o teto de visuais de IA.
import {
  COSTS as REGISTRY_COSTS,
  estimateAiImageUsd,
  estimateTextCostUsd,
  imageCostUsd,
  maxAiVisualsFor,
} from "../../supabase/functions/_shared/modelRegistry.ts";

export type BudgetMode = "economy" | "balanced" | "premium";

export interface DevSettings {
  /** Sempre true para devs — mantido por compat. */
  enabled: boolean;
  /** Teto único por geração (USD). Todo o resto é derivado disto. */
  maxBudgetUsd: number;
  showCostOverlay: boolean;
  bypassPaywall: boolean;
  /** Gera com o motor de cenas (v2) em vez do motor atual (comparação A/B). */
  engineV2: boolean;
}

const KEY = "slideai.devSettings";

export const DEFAULT_DEV_SETTINGS: DevSettings = {
  enabled: true,
  maxBudgetUsd: 0.30,
  showCostOverlay: true,
  bypassPaywall: true,
  engineV2: false,
};

export const COSTS = REGISTRY_COSTS;

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
  engine: 1 | 2 = 1,
): CostEstimate => {
  const mode: BudgetMode =
    typeof modeOrBudget === "number" ? modeFromBudget(modeOrBudget) : modeOrBudget;
  const textUsd = estimateTextCostUsd(slidesCount, engine);
  let imagesAi = 0;
  let imagesPexels = 0;
  if (includeImages) {
    if (engine === 2) {
      // Motor v2: só imagens que aparecem (invariante), teto de IA derivado do orçamento.
      const budget = typeof modeOrBudget === "number"
        ? modeOrBudget
        : mode === "premium" ? 0.9 : mode === "balanced" ? 0.3 : 0.1;
      imagesAi = Math.min(Math.round(slidesCount * 0.3), maxAiVisualsFor(budget, slidesCount, 2));
      imagesPexels = Math.round(slidesCount * 0.3);
    } else {
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
  }
  // v1: caminho legado do fetch-image (gpt-image-1-mini, qualidade low).
  // v2: primeiro modelo da cadeia técnica para o modo (Image Director).
  const aiUnit = engine === 1
    ? imageCostUsd("gpt-image-1-mini", "low", "16:9").usd
    : estimateAiImageUsd(mode === "economy" ? "balanced" : mode);
  const imageUsd = imagesAi * aiUnit + imagesPexels * COSTS.pexelsImage.usd;
  const seconds =
    slidesCount * COSTS.slideText.seconds +
    imagesAi * COSTS.aiImage.seconds +
    imagesPexels * COSTS.pexelsImage.seconds;
  return { textUsd, imageUsd, totalUsd: textUsd + imageUsd, seconds, imagesAi, imagesPexels, mode };
};
