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
  contrast: "low" | "medium" | "high";
  hierarchy_strength: "subtle" | "clear" | "bold";
  spacing: "tight" | "balanced" | "generous";
  asymmetry: "symmetric" | "balanced" | "asymmetric";
  narrative_type: "linear" | "problem-solution" | "before-after" | "story-arc" | "data-driven";
  element_density: "minimal" | "moderate" | "rich";
  /** Subconjunto das 13 transições (ver src/lib/slideTransitions.tsx) permitidas para este tema. */
  allowed_transitions: string[];
  /** Nomes de transições/efeitos a evitar (ex: tema sério evita "shatter"). */
  forbidden_effects: string[];
  rationale: string;
}

// Campos removidos desta interface por não terem NENHUM leitor no produto —
// a IA gastava tokens preenchendo os três a cada geração:
//   • camera_movements  — a própria descrição dizia "reservado para uso
//     futuro do Motion Director"; nunca chegou a ser lido.
//   • animation_speed   — nunca consumido; `pacing` já cobre o ritmo e é o
//     campo que entra no prompt principal.
//   • depth             — duplicava body.textDepth, que já governa a
//     contextualização via depthGuide() no prompt de conteúdo.
// Apresentações antigas têm esses campos em presentations.creative_brief
// (coluna jsonb); chaves extras são simplesmente ignoradas na leitura.

export interface BriefInput {
  title: string;
  description?: string;
  type: string;
  persona?: string;
  depthLevel?: string;
  slidesCount: number;
}

// Nomes de transição vêm do módulo compartilhado com o front (ver
// transitionNames.ts) — antes esta lista era uma cópia mantida à mão.
import { ALL_TRANSITION_NAMES } from "./transitionNames.ts";
export { ALL_TRANSITION_NAMES };

// ────────────────────────────────────────────────────────────────
// Fallback determinístico
// ────────────────────────────────────────────────────────────────
// Antes este fallback devolvia SEMPRE o mesmo brief ("editorial moderno",
// story-arc, todas as 13 transições liberadas), independentemente de a
// apresentação ser um TCC de biologia ou um pitch para investidor. Quando o
// Creative Director de IA falha — e ele falha silenciosamente, por timeout ou
// 429 —, o usuário recebia uma direção genérica sem nenhum sinal disso.
//
// O contexto real está disponível sem gastar um token: tipo/público, persona
// do orador, profundidade pedida, tamanho do deck e extensão da descrição.
// São dados estruturados e confiáveis (vêm do formulário, não de heurística
// sobre texto livre), então dá para derivar uma direção coerente de verdade.

/** Perfil de direção por tipo de apresentação — o sinal mais forte disponível. */
interface TypeProfile {
  audience: string;
  visual_style: string;
  formality: CreativeBrief["formality"];
  narrative_type: CreativeBrief["narrative_type"];
  emotional_identity: string;
  minimalism: number;
  creativity: number;
  abstraction: number;
  contrast: CreativeBrief["contrast"];
  asymmetry: CreativeBrief["asymmetry"];
  /** Efeitos que destoam deste contexto (ex.: estilhaçar slide em banca de TCC). */
  forbidden: string[];
}

const TYPE_PROFILES: Record<string, TypeProfile> = {
  acadêmico: {
    audience: "banca avaliadora e colegas de área",
    visual_style: "editorial acadêmico sóbrio",
    formality: "formal",
    narrative_type: "data-driven",
    emotional_identity: "rigoroso e credível",
    minimalism: 0.7, creativity: 0.3, abstraction: 0.2,
    contrast: "medium", asymmetry: "symmetric",
    forbidden: ["shatter", "portal", "blinds"],
  },
  científico: {
    audience: "pesquisadores e público técnico",
    visual_style: "científico limpo e preciso",
    formality: "formal",
    narrative_type: "data-driven",
    emotional_identity: "preciso e objetivo",
    minimalism: 0.75, creativity: 0.25, abstraction: 0.15,
    contrast: "medium", asymmetry: "symmetric",
    forbidden: ["shatter", "portal", "letterbox"],
  },
  escolar: {
    audience: "turma e professor",
    visual_style: "didático e colorido",
    formality: "casual",
    narrative_type: "linear",
    emotional_identity: "acessível e envolvente",
    minimalism: 0.4, creativity: 0.6, abstraction: 0.35,
    contrast: "high", asymmetry: "balanced",
    forbidden: [],
  },
  corporativo: {
    audience: "time interno e liderança",
    visual_style: "corporativo limpo",
    formality: "professional",
    narrative_type: "problem-solution",
    emotional_identity: "confiante e direto",
    minimalism: 0.65, creativity: 0.4, abstraction: 0.3,
    contrast: "high", asymmetry: "balanced",
    forbidden: ["shatter"],
  },
  marketing: {
    audience: "clientes e potenciais compradores",
    visual_style: "vibrante e direto ao ponto",
    formality: "casual",
    narrative_type: "before-after",
    emotional_identity: "energético e persuasivo",
    minimalism: 0.35, creativity: 0.8, abstraction: 0.55,
    contrast: "high", asymmetry: "asymmetric",
    forbidden: [],
  },
  criativo: {
    audience: "público aberto a experimentação",
    visual_style: "expressivo e autoral",
    formality: "casual",
    narrative_type: "story-arc",
    emotional_identity: "surpreendente e memorável",
    minimalism: 0.25, creativity: 0.9, abstraction: 0.7,
    contrast: "high", asymmetry: "asymmetric",
    forbidden: [],
  },
  "pitch de negócios": {
    audience: "investidores e decisores",
    visual_style: "investor deck afiado",
    formality: "professional",
    narrative_type: "problem-solution",
    emotional_identity: "urgente e convincente",
    minimalism: 0.7, creativity: 0.55, abstraction: 0.3,
    contrast: "high", asymmetry: "asymmetric",
    forbidden: ["blinds"],
  },
};

