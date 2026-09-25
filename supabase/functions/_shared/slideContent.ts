// Conversão "slide vindo da IA" → `slides.content` (coluna jsonb).
//
// Núcleo compartilhado de src/lib/aiSlide.ts (aiSlideToContent). Com a
// persistência indo para o servidor, a mesma conversão roda na edge function
// generate-presentation (motor v1) e no front (merge do chat-editor no
// Editor). Mesmo código, mesmo resultado.
//
// `previous` é o conteúdo que já estava no slide: quando informado, campos
// ausentes na resposta da IA mantêm o valor anterior em vez de serem apagados
// — é o que impede uma edição pontual pelo chat de zerar o DNA visual
// (acentos, ato narrativo, variante de capa) e, no motor v2, o bloco visual,
// o fundo, o movimento e o ativo pendente.

type Json = Record<string, unknown>;

const keep = <T,>(next: T | undefined | null, before: T | undefined | null): T | undefined =>
  (next ?? before ?? undefined) as T | undefined;

export function aiSlideToContentCore(ai: Json, previous?: Json | null): Json {
  const prev = previous ?? {};
  const out: Json = {
    ...prev,
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
    image_url: keep(ai.image_url, prev.image_url) ?? null,
    ai_image_prompt: ai.ai_image_prompt,
    // Persistido porque o Editor precisa reenviá-lo ao trocar a imagem: sem
    // ele, a busca erra a chave de cache do Asset Intelligence (pagando uma
    // geração nova) e pode reaproveitar um asset de outro estilo visual.
    image_style: keep(ai.image_style, prev.image_style),
    chart: ai.chart,
    animation: ai.animation,
    cover_variant: keep(ai.cover_variant, prev.cover_variant),
    visual_accents: keep(ai.visual_accents, prev.visual_accents),
    narrative_act: keep(ai.narrative_act, prev.narrative_act),
    animation_intent: keep(ai.animation_intent, prev.animation_intent),
    transition: keep(ai.transition, prev.transition),
  };
  // Motor v2 — só aparecem no conteúdo quando existem (decks v1 continuam
  // com exatamente as mesmas chaves de antes).
  for (const k of ["engine_version", "visual", "background", "motion", "anchor_key", "asset"] as const) {
    const v = keep(ai[k], prev[k]);
    if (v !== undefined) out[k] = v;
    else delete out[k];
  }
  return out;
}
