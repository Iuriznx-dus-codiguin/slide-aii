// Biblioteca de presets de movimento do motor de cenas (motor criativo v2).
//
// Cada slide v2 carrega `motion: { preset, params }` — um JSON pequeno e
// serializável. As trilhas (tracks) não são gravadas: são derivadas de forma
// determinística no cliente (src/lib/scene/sceneMotion.ts) sobre o
// TimelineScenario que já existe em src/lib/timeline.ts. Guardar só a
// INTENÇÃO de movimento mantém o banco leve e permite evoluir a coreografia
// sem migrar decks.
//
// Regras de direção (aplicadas pelo construtor de trilhas):
//   • um único momento orquestrado por slide, entradas curtas;
//   • camada ambiente sutil em loop separada da entrada;
//   • reduced motion e noAnimate renderizam o frame final.
//
// Semântica compatível com Remotion (interpolate com clamp, bezier e
// sequências por offset): o mesmo JSON pode alimentar uma composição Remotion
// num futuro export em MP4 sem reinterpretar nada.

export const MOTION_PRESETS = [
  "editorial",       // texto: título → subtítulo → corpo → bullets (padrão atual)
  "hero",            // capa/herói: foco que abre com escala lenta
  "connect-draw",    // fluxos: nós em sequência e conectores desenhados (pathLength)
  "step-cascade",    // passo a passo numerado em cascata
  "list-to-flow",    // bullets viram os nós do diagrama (transformação dentro do slide)
  "orbit-reveal",    // ciclos: nós percorrem a órbita, arcos desenhados
  "timeline-sweep",  // linha do tempo: eixo varre e eventos acendem
  "split-reveal",    // comparação: lados revelados por máscara
  "morph-ab",        // antes/depois: morph A→B (flubber)
  "scale-grow",      // escala: formas crescem até a proporção real
  "stack-build",     // funil/pirâmide/camadas: empilha de baixo para cima
  "data-count",      // dados: contagem numérica + barras crescendo
  "system-assemble", // sistemas: camadas montam, arestas desenham
  "hub-radiate",     // mapa conceitual: hub central irradia os satélites
  "annotate",        // híbrido: imagem em foco + marcadores numéricos
  "focus-pull",      // imagem gerada/foto: desfoque → nitidez
  "calm",            // entrada mínima (fade curto)
] as const;
export type MotionPresetId = (typeof MOTION_PRESETS)[number];

export const isMotionPreset = (v: unknown): v is MotionPresetId =>
  typeof v === "string" && (MOTION_PRESETS as readonly string[]).includes(v);

export interface MotionParams {
  /** Multiplicador de velocidade (0.6 = mais lento, 1.4 = mais rápido). */
  speed?: number;
  /** Intervalo entre elementos em cascata, em segundos. */
  stagger?: number;
  /** Índice do item que recebe o destaque (focus pull). */
  emphasis?: number;
  /** Liga/desliga a camada ambiente em loop. */
  ambient?: boolean;
}

export interface MotionSpec {
  preset: MotionPresetId;
  params?: MotionParams;
}

/** Rótulos do seletor do Editor. */
export const MOTION_PRESET_LABELS: Record<MotionPresetId, string> = {
  editorial: "Editorial (texto em cascata)",
  hero: "Herói (abertura lenta)",
  "connect-draw": "Conectar e desenhar",
  "step-cascade": "Passos em cascata",
  "list-to-flow": "Lista vira diagrama",
  "orbit-reveal": "Órbita",
  "timeline-sweep": "Varredura da linha do tempo",
  "split-reveal": "Revelação dividida",
  "morph-ab": "Morph antes → depois",
  "scale-grow": "Crescer em escala",
  "stack-build": "Empilhar",
  "data-count": "Contagem de dados",
  "system-assemble": "Montagem do sistema",
  "hub-radiate": "Irradiar do centro",
  annotate: "Anotar imagem",
  "focus-pull": "Foco (desfoque → nitidez)",
  calm: "Calmo (fade curto)",
};

/**
 * Preset cinematográfico legado (src/lib/animations.ts) equivalente a cada
 * preset de movimento. Permite que o seletor de animação do Editor tenha
 * efeito visível também em slides do motor v1 — antes ele gravava o campo
 * legado `animation`, que sempre perdia para `animation_intent`.
 */
export const LEGACY_PRESET_FOR_MOTION: Record<MotionPresetId, string> = {
  editorial: "editorial-stagger",
  hero: "hero-zoom",
  "connect-draw": "editorial-stagger",
  "step-cascade": "editorial-stagger",
  "list-to-flow": "editorial-stagger",
  "orbit-reveal": "cinematic-reveal",
  "timeline-sweep": "split-curtain",
  "split-reveal": "split-curtain",
  "morph-ab": "cinematic-reveal",
  "scale-grow": "data-build",
  "stack-build": "data-build",
  "data-count": "data-build",
  "system-assemble": "cinematic-reveal",
  "hub-radiate": "cinematic-reveal",
  annotate: "cinematic-reveal",
  "focus-pull": "cinematic-reveal",
  calm: "fade-soft",
};

/**
 * animation_intent equivalente a cada preset — aplicado aos slides de TEXTO
 * (motor v1 e slides v2 sem bloco visual), cujas coreografias são guiadas
 * por intent. Assim o seletor de animação do Editor, que agora grava
 * `motion`, muda de fato a entrada desses slides.
 */
export const INTENT_FOR_MOTION: Partial<Record<MotionPresetId, string>> = {
  editorial: "narrative-build",
  hero: "hero-impact",
  "data-count": "data-reveal",
  "scale-grow": "emphasis-stat",
  "stack-build": "emphasis-stat",
  "focus-pull": "quote-spotlight",
  annotate: "quote-spotlight",
  "split-reveal": "section-break",
  "timeline-sweep": "section-break",
  calm: "calm-fade",
  "connect-draw": "narrative-build",
  "step-cascade": "narrative-build",
  "list-to-flow": "narrative-build",
  "orbit-reveal": "narrative-build",
  "morph-ab": "narrative-build",
  "system-assemble": "narrative-build",
  "hub-radiate": "narrative-build",
};

/** Preset para slides SEM bloco visual, pelo papel de animação. */
const PRESET_BY_INTENT: Record<string, MotionPresetId> = {
  "hero-impact": "hero",
  "narrative-build": "editorial",
  "data-reveal": "data-count",
  "emphasis-stat": "data-count",
  "quote-spotlight": "focus-pull",
  "section-break": "split-reveal",
  "calm-fade": "calm",
};

export function motionForTextSlide(animationIntent?: string, slideType?: string): MotionSpec {
  if (slideType === "title_slide") return { preset: "hero" };
  return { preset: PRESET_BY_INTENT[animationIntent ?? ""] ?? "editorial" };
}

/** Valida um motion vindo do banco, do Editor ou do chat-editor. */
export function normalizeMotion(raw: unknown): MotionSpec | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { preset?: unknown; params?: unknown };
  if (!isMotionPreset(r.preset)) return undefined;
  const p = (r.params && typeof r.params === "object" ? r.params : {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
  const params: MotionParams = {};
  const speed = num(p.speed, 0.5, 2);
  const stagger = num(p.stagger, 0.02, 0.6);
  const emphasis = num(p.emphasis, 0, 20);
  if (speed !== undefined) params.speed = speed;
  if (stagger !== undefined) params.stagger = stagger;
  if (emphasis !== undefined) params.emphasis = Math.round(emphasis);
  if (typeof p.ambient === "boolean") params.ambient = p.ambient;
  return Object.keys(params).length ? { preset: r.preset, params } : { preset: r.preset };
}
