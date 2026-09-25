// Story Engine (Fase 2 da nova arquitetura de motores).
//
// Por que existe: antes desta mudança, o PASSO B do prompt principal pedia
// para a IA decidir o arco narrativo completo (narrative_act de cada slide +
// referência lógica ao slide anterior) DENTRO da mesma chamada que também
// escreve headline/subtitle/body/bullets/stat/quote/chart ricos para todos
// os N slides — ou seja, "planejar a história inteira" e "escrever o texto
// final de cada cena" competindo por atenção do modelo na mesma respiração.
//
// Aqui, uma chamada de IA separada e rápida decide APENAS o esboço: para
// cada slide, seu papel no Círculo Narrativo, sua função narrativa e sua
// mensagem-chave, e como ele se conecta ao anterior. Esse esboço vira:
//   1) um bloco de instruções explícito injetado no SYSTEM_PROMPT principal
//      (outlineToPromptSection) — a IA escreve o CONTEÚDO de cada slide já
//      sabendo exatamente que papel ele cumpre na história, em vez de
//      inventar isso slide a slide durante a mesma escrita;
//   2) a fonte de verdade para o campo narrative_act de cada slide no
//      pós-processamento (generate-presentation/index.ts) — igual ao que já
//      acontece com `transition` na Fase 3: a IA pode até tentar setar
//      narrative_act, mas o valor persistido é sempre o do outline, nunca o
//      que a IA decidiu no meio da escrita de conteúdo (evita divergência
//      entre "o que foi planejado" e "o que a IA escreveu por engano").
//
// Chamada em paralelo com buildCreativeBrief (nenhuma depende da outra) via
// Promise.all em generate-presentation/index.ts — mesmo padrão de
// confiabilidade: nunca lança exceção, sempre cai num fallback determinístico.

import { normalizePresentationType } from "./presentationType.ts";
import {
  NARRATIVE_ACTS,
  defaultIntentForAct,
  isVisualIntent,
  normalizeKeyObjects,
  VISUAL_INTENTS,
  type NarrativeActName,
  type VisualIntent,
} from "./sceneCatalog.ts";
import { textFallbackRoute, textRoute, readUsage, type TokenUsage } from "./modelRegistry.ts";

export type { NarrativeActName };

export interface StoryBeat {
  index: number;
  narrative_act: NarrativeActName;
  /** Função narrativa curta deste slide no arco, ex: "Estabelece o problema com um dado de impacto". */
  function: string;
  /** Mensagem central em 1 frase — o que este slide precisa deixar claro. */
  key_message: string;
  /** Conexão lógica com o slide anterior (causa→efeito, problema→solução, dado→interpretação...). Vazio no primeiro slide. */
  connects_to_previous: string;
  /**
   * Motor v2: o que o slide precisa MOSTRAR (catálogo VISUAL_INTENTS). Quem
   * planeja a função do slide já sabe isso — custa poucos tokens num modelo
   * mini e alimenta o Plano Visual determinístico.
   */
  visual_intent?: VisualIntent;
  /** Motor v2: 2-5 substantivos concretos que o visual precisa conter. */
  key_objects?: string[];
}

export interface StoryOutline {
  beats: StoryBeat[];
  /** Nota curta sobre a forma geral do arco escolhido (ex: "múltiplos picos de prova, sem clímax único"). */
  arc_shape: string;
}

interface OutlineInput {
  title: string;
  description?: string;
  type: string;
  slidesCount: number;
  /** Motor v2: pede visual_intent + key_objects por beat. O v1 fica idêntico. */
  withVisualPlan?: boolean;
}

/** Telemetria da etapa (generation_logs.metadata.stages.story). */
export interface StageMeta {
  source: "ai" | "fallback";
  latency_ms: number;
  model?: string;
  usage?: TokenUsage | null;
  error?: string;
}

// Atos do catálogo compartilhado (sceneCatalog.ts) — o front (CinematicHUD)
// deriva o seu tipo do mesmo módulo; acabou a sincronia manual.
const ACTS: readonly NarrativeActName[] = NARRATIVE_ACTS;

