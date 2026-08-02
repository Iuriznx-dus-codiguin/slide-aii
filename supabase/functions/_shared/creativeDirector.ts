// Creative Director Engine (Fase 1 da nova arquitetura de motores).
//
// Por que existe: antes desta mudança, TODAS as decisões de direção criativa
// (tom, densidade, hierarquia, ritmo, quais efeitos usar) viviam implícitas
// dentro do mesmo prompt gigante de geração de conteúdo (SYSTEM_PROMPT em
// generate-presentation/index.ts), competindo por atenção do modelo com a
// escrita de N slides simultaneamente. Aqui, uma chamada de IA SEPARADA,
// pequena e rápida, decide a direção criativa ANTES de qualquer slide ser
// escrito. O resultado (CreativeBrief) é:
//   1) injetado no SYSTEM_PROMPT principal como guidance autoritativa
//      (ver briefToPromptSection, usado em generate-presentation/index.ts);
//   2) persistido em presentations.creative_brief (ver migration
//      *_creative_director_brief.sql) para uso futuro no Editor;
//   3) consumido pelo Motion Director (src/lib/slideTransitions.ts, campo
//      allowed_transitions/forbidden_effects) via prop creativeBrief no
//      SlideStage.
//
// Falha aqui NUNCA deve derrubar a geração inteira — sempre há um fallback
// determinístico (buildDefaultBrief) caso a chamada de IA falhe por
// qualquer motivo (timeout, 429, 5xx, JSON malformado).

export interface CreativeBrief {
  objective: string;
  audience: string;
  technical_level: "beginner" | "intermediate" | "expert";
  visual_style: string;
  formality: "casual" | "professional" | "formal";
  emotional_identity: string;
  pacing: "slow" | "moderate" | "fast";
  visual_density: "sparse" | "balanced" | "dense";
  minimalism_degree: number;
  creativity_degree: number;
  abstraction_degree: number;
  depth: "surface" | "deep";
  contrast: "low" | "medium" | "high";
  hierarchy_strength: "subtle" | "clear" | "bold";
  spacing: "tight" | "balanced" | "generous";
  asymmetry: "symmetric" | "balanced" | "asymmetric";
  narrative_type: "linear" | "problem-solution" | "before-after" | "story-arc" | "data-driven";
  animation_speed: "slow" | "moderate" | "fast";
  element_density: "minimal" | "moderate" | "rich";
  /** Subconjunto das 13 transições (ver src/lib/slideTransitions.ts) permitidas para este tema. */
  allowed_transitions: string[];
  /** Nomes de transições/efeitos a evitar (ex: tema sério evita "shatter"). */
  forbidden_effects: string[];
  /** Reservado para o Motion Director (Fase 3+): nota sobre ritmo de câmera/zoom. */
  camera_movements: string;
  rationale: string;
}

export interface BriefInput {
  title: string;
  description?: string;
  type: string;
  persona?: string;
  depthLevel?: string;
  slidesCount: number;
}

// Espelha SlideTransition em src/lib/slideTransitions.tsx. Os dois precisam
// ficar em sincronia manual (Deno e Vite são runtimes/bundles separados,
// sem import compartilhado possível) — qualquer transição nova deve ser
// adicionada nos dois lugares.
export const ALL_TRANSITION_NAMES = [
  "dynamic", "mosaic", "iris", "shatter", "ribbon", "blinds",
  "fold", "portal", "wipe", "split", "morph", "stack", "letterbox",
];

