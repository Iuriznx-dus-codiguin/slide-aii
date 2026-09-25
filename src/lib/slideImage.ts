// Chamada única à edge function `fetch-image`.
//
// O mesmo corpo de requisição estava montado à mão em três lugares
// (Generate: resolução inicial das imagens e re-fetch após o chat; Editor:
// botão "Buscar / gerar imagem"), cada um com sua própria cópia do aviso de
// que omitir `style` fura o cache do Asset Intelligence e paga uma geração
// nova. Um único ponto de montagem elimina a chance de a próxima chamada
// esquecer um campo de novo.

import { supabase } from "@/integrations/supabase/client";
import type { AiSlide } from "@/lib/aiSlide";
import type { SlideAsset } from "../../supabase/functions/_shared/sceneMedia.ts";

export interface SlideImageRequest extends Pick<AiSlide, "ai_image_prompt" | "image_strategy" | "image_style"> {
  /** Query já resolvida — pode diferir de slide.image_query (desduplicação). */
  query: string;
  /** URLs já usadas no deck, para o backend não repetir a mesma foto. */
  avoidUrls?: string[];
}

/**
 * Busca (ou gera) a imagem de um slide. Devolve null em qualquer falha — a
 * ausência de imagem nunca deve derrubar a geração nem a edição.
 *
 * `style` vai SEMPRE junto: o Asset Intelligence casa assets pelo par
 * (style, prompt), e sem ele todo re-fetch erra o cache e paga geração nova.
 */
export async function fetchSlideImage(req: SlideImageRequest): Promise<string | null> {
  try {
    const { data } = await supabase.functions.invoke("fetch-image", {
      body: {
        query: req.query,
        ai_prompt: req.ai_image_prompt,
        strategy: req.image_strategy ?? "pexels",
        style: req.image_style,
        orientation: "landscape",
        ...(req.avoidUrls?.length ? { avoid_urls: req.avoidUrls } : {}),
      },
    });
    return data?.url ?? null;
  } catch (e) {
    console.warn("fetch-image falhou", e);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
// Motor v2 / persistência no servidor: ativos pendentes do slide
// ────────────────────────────────────────────────────────────────

export interface AssetFetchContext {
  /** Apresentação dona do ativo — o fetch-image consome a cota dela. */
  presentationId?: string;
  /** URLs já usadas no deck (Pexels não repete a mesma foto). */
  avoidUrls?: string[];
  /** Query já desduplicada no deck (sobrepõe asset.query). */
  query?: string;
  /** Campos legados do slide (motor v1: prompt livre + estilo). */
  legacy?: { ai_image_prompt?: string; image_style?: string; image_query?: string };
}

/**
 * Resolve UM ativo pendente. Nunca lança: devolve a URL ou null (o slide cai
 * no fallback nativo do comando).
 */
export async function fetchSlideAsset(asset: SlideAsset, ctx: AssetFetchContext = {}): Promise<string | null> {
  try {
    const { data } = await supabase.functions.invoke("fetch-image", {
      body: {
        strategy: asset.source === "ai" ? "ai" : "pexels",
        query: ctx.query ?? asset.query ?? ctx.legacy?.image_query,
        ai_prompt: ctx.legacy?.ai_image_prompt,
        style: ctx.legacy?.image_style,
        recipe: asset.recipe,
        allow_ai_fallback: asset.allow_ai_fallback !== false,
        budget_mode: asset.budget_mode,
        orientation: asset.aspect === "1:1" ? "square" : "landscape",
        ...(ctx.presentationId ? { presentation_id: ctx.presentationId } : {}),
        ...(ctx.avoidUrls?.length ? { avoid_urls: ctx.avoidUrls.slice(0, 30) } : {}),
      },
    });
    return data?.url ?? null;
  } catch (e) {
    console.warn("fetch-image (ativo) falhou", e);
    return null;
  }
}