// ────────────────────────────────────────────────────────────────
// Fallback determinístico
// ────────────────────────────────────────────────────────────────
// Antes, este fallback devolvia sempre o MESMO ciclo rígido
// (hook → journey/tension/proof rotacionando → climax) com textos fixos
// ("Desenvolve o tema com um novo ângulo ou dado") para qualquer
// apresentação. Como o narrative_act também decide a transição de cada slide
// no Motion Director, uma aula e um pitch saíam com exatamente o mesmo ritmo
// visual sempre que o Story Engine de IA falhava.
//
// Continua 100% determinístico — nenhuma função offline pode saber o assunto
// do slide 4 —, mas o RITMO do arco e a redação de cada beat agora vêm do
// tipo da apresentação e do título informado, que são contexto real.

/** Sequência do miolo (entre hook e climax) por tipo de apresentação. */
const MIDDLE_PATTERNS: Record<string, NarrativeActName[]> = {
  // Trabalhos de pesquisa: evidência acima de tensão dramática.
  acadêmico: ["journey", "proof", "proof", "journey"],
  científico: ["journey", "proof", "proof", "journey"],
  // Aula: explicação encadeada, com checagens de entendimento.
  escolar: ["journey", "journey", "proof"],
  // Reunião: problema, encaminhamento, evidência.
  corporativo: ["tension", "journey", "proof"],
  // Venda: dor e transformação alternando, com prova social.
  marketing: ["tension", "journey", "proof", "tension"],
  // Autoral: constrói e quebra expectativa.
  criativo: ["tension", "journey", "tension", "proof"],
  // Investidor: dor, solução, tração — nessa ordem, repetindo.
  "pitch de negócios": ["tension", "journey", "proof"],
};

const DEFAULT_MIDDLE: NarrativeActName[] = ["journey", "tension", "proof"];

const ARC_SHAPES: Record<string, string> = {
  acadêmico: "abertura contextual, múltiplos blocos de evidência, conclusão fundamentada",
  científico: "abertura contextual, múltiplos blocos de evidência, conclusão fundamentada",
  escolar: "abertura curiosa, explicação encadeada com checagens, fechamento em revisão",
  corporativo: "problema, encaminhamento e prova alternando até a decisão final",
  marketing: "dor e transformação alternando, com prova social antes do fechamento",
  criativo: "construção e quebra de expectativa até um desfecho memorável",
  "pitch de negócios": "dor, solução e tração em ciclos curtos até o pedido final",
};

/** Redação de cada beat a partir do ato e do assunto — sem inventar conteúdo. */
const beatCopy = (act: NarrativeActName, title: string): Pick<StoryBeat, "function" | "key_message"> => {
  switch (act) {
    case "hook":
      return {
        function: "Captura atenção e ancora o assunto",
        key_message: `Por que "${title}" merece atenção agora`,
      };
    case "tension":
      return {
        function: "Expõe o conflito, a lacuna ou o custo de não agir",
        key_message: "O problema concreto que ainda não foi resolvido",
      };
    case "journey":
      return {
        function: "Avança a explicação com um ângulo novo do tema",
        key_message: "Um passo a mais no entendimento, sem repetir o anterior",
      };
    case "proof":
      return {
        function: "Sustenta o argumento com dado, exemplo ou caso",
        key_message: "A evidência que torna a afirmação anterior verificável",
      };
    case "climax":
      return {
        function: "Fecha com a conclusão de maior impacto",
        key_message: `O que fica de "${title}" depois desta apresentação`,
      };
  }
};

