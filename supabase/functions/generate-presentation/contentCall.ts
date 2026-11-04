// Chamada de conteúdo comum aos dois motores (v1 principal e v2 de cenas).
//
// Veio do motor v2 e agora vale também para o principal:
//   • uma chamada (ou duas em paralelo, para decks grandes com falas — menos
//     latência e menos risco de resposta cortada, com os mesmos tokens);
//   • fallback de provedor (OpenRouter → gateway) só se houver tempo;
//   • nova tentativa SÓ dos slides que faltaram (antes o v1 refazia o deck
//     inteiro no Gemini Pro — uma geração inteira paga duas vezes);
//   • o que ainda faltar vira um slide mínimo do roteiro: deck pago nunca sai
//     com buraco.
// Cada motor entrega o seu prompt e o seu schema; a mecânica é uma só.

import type { StoryOutline } from "../_shared/storyEngine.ts";
import { readUsage, textFallbackRoute, textRoute, type ProviderKeys, type TokenUsage } from "../_shared/modelRegistry.ts";

/** Acima disto (com falas), o conteúdo vai em duas chamadas paralelas. */
export const SPLIT_THRESHOLD = 14;

export const AI_TIMEOUT_MESSAGE = "A IA demorou demais para responder — tente de novo, de preferência com menos slides.";

/** Timeout de uma chamada: até `cap`, sem passar do prazo da geração (−15 s de folga). */
const signalFor = (deadline: number, cap: number) =>
  AbortSignal.timeout(Math.max(5_000, Math.min(cap, deadline - Date.now() - 15_000)));
const isTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

export interface ContentCall {
  model: string;
  provider: string;
  latency_ms: number;
  usage: TokenUsage | null;
  slides_requested: number;
  slides_returned: number;
  finish_reason?: string | null;
  status?: number;
}

export interface ContentFailure {
  ok: false;
  code: string;
  message: string;
  status: number;
  detail?: Record<string, unknown>;
}

export interface ContentResult {
  ok: true;
  /** Slides da IA, indexados pela posição (0-based). Buracos = faltaram. */
  slides: (Record<string, unknown> | undefined)[];
  /** Campos de topo da primeira chamada (tema, tipografia, título corrigido…). */
  top: Record<string, unknown>;
  calls: ContentCall[];
  retry: ContentCall | null;
  /** Slides que continuaram faltando e foram preenchidos a partir do roteiro. */
  filled_from_outline: number[];
}

/** O que cada motor fornece: prompt, schema e orçamento de saída. */
export interface ContentSpec {
  system: string;
  /** Mensagem do usuário para o trecho pedido. `withTheme`: só a primeira chamada devolve os campos de topo. */
  user: (range: { from: number; to: number }, withTheme: boolean) => string;
  tool: (withTheme: boolean) => unknown;
  /** Tokens de saída por slide (teto da chamada, não custo). */
  tokensPerSlide: number;
  /** Piso do teto (modelos de raciocínio do fallback contam o "pensamento" na saída). */
  minTokens?: number;
}

interface CallOutcome {
  call: ContentCall;
  parsed: Record<string, unknown> | null;
  failure?: ContentFailure;
}

