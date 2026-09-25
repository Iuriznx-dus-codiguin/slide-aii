// Conversão "slide vindo da IA" → `slides.content` (coluna jsonb).
//
// Esta mesma lista de ~19 campos estava escrita duas vezes: em
// Generate.tsx (persistAndOpenWith, ao salvar a apresentação recém-gerada) e
// em Editor.tsx (sendChat, ao aplicar o resultado do chat-editor). As duas
// cópias já haviam divergido — só a do Editor preservava cover_variant do
// slide anterior —, e qualquer campo novo precisava ser lembrado nos dois
// lugares.
//
// A única diferença real entre os dois usos é o fallback: o Editor mantém o
// valor anterior quando a IA não devolve o campo, a geração inicial não tem
// valor anterior nenhum. Isso vira o parâmetro opcional `previous`.

import type { ImageStyle, SlideContent, VisualAccent } from "@/components/SlideRenderer";
import { aiSlideToContentCore } from "../../supabase/functions/_shared/slideContent.ts";
import type { SceneContentFields } from "../../supabase/functions/_shared/sceneMedia.ts";

/** Slide como a IA devolve (generate-presentation / chat-editor). */
export interface AiSlide {
  slide_title?: string;
  slide_type?: string;
  layout_template?: string;
  animation?: string;
  headline?: string;
  subtitle?: string;
  body_text?: string;
  bullets?: string[];
  stat_value?: string;
  stat_label?: string;
  quote_text?: string;
  quote_author?: string;
  speaker_notes?: string;
  image_query?: string;
  image_strategy?: "pexels" | "ai" | "none";
  ai_image_prompt?: string;
  image_style?: ImageStyle;
  image_url?: string | null;
  chart?: SlideContent["chart"];
  cover_variant?: SlideContent["cover_variant"];
  visual_accents?: VisualAccent[];
  narrative_act?: SlideContent["narrative_act"];
  animation_intent?: SlideContent["animation_intent"];
  transition?: SlideContent["transition"];
  presenters_data?: unknown[];
  // Motor v2 (opcionais — decks antigos não têm).
  engine_version?: SceneContentFields["engine_version"];
  visual?: SceneContentFields["visual"];
  background?: SceneContentFields["background"];
  motion?: SceneContentFields["motion"];
  anchor_key?: string;
  asset?: SceneContentFields["asset"];
}

/**
 * Monta o `content` persistido a partir do slide da IA.
 *
 * `previous` é o conteúdo que já estava no slide: quando informado, campos
 * ausentes na resposta da IA mantêm o valor anterior em vez de serem
 * apagados — é o que impede uma edição pontual pelo chat de zerar o DNA
 * visual (acentos, ato narrativo, variante de capa) do slide.
 */
export function aiSlideToContent(ai: AiSlide, previous?: SlideContent): SlideContent {
  // Núcleo compartilhado com a edge function (persistência no servidor).
  return aiSlideToContentCore(
    ai as unknown as Record<string, unknown>,
    previous as unknown as Record<string, unknown> | undefined,
  ) as unknown as SlideContent;
}
