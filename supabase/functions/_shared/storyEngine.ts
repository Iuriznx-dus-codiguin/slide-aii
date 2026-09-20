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

export type NarrativeActName = "hook" | "tension" | "journey" | "proof" | "climax";

export interface StoryBeat {
  index: number;
  narrative_act: NarrativeActName;
  /** Função narrativa curta deste slide no arco, ex: "Estabelece o problema com um dado de impacto". */
  function: string;
  /** Mensagem central em 1 frase — o que este slide precisa deixar claro. */
  key_message: string;
  /** Conexão lógica com o slide anterior (causa→efeito, problema→solução, dado→interpretação...). Vazio no primeiro slide. */
  connects_to_previous: string;
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
}

// Espelha NarrativeAct em src/components/CinematicHUD.tsx (sem o valor
// "neutral", que é um estado de UI, não uma decisão de conteúdo). Deno e
// Vite são runtimes separados sem import compartilhado — sincronia manual.
const ACTS: NarrativeActName[] = ["hook", "tension", "journey", "proof", "climax"];

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
  const typeKey = (input.type ?? "").trim().toLowerCase();
  const middle = MIDDLE_PATTERNS[typeKey] ?? DEFAULT_MIDDLE;
  const title = input.title || "o tema";

  const acts: NarrativeActName[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) acts.push("hook");
    else if (i === n - 1) acts.push("climax");
    else acts.push(middle[(i - 1) % middle.length]);
  }

  const beats: StoryBeat[] = acts.map((act, i) => ({
    index: i,
    narrative_act: act,
    ...beatCopy(act, title),
    connects_to_previous: i === 0 ? "" : connectionFor(acts[i - 1], act),
  }));

  const shape = ARC_SHAPES[typeKey] ?? "arco clássico com desenvolvimento alternando avanço e evidência";
  return {
    beats,
    arc_shape: `${shape} (arco derivado do tipo "${input.type || "não informado"}" — Story Engine de IA indisponível nesta geração)`,
  };
}

const OUTLINE_TOOL = [{
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
          items: {
            type: "object",
            properties: {
              index: { type: "integer" },
              narrative_act: { type: "string", enum: ACTS },
              function: { type: "string", description: "Função narrativa curta deste slide (5-12 palavras)." },
              key_message: { type: "string", description: "A mensagem central deste slide em 1 frase." },
              connects_to_previous: { type: "string", description: "Conexão lógica com o slide anterior. Vazio apenas no primeiro slide." },
            },
            required: ["index", "narrative_act", "function", "key_message", "connects_to_previous"],
            additionalProperties: false,
          },
        },
      },
      required: ["arc_shape", "beats"],
      additionalProperties: false,
    },
  },
}];

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
journey×N, proof, climax". Seja específico sobre O QUE cada slide comunica, não genérico.`;
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
  try {
    const endpoint = keys.useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const authKey = keys.useOpenAI ? keys.openaiKey! : keys.lovableKey!;
    const model = keys.useOpenAI ? "gpt-4.1-mini" : "google/gemini-2.5-flash";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${authKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: outlinePrompt(input) }],
          tools: OUTLINE_TOOL,
          tool_choice: { type: "function", function: { name: "set_story_outline" } },
          // ~107 tokens por slide (1600 calibrados em 15 slides), com piso de 1600.
          max_completion_tokens: Math.max(1600, Math.round(input.slidesCount * 107)),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      console.warn("storyEngine: chamada falhou com status", res.status, "— usando fallback determinístico");
      return buildDefaultOutline(input);
    }
    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return buildDefaultOutline(input);
    const parsed = JSON.parse(call.function.arguments) as Partial<StoryOutline>;
    return normalizeOutline(parsed, input);
  } catch (e) {
    console.warn("storyEngine: exceção, usando fallback determinístico —", (e as Error).message);
    return buildDefaultOutline(input);
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
    return {
      index: i,
      narrative_act: b.narrative_act,
      function: b.function || def.function,
      key_message: b.key_message || def.key_message,
      connects_to_previous: i === 0 ? "" : (b.connects_to_previous || def.connects_to_previous),
    };
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
