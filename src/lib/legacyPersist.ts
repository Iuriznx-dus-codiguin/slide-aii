// Caminho LEGADO de persistência no cliente.
//
// Desde a reestruturação do motor, generate-presentation grava o deck no
// servidor e devolve o slug (o cliente só navega para o Editor). Este módulo
// existe apenas para a janela de rollout em que o front novo pode falar com
// uma edge function ainda antiga (resposta com `slides` e sem `slug`).
//
// Corrige, também aqui, o bug do brief nulo: o creative_brief vem da resposta
// da geração passada como argumento — antes era lido do estado React que
// setCreativeBrief tinha acabado de atualizar na mesma execução (valor antigo).
import { supabase } from "@/integrations/supabase/client";
import { aiSlideToContent, type AiSlide } from "@/lib/aiSlide";
import { fetchSlideImage } from "@/lib/slideImage";
import { generateSlug } from "@/lib/slugify";

export interface LegacyForm {
  userId: string;
  title: string;
  description: string;
  type: string;
  language: string;
  theme: string;
  fontStyle: string;
  persona: string;
  textDepth: string;
  presentersCount: number;
  presentersNames: string[];
  includeSpeeches: boolean;
  includeImages: boolean;
}

export interface LegacyResponse {
  slides: AiSlide[];
  dynamic_theme?: unknown;
  creative_brief?: unknown;
}

/** Resolve as imagens (concorrência 5, sem repetir foto/query) — comportamento antigo. */
async function resolveImages(slidesList: AiSlide[], onProgress?: (done: number, total: number) => void): Promise<AiSlide[]> {
  const usedUrls = new Set<string>();
  const usedQueries = new Set<string>();
  const result: AiSlide[] = new Array(slidesList.length);
  const reserved = slidesList.map((s, i) => {
    if (!s.image_strategy || s.image_strategy === "none" || !s.image_query) return null;
    let q = s.image_query;
    if (usedQueries.has(q.toLowerCase())) {
      const suffixes = ["wide angle", "close up", "different perspective", "alternative", "minimal", "cinematic"];
      q = `${q} ${suffixes[i % suffixes.length]}`;
    }
    usedQueries.add(q.toLowerCase());
    return q;
  });
  let done = 0;
  const total = reserved.filter(Boolean).length;
  const queue = slidesList.map((_, i) => i);
  const worker = async () => {
    while (queue.length) {
      const i = queue.shift();
      if (i === undefined) return;
      const s = slidesList[i];
      result[i] = s;
      const q = reserved[i];
      if (!q) continue;
      try {
        let url = await fetchSlideImage({
          query: q, ai_image_prompt: s.ai_image_prompt, image_strategy: s.image_strategy, image_style: s.image_style,
          avoidUrls: Array.from(usedUrls),
        });
        if (url && usedUrls.has(url)) url = null;
        if (url) usedUrls.add(url);
        result[i] = { ...s, image_url: url };
      } finally {
        done += 1;
        onProgress?.(done, total);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));
  return result;
}

/** Grava a apresentação gerada (caminho legado) e devolve o slug. */
export async function persistLegacyDeck(form: LegacyForm, data: LegacyResponse, fontId: string, onProgress?: (done: number, total: number) => void): Promise<string> {
  const slides = form.includeImages ? await resolveImages(data.slides, onProgress) : data.slides;
  const slug = generateSlug(form.title);
  const { data: pres, error: pErr } = await supabase.from("presentations").insert({
    user_id: form.userId, title: form.title, description: form.description, type: form.type, language: form.language,
    theme: form.theme, font_style: fontId, slug, slides_count: slides.length, is_paid: true, is_published: true,
    persona: form.persona, depth_level: form.textDepth, presenters_count: form.presentersCount,
    presenters_names: form.presentersNames, include_speeches: form.includeSpeeches,
    dynamic_theme: data.dynamic_theme ?? null,
    creative_brief: data.creative_brief ?? null,
  } as any).select().single();
  if (pErr) throw pErr;
  const rows = slides.map((s, idx) => ({
    presentation_id: pres.id,
    position: idx,
    slide_type: s.slide_type,
    layout_template: s.layout_template,
    speaker_notes: s.speaker_notes,
    animation_transition: s.animation || "fade",
    presenters_data: (s as any).presenters_data ?? [],
    content: aiSlideToContent(s),
  })) as any;
  const { error: sErr } = await supabase.from("slides").insert(rows);
  if (sErr) {
    await supabase.from("presentations").delete().eq("id", pres.id);
    throw sErr;
  }
  return slug;
}