async function callContent(
  stage: "content" | "contentRetry",
  keys: ProviderKeys,
  system: string,
  user: string,
  tools: unknown,
  requested: number,
  maxTokens: number,
  deadline: number,
): Promise<CallOutcome> {
  const t0 = Date.now();
  const primary = textRoute(stage, keys);
  if (!primary) {
    return {
      call: { model: "-", provider: "-", latency_ms: 0, usage: null, slides_requested: requested, slides_returned: 0 },
      parsed: null,
      failure: { ok: false, code: "no_ai_provider", message: "Nenhum provedor de IA está configurado no momento. A equipe já foi avisada.", status: 503 },
    };
  }
  const payload = (model: string) => JSON.stringify({
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    tools,
    tool_choice: { type: "function", function: { name: "create_presentation" } },
    max_completion_tokens: maxTokens,
  });
  let route = primary;
  const timedOut = (): CallOutcome => ({
    call: { model: route.model, provider: route.provider, latency_ms: Date.now() - t0, usage: null, slides_requested: requested, slides_returned: 0 },
    parsed: null,
    failure: { ok: false, code: "ai_timeout", message: AI_TIMEOUT_MESSAGE, status: 504, detail: { provider: route.provider } },
  });
  let res: Response;
  try {
    res = await fetch(route.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${route.authKey}`, "Content-Type": "application/json" },
      body: payload(route.model),
      signal: signalFor(deadline, 110_000),
    });
  } catch (e) {
    if (isTimeout(e)) return timedOut();
    throw e;
  }
  const alt = textFallbackRoute(stage, keys);
  // Fallback só se ainda houver tempo para uma segunda chamada completa.
  if (!res.ok && alt && ![429, 402].includes(res.status) && deadline - Date.now() > 30_000) {
    const errBody = await res.text().catch(() => "");
    console.warn("content: primário falhou", res.status, errBody.slice(0, 300), "— fallback", alt.model);
    route = alt;
    try {
      res = await fetch(route.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${route.authKey}`, "Content-Type": "application/json" },
        body: payload(route.model),
        signal: signalFor(deadline, 90_000),
      });
    } catch (e) {
      if (isTimeout(e)) return timedOut();
      throw e;
    }
  }
  const base: ContentCall = {
    model: route.model, provider: route.provider, latency_ms: 0, usage: null,
    slides_requested: requested, slides_returned: 0, status: res.status,
  };
  if (!res.ok) {
    base.latency_ms = Date.now() - t0;
    const provider = { provider: route.provider };
    if (res.status === 429) return { call: base, parsed: null, failure: { ok: false, code: "ai_rate_limited", message: "O provedor de IA está sobrecarregado agora — tente novamente em alguns instantes.", status: 429, detail: provider } };
    if (res.status === 402) return { call: base, parsed: null, failure: { ok: false, code: "ai_quota_exhausted", message: "A cota de IA da plataforma se esgotou. A equipe já foi avisada.", status: 503, detail: provider } };
    const t = await res.text().catch(() => "");
    return { call: base, parsed: null, failure: { ok: false, code: "ai_gateway_error", message: "A IA respondeu com erro durante a geração. O problema foi registrado para a equipe.", status: 502, detail: { provider_status: res.status, provider_body: t.slice(0, 500) } } };
  }
  const data = await res.json();
  base.latency_ms = Date.now() - t0;
  base.usage = readUsage(data);
  base.finish_reason = data.choices?.[0]?.finish_reason ?? null;
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    return { call: base, parsed: null, failure: { ok: false, code: "ai_no_structure", message: "A IA não devolveu uma estrutura de slides válida — tente reduzir o número de slides ou desativar imagens/falas.", status: 502, detail: { finish_reason: base.finish_reason } } };
  }
  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    base.slides_returned = Array.isArray(parsed?.slides) ? parsed.slides.length : 0;
    return { call: base, parsed };
  } catch {
    return { call: base, parsed: null, failure: { ok: false, code: "ai_truncated", message: "A resposta da IA foi cortada antes de terminar — reduza o número de slides ou desative as falas.", status: 502, detail: { finish_reason: base.finish_reason, args_length: toolCall.function.arguments?.length ?? 0 } } };
  }
}

/** Coloca cada slide devolvido na sua posição (index 1-based; sem index, pela ordem no trecho). */
export function placeSlides(
  target: (Record<string, unknown> | undefined)[],
  returned: unknown[] | undefined,
  range: { from: number; to: number },
): void {
  if (!Array.isArray(returned)) return;
  let cursor = range.from;
  for (const raw of returned) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const idx = Number(s.index);
    let pos = Number.isInteger(idx) && idx >= range.from && idx <= range.to ? idx : cursor;
    // Índice já ocupado: próxima posição livre dentro do trecho.
    while (pos <= range.to && target[pos - 1]) pos++;
    if (pos > range.to) continue;
    target[pos - 1] = s;
    cursor = pos + 1;
  }
}

/**
 * Retry: coloca os slides devolvidos exatamente nas posições que faltavam.
 * Com faltantes não contíguos (ex.: 2 e 7), um índice errado da IA (3, já
 * ocupado) não escorrega o conteúdo para a posição errada: primeiro quem veio
 * com um índice faltante, depois o resto, na ordem, nas posições que sobraram.
 */
