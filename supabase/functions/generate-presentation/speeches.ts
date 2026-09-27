// Normalização das falas dos apresentadores (motores v1 e v2).
//
// Extraído do handler de generate-presentation sem mudar a regra: garante um
// objeto por apresentador em cada slide e, se a IA não devolver nenhuma fala
// (ou devolver vazia), sintetiza uma a partir do conteúdo real do slide para
// que o roteiro NUNCA chegue vazio ao Editor/apresentação.

type SlideLike = Record<string, unknown> & {
  speaker_notes?: unknown;
  headline?: unknown;
  subtitle?: unknown;
  bullets?: unknown;
  stat_value?: unknown;
  stat_label?: unknown;
  quote_text?: unknown;
  quote_author?: unknown;
  body_text?: unknown;
  presenters_data?: unknown;
};

export interface PresenterEntry {
  id: string;
  name: string;
  exact_speech: string;
  transition_anchor: string;
}

export function synthSpeech(s: SlideLike, idx: number): string {
  const parts: string[] = [];
  if (s.speaker_notes) parts.push(String(s.speaker_notes).trim());
  if (!parts.length && s.headline) {
    parts.push(idx === 0 ? `Vamos começar falando sobre ${s.headline}.` : `Agora, sobre ${s.headline}.`);
  }
  if (s.subtitle) parts.push(String(s.subtitle).trim());
  const bullets = Array.isArray(s.bullets) ? s.bullets.slice(0, 3) : [];
  if (bullets.length) parts.push(`Destaco três pontos: ${bullets.join("; ")}.`);
  if (s.stat_value) parts.push(`Repare no número ${s.stat_value}${s.stat_label ? ` — ${s.stat_label}` : ""}.`);
  if (s.quote_text) parts.push(`Como disse ${s.quote_author || "o autor"}: "${s.quote_text}".`);
  if (s.body_text && parts.length < 2) parts.push(String(s.body_text).trim());
  return parts.filter(Boolean).join(" ").slice(0, 900);
}

/** Um objeto por apresentador em cada slide; fala sintetizada quando ninguém fala. */
export function normalizeSpeeches(slides: SlideLike[], presenterNames: string[]): PresenterEntry[][] {
  const blockSize = Math.max(2, Math.ceil(slides.length / Math.max(1, presenterNames.length)));
  return slides.map((s, idx) => {
    const existing = Array.isArray(s.presenters_data) ? (s.presenters_data as Record<string, unknown>[]) : [];
    const normalized: PresenterEntry[] = presenterNames.map((name, i) => {
      const found = existing.find((e) => e?.name === name) ?? existing[i] ?? {};
      return {
        id: crypto.randomUUID(),
        name,
        exact_speech: typeof found.exact_speech === "string" ? found.exact_speech.trim() : "",
        transition_anchor: typeof found.transition_anchor === "string" ? found.transition_anchor : "",
      };
    });
    const someoneSpeaks = normalized.some((p) => p.exact_speech.length > 0);
    if (!someoneSpeaks && normalized.length > 0) {
      const speakerIdx = Math.min(normalized.length - 1, Math.floor(idx / blockSize));
      normalized[speakerIdx].exact_speech = synthSpeech(s, idx);
    }
    return normalized;
  });
}

/**
 * Nota do orador nunca vazia — SÓ quando o usuário escolheu (e pagou) as
 * falas dos apresentadores na geração (+50 créditos). Sem essa opção, a nota
 * fica como a IA devolveu: completar de graça concorreria com o recurso pago.
 *
 * Quando a IA devolve a nota vazia, ela é montada a partir do conteúdo real do
 * slide (medido em produção: a IA passou a deixar a maioria das notas em
 * branco depois do motor v2).
 */
export function fillSpeakerNotes(notes: unknown, s: SlideLike & { visual?: { items?: { label?: unknown; from?: unknown; to?: unknown }[] } }): string {
  const existing = typeof notes === "string" ? notes.trim() : "";
  if (existing) return existing;
  const parts: string[] = [];
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const headline = text(s.headline);
  if (headline) parts.push(`Neste slide, fale sobre ${headline}.`);
  const subtitle = text(s.subtitle);
  if (subtitle) parts.push(subtitle.endsWith(".") ? subtitle : `${subtitle}.`);
  const items = (s.visual?.items ?? [])
    .filter((it) => !(it?.from && it?.to))
    .map((it) => text(it?.label))
    .filter(Boolean)
    .slice(0, 6);
  if (items.length) parts.push(`Percorra o visual: ${items.join(" → ")}.`);
  const bullets = Array.isArray(s.bullets) ? s.bullets.map(text).filter(Boolean).slice(0, 4) : [];
  if (bullets.length) parts.push(`Pontos a comentar: ${bullets.join("; ")}.`);
  const stat = text(s.stat_value);
  if (stat) parts.push(`Destaque o número ${stat}${text(s.stat_label) ? ` — ${text(s.stat_label)}` : ""}.`);
  const quote = text(s.quote_text);
  if (quote) parts.push(`Leia a citação${text(s.quote_author) ? ` de ${text(s.quote_author)}` : ""} e explique por que ela importa aqui.`);
  const body = text(s.body_text);
  if (body && parts.length < 3) {
    const first = body.split(/(?<=[.!?])\s+/)[0] ?? body;
    parts.push(first.length > 220 ? `${first.slice(0, 217).trimEnd()}…` : first);
  }
  return parts.join(" ").slice(0, 700);
}
