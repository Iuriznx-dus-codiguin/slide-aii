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