// Fallback 100% determinístico — nunca falha, nunca depende de rede.
// A geração de conteúdo NUNCA deve ser bloqueada por esta etapa.
export function buildDefaultBrief(input: BriefInput): CreativeBrief {
  const deepDive = input.depthLevel === "deep-dive";
  const persona = input.persona ?? "balanced";
  return {
    objective: `Comunicar "${input.title}" de forma clara e persuasiva`,
    audience: input.type || "público geral",
    technical_level: deepDive ? "expert" : "intermediate",
    visual_style: "editorial moderno",
    formality: "professional",
    emotional_identity: persona === "inspirational-leader" ? "inspirador e confiante" : "confiante e direto",
    pacing: input.slidesCount > 12 ? "fast" : "moderate",
    visual_density: deepDive ? "dense" : "balanced",
    minimalism_degree: 0.5,
    creativity_degree: 0.6,
    abstraction_degree: 0.4,
    depth: deepDive ? "deep" : "surface",
    contrast: "high",
    hierarchy_strength: "clear",
    spacing: "balanced",
    asymmetry: "balanced",
    narrative_type: "story-arc",
    animation_speed: "moderate",
    element_density: "moderate",
    allowed_transitions: ALL_TRANSITION_NAMES,
    forbidden_effects: [],
    camera_movements: "nenhum movimento de câmera especial — prioriza clareza",
    rationale: "Brief padrão (fallback determinístico) — Creative Director de IA indisponível nesta geração.",
  };
}

function withDefaults(partial: Partial<CreativeBrief>, input: BriefInput): CreativeBrief {
  const base = buildDefaultBrief(input);
  return { ...base, ...partial };
}

const BRIEF_TOOL = [{
  type: "function",
  function: {
    name: "set_creative_brief",
    description: "Define a direção criativa completa de uma apresentação antes de qualquer slide ser escrito.",
    parameters: {
      type: "object",
      properties: {
        objective: { type: "string" },
        audience: { type: "string" },
        technical_level: { type: "string", enum: ["beginner", "intermediate", "expert"] },
        visual_style: { type: "string", description: "2-5 palavras, ex: 'editorial minimalista', 'corporativo ousado'." },
        formality: { type: "string", enum: ["casual", "professional", "formal"] },
        emotional_identity: { type: "string", description: "2-4 palavras descrevendo o tom emocional." },
        pacing: { type: "string", enum: ["slow", "moderate", "fast"] },
        visual_density: { type: "string", enum: ["sparse", "balanced", "dense"] },
        minimalism_degree: { type: "number", description: "0 (maximalista) a 1 (minimalista)." },
        creativity_degree: { type: "number", description: "0 (convencional) a 1 (experimental)." },
        abstraction_degree: { type: "number", description: "0 (literal) a 1 (abstrato)." },
        depth: { type: "string", enum: ["surface", "deep"] },
        contrast: { type: "string", enum: ["low", "medium", "high"] },
        hierarchy_strength: { type: "string", enum: ["subtle", "clear", "bold"] },
        spacing: { type: "string", enum: ["tight", "balanced", "generous"] },
        asymmetry: { type: "string", enum: ["symmetric", "balanced", "asymmetric"] },
        narrative_type: { type: "string", enum: ["linear", "problem-solution", "before-after", "story-arc", "data-driven"] },
        animation_speed: { type: "string", enum: ["slow", "moderate", "fast"] },
        element_density: { type: "string", enum: ["minimal", "moderate", "rich"] },
        allowed_transitions: {
          type: "array",
          items: { type: "string", enum: ALL_TRANSITION_NAMES },
          description: "Subconjunto das 13 transições que combinam com este tema/tom. Inclua 'dynamic' quase sempre — é o modo padrão de continuidade.",
        },
        forbidden_effects: {
          type: "array",
          items: { type: "string" },
          description: "Nomes de transições ou efeitos visuais a EVITAR neste tema (ex: um tema institucional sério pode proibir 'shatter').",
        },
        camera_movements: { type: "string", description: "Nota curta sobre ritmo de câmera/zoom desejado (reservado para uso futuro do Motion Director)." },
        rationale: { type: "string", description: "1-2 frases justificando a direção escolhida." },
      },
      required: [
        "objective", "audience", "technical_level", "visual_style", "formality",
        "emotional_identity", "pacing", "visual_density", "minimalism_degree",
        "narrative_type", "allowed_transitions",
      ],
      additionalProperties: false,
    },
  },
}];