const DEFAULT_PROFILE: TypeProfile = {
  audience: "público geral",
  visual_style: "editorial moderno",
  formality: "professional",
  narrative_type: "story-arc",
  emotional_identity: "confiante e direto",
  minimalism: 0.5, creativity: 0.6, abstraction: 0.4,
  contrast: "high", asymmetry: "balanced",
  forbidden: [],
};

/** Ajustes que a persona do orador impõe por cima do perfil do tipo. */
const PERSONA_OVERRIDES: Record<string, Partial<TypeProfile> & { technical?: CreativeBrief["technical_level"] }> = {
  "technical-authority": {
    narrative_type: "data-driven",
    emotional_identity: "preciso e autoritativo",
    technical: "expert",
    creativity: 0.35,
    abstraction: 0.2,
  },
  "inspirational-leader": {
    narrative_type: "story-arc",
    emotional_identity: "inspirador e mobilizador",
    creativity: 0.75,
    abstraction: 0.65,
  },
  salesperson: {
    narrative_type: "problem-solution",
    emotional_identity: "persuasivo e urgente",
    creativity: 0.65,
  },
  educator: {
    narrative_type: "linear",
    emotional_identity: "didático e claro",
    abstraction: 0.3,
  },
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, +n.toFixed(2)));

// Fallback 100% determinístico — nunca falha, nunca depende de rede.
// A geração de conteúdo NUNCA deve ser bloqueada por esta etapa.
export function buildDefaultBrief(input: BriefInput): CreativeBrief {
  const deepDive = input.depthLevel === "deep-dive";
  const profile = TYPE_PROFILES[(input.type ?? "").trim().toLowerCase()] ?? DEFAULT_PROFILE;
  const personaOverride = PERSONA_OVERRIDES[input.persona ?? ""] ?? {};
  const merged = { ...profile, ...personaOverride };

  // Deck longo pede ritmo mais rápido e menos peso por slide; deck curto
  // concentra mais em cada um.
  const pacing: CreativeBrief["pacing"] =
    input.slidesCount >= 14 ? "fast" : input.slidesCount <= 7 ? "slow" : "moderate";
  // Uma descrição detalhada é sinal de que há substância para densificar.
  const describedInDetail = (input.description ?? "").trim().length >= 240;
  const visual_density: CreativeBrief["visual_density"] =
    deepDive || describedInDetail ? "dense" : merged.minimalism >= 0.7 ? "sparse" : "balanced";

  const allowed = ALL_TRANSITION_NAMES.filter((t) => !merged.forbidden.includes(t));

  return {
    objective: `Comunicar "${input.title}" para ${merged.audience}, com clareza e ${merged.emotional_identity.split(" e ")[0]}`,
    audience: merged.audience,
    technical_level: personaOverride.technical ?? (deepDive ? "expert" : "intermediate"),
    visual_style: merged.visual_style,
    formality: merged.formality,
    emotional_identity: merged.emotional_identity,
    pacing,
    visual_density,
    minimalism_degree: clamp01(merged.minimalism),
    creativity_degree: clamp01(merged.creativity),
    abstraction_degree: clamp01(merged.abstraction),
    contrast: merged.contrast,
    hierarchy_strength: merged.minimalism >= 0.65 ? "bold" : "clear",
    spacing: merged.minimalism >= 0.65 ? "generous" : "balanced",
    asymmetry: merged.asymmetry,
    narrative_type: merged.narrative_type,
    element_density: visual_density === "dense" ? "rich" : visual_density === "sparse" ? "minimal" : "moderate",
    allowed_transitions: allowed,
    forbidden_effects: merged.forbidden,
    rationale: `Direção derivada do contexto (${input.type || "tipo não informado"}, persona ${input.persona ?? "equilibrada"}, ${input.slidesCount} slides) — Creative Director de IA indisponível nesta geração.`,
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
        contrast: { type: "string", enum: ["low", "medium", "high"] },
        hierarchy_strength: { type: "string", enum: ["subtle", "clear", "bold"] },
        spacing: { type: "string", enum: ["tight", "balanced", "generous"] },
        asymmetry: { type: "string", enum: ["symmetric", "balanced", "asymmetric"] },
        narrative_type: { type: "string", enum: ["linear", "problem-solution", "before-after", "story-arc", "data-driven"] },
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