/** Conexão declarada entre um beat e o anterior — depende do par de atos. */
const connectionFor = (prev: NarrativeActName, current: NarrativeActName): string => {
  if (prev === "tension" && current === "journey") return "Resposta direta ao problema levantado antes";
  if (prev === "journey" && current === "proof") return "Evidência que confirma o ponto recém-explicado";
  if (prev === "proof" && current === "tension") return "A evidência anterior revela um novo obstáculo";
  if (prev === "proof" && current === "journey") return "A partir do dado confirmado, o tema avança";
  if (current === "climax") return "Síntese do que foi construído até aqui";
  if (prev === "hook") return "Desdobramento do gancho de abertura";
  return "Continuação lógica direta do slide anterior";
};

export function buildDefaultOutline(input: OutlineInput): StoryOutline {
  const n = Math.max(1, input.slidesCount);
  const typeKey = normalizePresentationType(input.type);
  const middle = MIDDLE_PATTERNS[typeKey] ?? DEFAULT_MIDDLE;
  const title = input.title || "o tema";

  const acts: NarrativeActName[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) acts.push("hook");
    else if (i === n - 1) acts.push("climax");
    else acts.push(middle[(i - 1) % middle.length]);
  }

  const beats: StoryBeat[] = acts.map((act, i) => {
    const beat: StoryBeat = {
      index: i,
      narrative_act: act,
      ...beatCopy(act, title),
      connects_to_previous: i === 0 ? "" : connectionFor(acts[i - 1], act),
    };
    if (input.withVisualPlan) {
      beat.visual_intent = defaultIntentForAct(act, i);
      // Offline não dá para saber os objetos do slide 4; a capa e o
      // fechamento podem ao menos ancorar no próprio assunto.
      beat.key_objects = i === 0 || i === n - 1 ? normalizeKeyObjects([input.title]) : [];
    }
    return beat;
  });

  const shape = ARC_SHAPES[typeKey] ?? "arco clássico com desenvolvimento alternando avanço e evidência";
  return {
    beats,
    arc_shape: `${shape} (arco derivado do tipo "${input.type || "não informado"}" — Story Engine de IA indisponível nesta geração)`,
  };
}

const BEAT_PROPS = {
  index: { type: "integer" },
  narrative_act: { type: "string", enum: ACTS },
  function: { type: "string", description: "Função narrativa curta deste slide (5-12 palavras)." },
  key_message: { type: "string", description: "A mensagem central deste slide em 1 frase." },
  connects_to_previous: { type: "string", description: "Conexão lógica com o slide anterior. Vazio apenas no primeiro slide." },
};

const VISUAL_BEAT_PROPS = {
  visual_intent: {
    type: "string",
    enum: VISUAL_INTENTS,
    description: "O que o slide precisa MOSTRAR: processo, comparação, decomposição, dado, escala, metáfora…",
  },
  key_objects: {
    type: "array",
    items: { type: "string" },
    description: "2-5 substantivos CONCRETOS que o visual deste slide precisa conter (ex: 'turbina', 'rotor', 'gerador').",
  },
};

function outlineTool(withVisualPlan: boolean) {
  const props = withVisualPlan ? { ...BEAT_PROPS, ...VISUAL_BEAT_PROPS } : BEAT_PROPS;
  const required = ["index", "narrative_act", "function", "key_message", "connects_to_previous"];
  if (withVisualPlan) required.push("visual_intent", "key_objects");
  return [{
    type: "function",
    function: {
      name: "set_story_outline",
      description: "Define o esboço narrativo completo de uma apresentação, slide a slide, antes de qualquer conteúdo detalhado ser escrito.",
      parameters: {
        type: "object",
        properties: {
          arc_shape: { type: "string", description: "1 frase sobre a forma do arco escolhido (ex: 'hook único, múltiplos picos de prova, sem clímax explícito')." },
          beats: {
            type: "array",
            items: { type: "object", properties: props, required, additionalProperties: false },
          },
        },
        required: ["arc_shape", "beats"],
        additionalProperties: false,
      },
    },
  }];
}

