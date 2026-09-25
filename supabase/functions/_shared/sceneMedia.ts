// Contrato de conteúdo do motor de cenas (v2) e a regra única de mídia.
//
// PROBLEMA QUE ESTE MÓDULO FECHA: no motor v1 o prompt pedia image_query em
// todo slide, mas o renderer só exibia imagem em 3 layouts e 2 variantes de
// capa — imagens eram buscadas (e as de IA, pagas) para nunca aparecer. A
// causa raiz era ter DUAS regras: uma no pipeline (quem pede) e outra no
// SlideRenderer/exportPptx (quem mostra).
//
// Agora existe UMA função, `slideDisplaysMedia`, usada pelo resolvedor do
// servidor (para decidir se cria o ativo) e pelo SceneSlide (para decidir se
// reserva o slot de mídia). Por construção, imagens solicitadas = imagens
// exibidas — e um teste garante que continue assim.

import { getCommand, type RenderMode } from "./visualCommands.ts";
import type { ImageRecipe } from "./imageDirector.ts";
import type { MotionSpec } from "./motionPresets.ts";
import type { SceneVisual } from "./visualBlock.ts";

export const SCENE_ENGINE_VERSION = 2 as const;

/** Sistema de fundo (camada 0 do compositor). */
export const BACKGROUND_KINDS = [
  "solid",         // cor do tema, sem ruído
  "gradient-mesh", // malha de gradiente estática
  "aurora",        // blobs com blur alto (fallback estático: gradientes radiais)
  "grain",         // sólido + grão editorial
  "grid",          // grade geométrica de 12 colunas, sutil
  "photo-duotone", // a mídia do slide em duotone com scrim
  "spotlight",     // palco com spotlight para recortes
] as const;
export type BackgroundKind = (typeof BACKGROUND_KINDS)[number];

export const isBackgroundKind = (v: unknown): v is BackgroundKind =>
  typeof v === "string" && (BACKGROUND_KINDS as readonly string[]).includes(v);

export interface SceneBackgroundSpec {
  kind: BackgroundKind;
  /** 0..1 — intensidade do efeito (blobs, grão, grade). */
  intensity?: number;
}

export type AssetSource = "pexels" | "ai";
export type AssetKind = "photo" | "cutout" | "illustration";

/**
 * Ativo pendente de um slide. Gravado junto com o slide pela geração e
 * resolvido de forma progressiva e retomável pelo Editor (fetch-image com a
 * cota da apresentação). `image_url` continua sendo o único campo de URL.
 */
export interface SlideAsset {
  status: "pending" | "ready" | "failed";
  source: AssetSource;
  kind: AssetKind;
  aspect: "16:9" | "1:1";
  /** Busca Pexels (sempre em inglês). */
  query?: string;
  /** Receita do Image Director (fonte "ai" ou fallback de uma foto). */
  recipe?: ImageRecipe;
  /** Pexels sem resultado pode cair em IA? (falso no modo economia). */
  allow_ai_fallback?: boolean;
  /** Modo de orçamento da geração — decide modelo e qualidade no fetch-image. */
  budget_mode?: "economy" | "balanced" | "premium";
  attempts?: number;
  error?: string;
}

/** Campos v2 do `slides.content`. Todos opcionais: decks antigos não têm nenhum. */
export interface SceneContentFields {
  engine_version?: typeof SCENE_ENGINE_VERSION;
  visual?: SceneVisual;
  background?: SceneBackgroundSpec;
  motion?: MotionSpec;
  /** Âncora semântica do magic move: o mesmo objeto persiste entre slides. */
  anchor_key?: string;
  asset?: SlideAsset;
}

/** Variantes de capa que EXIBEM imagem (ver CoverLayouts.renderCover). */
export const IMAGE_COVER_VARIANTS = ["split-hero", "full-bleed-image"] as const;

export interface MediaProbe {
  slide_type?: string | null;
  layout_template?: string | null;
  // Solto de propósito: recebe tanto o content tipado do front quanto o
  // jsonb cru do servidor.
  // deno-lint-ignore no-explicit-any
  content?: Record<string, any> | null;
}

export const isCoverSlide = (p: MediaProbe): boolean =>
  p.slide_type === "title_slide" || p.layout_template === "title-only" || p.layout_template === "split-hero";

export const isSceneContent = (c: MediaProbe["content"]): boolean =>
  !!c && c.engine_version === SCENE_ENGINE_VERSION;

/** Modo de desenho efetivo do bloco visual (o resolvido, ou o padrão do comando). */
export function visualRenderMode(visual: SceneVisual | undefined | null): RenderMode | null {
  if (!visual) return null;
  const spec = getCommand(visual.command);
  if (!spec) return null;
  return visual.render_mode ?? spec.renderMode;
}

/**
 * Este slide EXIBE mídia raster (foto ou imagem gerada)?
 *
 * - Capa: só as variantes que desenham imagem (sem variante, o renderer usa
 *   full-bleed quando há imagem — então também conta).
 * - Motor v2: bloco visual generated/hybrid, ou fundo "photo-duotone".
 * - Motor v1: as regras históricas do SlideRenderer (full-image e image-*).
 */
export function slideDisplaysMedia(p: MediaProbe): boolean {
  const c = p.content ?? {};
  if (isCoverSlide(p)) {
    const v = c.cover_variant;
    return !v || (IMAGE_COVER_VARIANTS as readonly string[]).includes(v);
  }
  if (isSceneContent(c)) {
    const mode = visualRenderMode(c.visual);
    if (mode && mode !== "native") return true;
    return c.background?.kind === "photo-duotone";
  }
  return p.layout_template === "image-left" || p.layout_template === "image-right" || p.layout_template === "full-image";
}

/** Proporção pedida ao provedor: recorte lateral é quadrado; o resto é 16:9 nativo. */
export function mediaAspectFor(layout: string | null | undefined, kind: AssetKind): "16:9" | "1:1" {
  if (kind === "cutout" && (layout === "image-left" || layout === "image-right" || layout === "two-columns" || layout === "visual-hero")) return "1:1";
  return "16:9";
}