function briefPrompt(input: BriefInput): string {
  return `Você é o Creative Director de um estúdio de apresentações premium (nível Apple/Stripe/Pitch.com).

Antes de qualquer slide ser escrito, defina a DIREÇÃO CRIATIVA completa para esta apresentação:

TÍTULO: ${input.title}
DESCRIÇÃO: ${input.description || "(não detalhada — infira o contexto mais provável)"}
TIPO/PÚBLICO: ${input.type}
PERSONA: ${input.persona ?? "equilibrado"}
PROFUNDIDADE: ${input.depthLevel ?? "high-level"}
NÚMERO DE SLIDES: ${input.slidesCount}

Decida o tom, densidade visual, ritmo, hierarquia, nível de minimalismo/criatividade/abstração,
tipo de narrativa e quais das 13 transições cinematográficas (dynamic, mosaic, iris, shatter,
ribbon, blinds, fold, portal, wipe, split, morph, stack, letterbox) combinam com este tema —
um tema institucional/sério deve evitar efeitos muito "quebrados" (shatter, portal); um tema de
lançamento de produto/tech pode usá-los livremente. Seja específico e decisivo — evite respostas genéricas.`;
}

/**
 * Chama o Creative Director. Usa um modelo rápido/barato (Gemini 2.5 Flash
 * via gateway Lovable, ou gpt-4.1-mini via OpenAI quando useOpenAI=true) —
 * esta etapa é uma DECISÃO curta, não geração de conteúdo rico, então não
 * precisa do mesmo modelo "caro" usado depois para escrever os slides.
 * NUNCA lança exceção: qualquer falha cai no fallback determinístico.
 */
export async function buildCreativeBrief(
  input: BriefInput,
  keys: { openaiKey?: string; lovableKey?: string; useOpenAI: boolean },
): Promise<CreativeBrief> {
  try {
    const endpoint = keys.useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const authKey = keys.useOpenAI ? keys.openaiKey! : keys.lovableKey!;
    const model = keys.useOpenAI ? "gpt-4.1-mini" : "google/gemini-2.5-flash";

    const controller = new AbortController();
    // Teto curto de propósito: se o Creative Director demorar, seguimos com
    // o fallback determinístico em vez de atrasar a geração principal.
    const timeout = setTimeout(() => controller.abort(), 12000);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${authKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: briefPrompt(input) }],
          tools: BRIEF_TOOL,
          tool_choice: { type: "function", function: { name: "set_creative_brief" } },
          max_completion_tokens: 900,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      console.warn("creativeDirector: chamada falhou com status", res.status, "— usando fallback determinístico");
      return buildDefaultBrief(input);
    }
    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return buildDefaultBrief(input);
    const parsed = JSON.parse(call.function.arguments);
    return withDefaults(parsed, input);
  } catch (e) {
    console.warn("creativeDirector: exceção, usando fallback determinístico —", (e as Error).message);
    return buildDefaultBrief(input);
  }
}

/** Resume o brief em texto curto para injetar no SYSTEM_PROMPT principal. */
export function briefToPromptSection(brief: CreativeBrief): string {
  return `═══════════════════════════════════════════════════
PASSO -1 — DIREÇÃO CRIATIVA (definida pelo Creative Director Engine — SIGA À RISCA)
═══════════════════════════════════════════════════
Objetivo: ${brief.objective}
Público: ${brief.audience} (nível ${brief.technical_level})
Estilo visual: ${brief.visual_style} | Formalidade: ${brief.formality}
Identidade emocional: ${brief.emotional_identity}
Ritmo: ${brief.pacing} | Densidade visual: ${brief.visual_density} | Densidade de elementos: ${brief.element_density}
Minimalismo: ${brief.minimalism_degree.toFixed(1)} | Criatividade: ${brief.creativity_degree.toFixed(1)} | Abstração: ${brief.abstraction_degree.toFixed(1)}
Contraste: ${brief.contrast} | Força de hierarquia: ${brief.hierarchy_strength} | Espaçamento: ${brief.spacing} | Assimetria: ${brief.asymmetry}
Tipo de narrativa: ${brief.narrative_type}
Justificativa: ${brief.rationale}

Esta direção deve se refletir em CADA decisão de conteúdo abaixo (densidade de texto, escolha de layout, tom da escrita). NÃO decida mais transições de slide — isso agora é responsabilidade do Motion Director (determinístico, fora deste prompt).
`;
}