function outlinePrompt(input: OutlineInput): string {
  return `Você é um roteirista/story editor sênior (nível TED Talks, Pitch.com, Apple keynote).

Planeje o ESBOÇO NARRATIVO completo (não o conteúdo final) de uma apresentação de ${input.slidesCount} slides:

TÍTULO: ${input.title}
DESCRIÇÃO: ${input.description || "(não detalhada — infira o contexto mais provável)"}
TIPO/PÚBLICO: ${input.type}

Para CADA um dos ${input.slidesCount} slides (index 0 a ${input.slidesCount - 1}), defina: sua posição no Círculo Narrativo
(hook, tension, journey, proof, climax), sua função narrativa específica, a mensagem-chave em 1 frase,
e como ele se conecta LOGICAMENTE ao slide anterior (causa→efeito, problema→solução, conceito→exemplo, dado→interpretação).

O arco clássico (hook → tension → journey → proof → climax) é uma REFERÊNCIA, não uma prisão: você pode abrir
direto em "journey" se o tema pede contexto imediato, ter múltiplos picos de "proof", alternar tension↔journey
várias vezes, ou não ter um "climax" explícito. VARIE a sequência — evite o padrão rígido "hook, tension,
journey×N, proof, climax". Seja específico sobre O QUE cada slide comunica, não genérico.${input.withVisualPlan ? `

Para cada slide defina também visual_intent (o que o público precisa VER: processo, comparação, decomposição,
dado, escala, metáfora…) e key_objects: 2-5 substantivos concretos e literais do assunto que o visual deve conter.
Varie as intenções ao longo do arco — não repita a mesma intenção em slides vizinhos sem motivo.` : ""}`;
}

/**
 * Chama o Story Engine. Modelo rápido/barato (mesmo critério do Creative
 * Director — Fase 1) já que esta etapa é planejamento estrutural, não
 * geração de conteúdo rico. NUNCA lança exceção: qualquer falha cai no
 * fallback determinístico, e o número de beats é sempre normalizado para
 * bater exatamente com slidesCount (preenchendo ou truncando).
 */
export async function buildStoryOutline(
  input: OutlineInput,
  keys: { openaiKey?: string; lovableKey?: string; useOpenAI: boolean },
): Promise<StoryOutline> {
  return (await buildStoryOutlineWithMeta(input, keys)).outline;
}

