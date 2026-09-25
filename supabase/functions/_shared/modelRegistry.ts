// Registro único de modelos de IA por etapa (texto e imagem) e de custos.
//
// Antes, a escolha de modelo estava espalhada: "gpt-4.1"/"gemini-2.5-pro" no
// handler de generate-presentation, "gpt-4.1-mini"/"gemini-2.5-flash" copiado
// em creativeDirector, storyEngine, editDirector e chat-editor, e
// "gpt-image-1-mini"/"gemini-2.5-flash-image" dentro de fetch-image. E o custo
// de imagem (COSTS.aiImage = 0.039, duplicado no edge e em
// src/lib/devSettings.ts) era o preço do Gemini Flash Image, não do modelo
// primário — o painel de custos mostrava um número errado.
//
// Aqui fica: qual modelo roda em cada etapa, com qual provedor; as
// capacidades de cada modelo de imagem (transparência, tamanho livre,
// qualidades); e a tabela de preços usada para transformar o `usage` real da
// API em dólares. Módulo puro — importado pelas edge functions (Deno) e pelo
// painel dev (Vite).
//
// Preços: tabela pública de referência dos provedores (USD). Revise quando o
// provedor mudar a tabela; valores marcados `estimated` ainda não têm preço
// público confirmado e o custo real vem do `usage` devolvido pela API quando
// ele existir.

export type Provider = "openai" | "gateway";

export const AI_ENDPOINTS: Record<Provider, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  gateway: "https://ai.gateway.lovable.dev/v1/chat/completions",
};

export const IMAGE_ENDPOINTS = {
  openai: "https://api.openai.com/v1/images/generations",
  gateway: "https://ai.gateway.lovable.dev/v1/chat/completions",
} as const;

// ────────────────────────────────────────────────────────────────
// Texto
// ────────────────────────────────────────────────────────────────

export type TextStage =
  | "director" | "story" | "content" | "contentRetry"
  | "editClassify" | "editApply" | "speeches";

interface TextStageSpec {
  openai: string;
  gateway: string;
  /** Timeout da chamada. Etapas auxiliares têm teto curto e fallback determinístico. */
  timeoutMs?: number;
}

export const TEXT_STAGES: Record<TextStage, TextStageSpec> = {
  // Decisões curtas: modelo mini/flash (planejamento, não escrita rica).
  director: { openai: "gpt-4.1-mini", gateway: "google/gemini-2.5-flash", timeoutMs: 12000 },
  story: { openai: "gpt-4.1-mini", gateway: "google/gemini-2.5-flash", timeoutMs: 15000 },
  // Escrita do conteúdo: modelo principal.
  content: { openai: "gpt-4.1", gateway: "google/gemini-2.5-pro" },
  contentRetry: { openai: "gpt-4.1", gateway: "google/gemini-2.5-pro" },
  editClassify: { openai: "gpt-4.1-mini", gateway: "google/gemini-2.5-flash", timeoutMs: 12000 },
  editApply: { openai: "gpt-4.1-mini", gateway: "google/gemini-2.5-flash" },
  speeches: { openai: "gpt-4.1-mini", gateway: "google/gemini-2.5-flash" },
};

export interface TextRoute {
  provider: Provider;
  endpoint: string;
  model: string;
  authKey: string;
}

export interface ProviderKeys {
  openaiKey?: string | null;
  lovableKey?: string | null;
}

/** Rota primária: OpenAI quando há chave; senão o gateway Lovable. */
export function textRoute(stage: TextStage, keys: ProviderKeys): TextRoute | null {
  const spec = TEXT_STAGES[stage];
  if (keys.openaiKey) return { provider: "openai", endpoint: AI_ENDPOINTS.openai, model: spec.openai, authKey: keys.openaiKey };
  if (keys.lovableKey) return { provider: "gateway", endpoint: AI_ENDPOINTS.gateway, model: spec.gateway, authKey: keys.lovableKey };
  return null;
}

/** Rota de fallback (gateway) quando a primária é OpenAI e há chave do gateway. */
export function textFallbackRoute(stage: TextStage, keys: ProviderKeys): TextRoute | null {
  if (!keys.openaiKey || !keys.lovableKey) return null;
  return { provider: "gateway", endpoint: AI_ENDPOINTS.gateway, model: TEXT_STAGES[stage].gateway, authKey: keys.lovableKey };
}

/** USD por 1M de tokens. */
export const TEXT_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10 },
  "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
};

export interface TokenUsage {
  input: number;
  output: number;
}

/** Lê o `usage` de uma resposta chat/completions (OpenAI e gateway). */
export function readUsage(json: unknown): TokenUsage | null {
  const u = (json as { usage?: Record<string, unknown> } | null)?.usage;
  if (!u || typeof u !== "object") return null;
  const input = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const output = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return { input, output };
}

