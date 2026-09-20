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

import type { SlideContent, VisualAccent } from "@/components/SlideRenderer";

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
  image_style?: string;
  image_url?: string | null;
  chart?: SlideContent["chart"];
  cover_variant?: SlideContent["cover_variant"];
  visual_accents?: VisualAccent[];
  narrative_act?: SlideContent["narrative_act"];
  animation_intent?: SlideContent["animation_intent"];
  transition?: SlideContent["transition"];
  presenters_data?: unknown[];
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
  const keep = <T,>(next: T | undefined, before: T | undefined): T | undefined =>
    next ?? before;

  return {
    ...previous,
    headline: ai.headline,
    subtitle: ai.subtitle,
    body_text: ai.body_text,
    bullets: ai.bullets,
    stat_value: ai.stat_value,
    stat_label: ai.stat_label,
    quote_text: ai.quote_text,
    quote_author: ai.quote_author,
    image_query: ai.image_query,
    image_strategy: ai.image_strategy,
    image_url: keep(ai.image_url, previous?.image_url) ?? null,
    ai_image_prompt: ai.ai_image_prompt,
    chart: ai.chart,
    animation: ai.animation,
    cover_variant: keep(ai.cover_variant, previous?.cover_variant),
    visual_accents: keep(ai.visual_accents, previous?.visual_accents),
    narrative_act: keep(ai.narrative_act, previous?.narrative_act),
    animation_intent: keep(ai.animation_intent, previous?.animation_intent),
    transition: keep(ai.transition, previous?.transition),
  };
}