/** Igual a buildStoryOutline, devolvendo também latência, tokens e origem. */
export async function buildStoryOutlineWithMeta(
  input: OutlineInput,
  keys: { openaiKey?: string; lovableKey?: string; useOpenAI: boolean },
): Promise<{ outline: StoryOutline; meta: StageMeta }> {
  const t0 = Date.now();
  const providerKeys = { openaiKey: keys.useOpenAI ? keys.openaiKey : null, lovableKey: keys.lovableKey };
  const route = textRoute("story", providerKeys);
  const fallback = (error: string) => ({
    outline: buildDefaultOutline(input),
    meta: { source: "fallback" as const, latency_ms: Date.now() - t0, model: route?.model, error },
  });
  if (!route) return fallback("sem provedor");
  try {
    const call = async (r: NonNullable<ReturnType<typeof textRoute>>) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        return await fetch(r.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${r.authKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: r.model,
            messages: [{ role: "user", content: outlinePrompt(input) }],
            tools: outlineTool(!!input.withVisualPlan),
            tool_choice: { type: "function", function: { name: "set_story_outline" } },
            // Orçamento POR SLIDE, não um piso que domina os decks pequenos.
            // Antes era max(1600, slides*107): um deck de 5 slides recebia 320
            // tokens/slide e um de 20 recebia 107 — ou seja, o orçamento por
            // beat encolhia justamente quando o arco fica mais difícil de
            // planejar, e os últimos beats saíam truncados (caindo no
            // fallback). Cada beat custa ~70-85 tokens entre conteúdo e
            // estrutura JSON; 135 dá folga real sem inflar o deck pequeno.
            // O motor v2 soma visual_intent + key_objects (~25 tokens/beat).
            max_completion_tokens: Math.max(1400, Math.round(input.slidesCount * (input.withVisualPlan ? 165 : 135))),
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    let used = route;
    let res = await call(route);
    // Mesma política do conteúdo: OpenAI falhando por erro não tarifário cai
    // no gateway antes do fallback determinístico.
    const alt = textFallbackRoute("story", providerKeys);
    if (!res.ok && alt && ![429, 402].includes(res.status)) {
      used = alt;
      res = await call(alt);
    }
    if (!res.ok) {
      console.warn("storyEngine: chamada falhou com status", res.status, "— usando fallback determinístico");
      return fallback(`status ${res.status}`);
    }
    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return fallback("sem tool_call");
    const parsed = JSON.parse(toolCall.function.arguments) as Partial<StoryOutline>;
    return {
      outline: normalizeOutline(parsed, input),
      meta: { source: "ai", latency_ms: Date.now() - t0, model: used.model, usage: readUsage(data) },
    };
  } catch (e) {
    console.warn("storyEngine: exceção, usando fallback determinístico —", (e as Error).message);
    return fallback((e as Error).message?.slice(0, 120) ?? "exceção");
  }
}

/**
 * Garante exatamente slidesCount beats, na ordem certa, com narrative_act
 * sempre válido — a IA pode devolver menos/mais beats do que pedido, fora
 * de ordem, ou com o campo `index` incorreto (ex.: 1-based por engano).
 * Por isso usa a POSIÇÃO no array como fonte de verdade, não o campo
 * `index` retornado pela IA — ordem de array é muito mais confiável em
 * LLMs do que um inteiro acompanhante ficar consistente com ela.
 */
export function normalizeOutline(parsed: Partial<StoryOutline>, input: OutlineInput): StoryOutline {
  const fallback = buildDefaultOutline(input);
  const aiBeats = Array.isArray(parsed.beats) ? parsed.beats : [];
  const beats: StoryBeat[] = fallback.beats.map((def, i) => {
    const b = aiBeats[i];
    if (!b || !ACTS.includes(b.narrative_act)) return def;
    const beat: StoryBeat = {
      index: i,
      narrative_act: b.narrative_act,
      function: b.function || def.function,
      key_message: b.key_message || def.key_message,
      connects_to_previous: i === 0 ? "" : (b.connects_to_previous || def.connects_to_previous),
    };
    if (input.withVisualPlan) {
      // Intenção fora do catálogo cai na padrão do ato — nunca chega inválida
      // ao Plano Visual.
      beat.visual_intent = isVisualIntent(b.visual_intent) ? b.visual_intent : defaultIntentForAct(b.narrative_act, i);
      const objects = normalizeKeyObjects(b.key_objects);
      beat.key_objects = objects.length ? objects : def.key_objects ?? [];
    }
    return beat;
  });
  return { beats, arc_shape: parsed.arc_shape || fallback.arc_shape };
}

/** Formata o outline em texto para injetar no SYSTEM_PROMPT principal. */
export function outlineToPromptSection(outline: StoryOutline): string {
  const lines = outline.beats
    .map((b) => `  Slide ${b.index + 1} [${b.narrative_act}]: ${b.function} — mensagem-chave: "${b.key_message}"${b.connects_to_previous ? ` — conexão: ${b.connects_to_previous}` : ""}`)
    .join("\n");
  return `═══════════════════════════════════════════════════
PASSO B — ARCO NARRATIVO (já planejado pelo Story Engine — SIGA A ORDEM, NÃO REINVENTE)
═══════════════════════════════════════════════════
Forma do arco: ${outline.arc_shape}

O esboço abaixo já foi decidido. Sua tarefa agora é ESCREVER o conteúdo completo (headline, subtitle,
body_text, bullets, stat, quote, chart — conforme PASSO C) de cada slide CUMPRINDO exatamente a função
narrativa e a mensagem-chave listadas, na ordem dada. Não invente uma sequência de narrative_act diferente
desta — ela já reflete a distribuição flexível do Círculo Narrativo (hook→tension→journey→proof→climax como
referência, não prisão) pensada para este tema especificamente.

${lines}
`;
}