export function textCostUsd(model: string, usage: TokenUsage | null): number {
  if (!usage) return 0;
  const price = TEXT_PRICING[model];
  if (!price) return 0;
  return (usage.input * price.input + usage.output * price.output) / 1_000_000;
}

// ────────────────────────────────────────────────────────────────
// Imagem
// ────────────────────────────────────────────────────────────────

export type ImageQuality = "low" | "medium" | "high";
export type ImageAspect = "16:9" | "1:1";
export type BudgetMode = "economy" | "balanced" | "premium";

export type ImageModelId = "gpt-image-2.5-flare" | "gpt-image-1-mini" | "google/gemini-2.5-flash-image";

export interface ImageModelSpec {
  id: ImageModelId;
  provider: Provider;
  capabilities: {
    /** background: "transparent" (recorte real, sem retângulo branco). */
    transparent: boolean;
    /** Aceita tamanho arbitrário (16:9 nativo) em vez de só 1024²/1536×1024. */
    freeSize: boolean;
    qualities: ImageQuality[];
    /** Aceita `quality` na chamada. */
    qualityScale: boolean;
  };
  /** USD por imagem, por qualidade e proporção. */
  perImageUsd: Record<ImageQuality, Record<ImageAspect, number>>;
  /** USD por 1M tokens, quando a API devolve `usage` de imagem. */
  tokenPricing?: { textInput: number; imageInput: number; imageOutput: number };
  /** Preço ainda sem confirmação pública — o custo é estimativa. */
  estimated?: boolean;
}

export const IMAGE_MODELS: Record<ImageModelId, ImageModelSpec> = {
  // Padrão para comandos técnicos (vista explodida, corte, camadas) e
  // recortes: 16:9 nativo e fundo transparente.
  "gpt-image-2.5-flare": {
    id: "gpt-image-2.5-flare",
    provider: "openai",
    capabilities: { transparent: true, freeSize: true, qualities: ["low", "medium", "high"], qualityScale: true },
    perImageUsd: {
      low: { "16:9": 0.012, "1:1": 0.01 },
      medium: { "16:9": 0.035, "1:1": 0.028 },
      high: { "16:9": 0.12, "1:1": 0.095 },
    },
    estimated: true,
  },
  // Opção econômica (o primário até a v1).
  "gpt-image-1-mini": {
    id: "gpt-image-1-mini",
    provider: "openai",
    capabilities: { transparent: true, freeSize: false, qualities: ["low", "medium", "high"], qualityScale: true },
    perImageUsd: {
      low: { "16:9": 0.006, "1:1": 0.005 },
      medium: { "16:9": 0.015, "1:1": 0.011 },
      high: { "16:9": 0.052, "1:1": 0.036 },
    },
    tokenPricing: { textInput: 2, imageInput: 2.5, imageOutput: 8 },
  },
  // Fallback do gateway Lovable. Sem transparência nem escala de qualidade.
  "google/gemini-2.5-flash-image": {
    id: "google/gemini-2.5-flash-image",
    provider: "gateway",
    capabilities: { transparent: false, freeSize: false, qualities: ["medium"], qualityScale: false },
    perImageUsd: {
      low: { "16:9": 0.039, "1:1": 0.039 },
      medium: { "16:9": 0.039, "1:1": 0.039 },
      high: { "16:9": 0.039, "1:1": 0.039 },
    },
  },
};

export const isImageModel = (v: unknown): v is ImageModelId =>
  typeof v === "string" && v in IMAGE_MODELS;

export type ImagePurpose = "technical" | "cutout" | "illustration" | "scene" | "reconstruction";

/**
 * Cadeia de modelos de imagem para um propósito: o primeiro que responder
 * vence. Técnicos e recortes usam o modelo de maior fidelidade por padrão;
 * ilustração e cena usam o econômico no modo equilibrado. Economia não gera
 * imagem por IA (cadeia vazia).
 */
export function imageModelChain(
  purpose: ImagePurpose,
  mode: BudgetMode,
  overrides?: { primary?: string | null; economy?: string | null },
): ImageModelId[] {
  if (mode === "economy") return [];
  const primary: ImageModelId = isImageModel(overrides?.primary) ? overrides!.primary as ImageModelId : "gpt-image-2.5-flare";
  const economy: ImageModelId = isImageModel(overrides?.economy) ? overrides!.economy as ImageModelId : "gpt-image-1-mini";
  const highFidelity = purpose === "technical" || purpose === "cutout" || mode === "premium";
  const ordered: ImageModelId[] = highFidelity ? [primary, economy] : [economy, primary];
  return Array.from(new Set<ImageModelId>([...ordered, "google/gemini-2.5-flash-image"]));
}

/** Qualidade por modo: medium no equilibrado, high no premium. */
export function imageQualityFor(mode: BudgetMode): ImageQuality {
  return mode === "premium" ? "high" : mode === "economy" ? "low" : "medium";
}

