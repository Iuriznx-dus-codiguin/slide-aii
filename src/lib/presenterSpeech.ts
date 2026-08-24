// ============================================================
// SlideAI — Fallback de falas do apresentador
// ------------------------------------------------------------
// Apresentações antigas (ou gerações em que a IA não preencheu
// presenters_data) chegavam ao editor/apresentação sem nenhuma
// fala. Aqui derivamos um roteiro a partir do conteúdo real do
// slide para que o painel nunca fique vazio.
// ============================================================

export interface PresenterLike {
  id: string;
  name: string;
  technical_notes?: string;
  exact_speech?: string;
  transition_anchor?: string;
}

interface SlideLike {
  speaker_notes?: string | null;
  content?: {
    headline?: string;
    subtitle?: string;
    body_text?: string;
    bullets?: string[];
    stat_value?: string;
    stat_label?: string;
    quote_text?: string;
    quote_author?: string;
  } | null;
}

/** Constrói uma fala a partir do conteúdo do slide (usada só como fallback). */
export function buildFallbackSpeech(slide: SlideLike | undefined, index: number): string {
  if (!slide) return "";
  const c = slide.content ?? {};
  const parts: string[] = [];
  if (slide.speaker_notes) parts.push(String(slide.speaker_notes).trim());
  if (!parts.length && c.headline) {
    parts.push(index === 0 ? `Vamos começar falando sobre ${c.headline}.` : `Agora, sobre ${c.headline}.`);
  }
  if (c.subtitle) parts.push(String(c.subtitle).trim());
  const bullets = Array.isArray(c.bullets) ? c.bullets.slice(0, 3) : [];
  if (bullets.length) parts.push(`Destaco três pontos: ${bullets.join("; ")}.`);
  if (c.stat_value) parts.push(`Repare no número ${c.stat_value}${c.stat_label ? ` — ${c.stat_label}` : ""}.`);
  if (c.quote_text) parts.push(`Como disse ${c.quote_author || "o autor"}: "${c.quote_text}".`);
  if (c.body_text && parts.length < 2) parts.push(String(c.body_text).trim());
  return parts.filter(Boolean).join(" ").slice(0, 900);
}

/**
 * Normaliza presenters_data garantindo uma entrada por apresentador e ao
 * menos uma fala preenchida (derivada do slide quando necessário).
 */
export function ensurePresenterSpeeches(
  slide: SlideLike & { presenters_data?: PresenterLike[] } | undefined,
  presentersNames: string[],
  index: number,
): PresenterLike[] {
  const existing = slide?.presenters_data ?? [];
  const names = presentersNames.length > 0 ? presentersNames : ["Apresentador 1"];
  const merged: PresenterLike[] = names.map((name, i) => {
    const found = existing.find((e) => e?.name === name) ?? existing[i];
    return found
      ? { ...found, name, exact_speech: (found.exact_speech || "").trim() }
      : { id: `${i}`, name, technical_notes: "", exact_speech: "", transition_anchor: "" };
  });
  const someoneSpeaks = merged.some((p) => (p.exact_speech || "").length > 0);
  if (!someoneSpeaks && merged.length > 0) {
    const blockSize = 2;
    const idx = Math.min(merged.length - 1, Math.floor(index / blockSize));
    merged[idx] = { ...merged[idx], exact_speech: buildFallbackSpeech(slide, index) };
  }
  return merged;
}