export function placeAtPositions(
  target: (Record<string, unknown> | undefined)[],
  returned: unknown[] | undefined,
  positions: number[],
): void {
  if (!Array.isArray(returned)) return;
  const free = new Set(positions.filter((p) => !target[p - 1]));
  const rest: Record<string, unknown>[] = [];
  for (const raw of returned) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const idx = Number(s.index);
    if (Number.isInteger(idx) && free.has(idx)) {
      target[idx - 1] = s;
      free.delete(idx);
    } else {
      rest.push(s);
    }
  }
  for (const pos of [...free].sort((a, b) => a - b)) {
    const s = rest.shift();
    if (!s) break;
    target[pos - 1] = { ...s, index: pos };
  }
}

export function missingIndices(target: (Record<string, unknown> | undefined)[], total: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < total; i++) if (!target[i]) out.push(i + 1);
  return out;
}

/** Slide mínimo a partir do roteiro, para nunca entregar um deck com buraco. */
export function slideFromOutline(outline: StoryOutline, index1: number): Record<string, unknown> {
  const beat = outline.beats[index1 - 1];
  const headline = (beat?.key_message ?? "").split(/\s+/).slice(0, 6).join(" ") || `Parte ${index1}`;
  return {
    index: index1,
    slide_type: index1 === 1 ? "title_slide" : "content",
    headline,
    subtitle: beat?.function ?? "",
    body_text: beat?.key_message ?? "",
    speaker_notes: beat?.connects_to_previous ?? "",
  };
}

/** Teto de saída de uma chamada para `count` slides. */
export const maxTokensFor = (count: number, perSlide: number, floor = 4000) =>
  Math.min(32000, Math.max(floor, Math.round(count * perSlide)));

/**
 * Gera o conteúdo: uma chamada principal (ou duas em paralelo acima do
 * limite), e UM retry pedindo só os slides que faltaram. O que ainda faltar
 * vira slide mínimo do roteiro.
 */
export async function generateSlides(
  spec: ContentSpec,
  n: number,
  opts: { includeSpeeches: boolean; keys: ProviderKeys; outline: StoryOutline; deadline?: number },
): Promise<ContentResult | ContentFailure> {
  const deadline = opts.deadline ?? Date.now() + 135_000;
  const split = opts.includeSpeeches && n > SPLIT_THRESHOLD;
  const ranges = split
    ? [{ from: 1, to: Math.ceil(n / 2) }, { from: Math.ceil(n / 2) + 1, to: n }]
    : [{ from: 1, to: n }];

  const outcomes = await Promise.all(ranges.map((r, k) => {
    const count = r.to - r.from + 1;
    return callContent("content", opts.keys, spec.system, spec.user(r, k === 0), spec.tool(k === 0), count, maxTokensFor(count, spec.tokensPerSlide, spec.minTokens), deadline);
  }));

  const slides: (Record<string, unknown> | undefined)[] = new Array(n).fill(undefined);
  outcomes.forEach((o, k) => placeSlides(slides, o.parsed?.slides as unknown[] | undefined, ranges[k]));
  const first = outcomes[0].parsed ?? {};
  const calls = outcomes.map((o) => o.call);

  // Nenhum slide em nenhuma chamada: falha real (com a causa da primeira).
  if (slides.every((s) => !s)) {
    const failure = outcomes.find((o) => o.failure)?.failure;
    return failure ?? { ok: false, code: "ai_empty_slides", message: "A IA não conseguiu montar nenhum slide para este título — tente reformular o título ou detalhar a descrição.", status: 502 };
  }

  // Retry SÓ dos slides que faltaram; sem tempo, os faltantes saem do roteiro.
  let retry: ContentCall | null = null;
  let missing = missingIndices(slides, n);
  if (missing.length && deadline - Date.now() > 45_000) {
    const listed = missing.map((m) => `S${m}`).join(", ");
    const user = `${spec.user({ from: missing[0], to: missing[missing.length - 1] }, false)}

ATENÇÃO: escreva APENAS os slides ${listed} (e nenhum outro), cada um com seu "index".`;
    const r = await callContent("contentRetry", opts.keys, spec.system, user, spec.tool(false), missing.length, maxTokensFor(missing.length, spec.tokensPerSlide, spec.minTokens), deadline);
    retry = r.call;
    // Só as posições que faltavam: nada já escrito é sobrescrito.
    placeAtPositions(slides, r.parsed?.slides as unknown[] | undefined, missing);
    missing = missingIndices(slides, n);
  }
  for (const m of missing) slides[m - 1] = slideFromOutline(opts.outline, m);

  const { slides: _ignored, ...top } = first as { slides?: unknown } & Record<string, unknown>;
  return { ok: true, slides, top, calls, retry, filled_from_outline: missing };
}