/** Tamanho pedido ao provedor. 16:9 nativo só em modelos com tamanho livre. */
export function imageSizeFor(model: ImageModelId, aspect: ImageAspect): string {
  const spec = IMAGE_MODELS[model];
  if (aspect === "1:1") return "1024x1024";
  return spec.capabilities.freeSize ? "1536x864" : "1536x1024";
}

export interface ImageUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
}

/** Custo de UMA imagem: `usage` real quando existe e o modelo tem preço por token; senão, tabela por imagem. */
export function imageCostUsd(
  model: ImageModelId,
  quality: ImageQuality,
  aspect: ImageAspect,
  usage?: ImageUsage | null,
): { usd: number; estimated: boolean } {
  const spec = IMAGE_MODELS[model];
  if (usage && spec.tokenPricing && Number.isFinite(usage.output_tokens)) {
    const text = usage.input_tokens_details?.text_tokens ?? usage.input_tokens ?? 0;
    const img = usage.input_tokens_details?.image_tokens ?? 0;
    const usd = (text * spec.tokenPricing.textInput + img * spec.tokenPricing.imageInput
      + (usage.output_tokens ?? 0) * spec.tokenPricing.imageOutput) / 1_000_000;
    return { usd: +usd.toFixed(5), estimated: false };
  }
  const q = spec.capabilities.qualities.includes(quality) ? quality : spec.capabilities.qualities[0];
  return { usd: spec.perImageUsd[q][aspect], estimated: true };
}

// ────────────────────────────────────────────────────────────────
// Estimativas usadas antes da geração (teto de orçamento e painel dev)
// ────────────────────────────────────────────────────────────────

/** Tokens médios por geração, por motor (calibração: decks de 8-15 slides). */
const TEXT_PROFILE = {
  1: { fixedInput: 7500, outputPerSlide: 780 },
  2: { fixedInput: 4200, outputPerSlide: 470 },
} as const;

/** Custo estimado do texto de uma geração (direção + roteiro + conteúdo). */
export function estimateTextCostUsd(slides: number, engine: 1 | 2 = 1, withSpeeches = false): number {
  const p = TEXT_PROFILE[engine];
  const out = slides * (p.outputPerSlide + (withSpeeches ? 260 : 0));
  const main = textCostUsd(TEXT_STAGES.content.openai, { input: p.fixedInput, output: out });
  // Creative Director + Story Engine (mini), em paralelo.
  const aux = textCostUsd(TEXT_STAGES.director.openai, { input: 900, output: 450 })
    + textCostUsd(TEXT_STAGES.story.openai, { input: 700, output: slides * (engine === 2 ? 110 : 80) });
  return +(main + aux).toFixed(5);
}

/** Custo estimado de uma imagem de IA no modo pedido (primeiro modelo da cadeia técnica). */
export function estimateAiImageUsd(mode: BudgetMode): number {
  const chain = imageModelChain("technical", mode);
  if (!chain.length) return 0;
  return imageCostUsd(chain[0], imageQualityFor(mode), "16:9").usd;
}

/** Modo de orçamento a partir do teto único (mesma regra de devSettings). */
export function budgetModeFromUsd(usd: number | null | undefined, fallback: BudgetMode = "balanced"): BudgetMode {
  if (typeof usd !== "number" || !Number.isFinite(usd)) return fallback;
  if (usd <= 0.15) return "economy";
  if (usd <= 0.45) return "balanced";
  return "premium";
}

/**
 * Teto de visuais gerados por IA derivado do max_budget_usd: o que sobra do
 * orçamento depois do texto, dividido pelo custo de uma imagem no modo. O
 * modo economia não gera imagem por IA.
 */
export function maxAiVisualsFor(maxBudgetUsd: number | null | undefined, slides: number, engine: 1 | 2 = 2): number {
  const mode = budgetModeFromUsd(maxBudgetUsd);
  if (mode === "economy") return 0;
  const perImage = estimateAiImageUsd(mode);
  if (perImage <= 0) return 0;
  const budget = typeof maxBudgetUsd === "number" ? maxBudgetUsd : 0.3;
  const left = budget - estimateTextCostUsd(slides, engine);
  return Math.max(0, Math.floor(left / perImage));
}

/**
 * Custos de referência consumidos pelo painel dev (src/lib/devSettings.ts).
 * `aiImage` agora é o do modelo primário no modo equilibrado, não mais o
 * preço do Gemini Flash Image.
 */
export const COSTS = {
  pexelsImage: { usd: 0, seconds: 0.5 },
  aiImage: { usd: estimateAiImageUsd("balanced"), seconds: 6 },
  slideText: { usd: +(estimateTextCostUsd(10, 1) / 10).toFixed(5), seconds: 1.8 },
};
