// Registro de comandos visuais do motor de cenas (motor criativo v2).
//
// Um "comando" é a forma como um bloco visual mostra a intenção do slide:
// PIPELINE, TIMELINE, BEFORE_AFTER, EXPLODED_VIEW… Cada entrada declara tudo
// o que o resto do pipeline precisa para decidir SEM IA:
//   • renderMode   — native (SVG/HTML com tokens do tema, custo zero, texto
//                    editável e animável), generated (mídia raster: foto real
//                    ou imagem de IA) ou hybrid (imagem + camada de anotação
//                    nativa e editável);
//   • component    — o componente React que desenha (src/components/scene);
//   • layouts      — modelos de página que hospedam o bloco;
//   • min/maxItems e requires — o contrato mínimo de dados;
//   • motion       — preset de movimento padrão;
//   • imageRecipe  — receita do Image Director quando há mídia;
//   • exportStrategy — shapes nativos no PPTX, gráfico nativo ou imagem;
//   • fallback     — próximo comando da cadeia quando o contrato falha;
//   • nativeComponent — como desenhar o MESMO comando sem mídia (orçamento,
//                    includeImages=false ou ativo que falhou).
//
// Os packs por domínio entram depois como DADOS aqui (campo `domains`), sem
// código novo. Mapas (MAP_VIEW, ROUTE_MAP) ficam declarados mas desligados
// (mvp=false): geografia gerada por IA sai inventada; entram numa fase
// posterior com mapa vetorial local e pinos/rotas nativos.

import type { Domain, VisualIntent } from "./sceneCatalog.ts";
import type { MotionPresetId } from "./motionPresets.ts";

export type RenderMode = "native" | "generated" | "hybrid";

export type VisualComponent =
  | "FlowDiagram" | "CycleDiagram" | "TimelineDiagram" | "ComparisonDiagram"
  | "FunnelDiagram" | "PyramidDiagram" | "DataScene" | "SystemDiagram"
  | "ConceptMap" | "LayerStack" | "MediaVisual";

/** Forma dos dados em `items` — base da troca entre comandos irmãos. */
export type ItemShape =
  | "sequence" | "cycle" | "events" | "sides" | "rows" | "stages" | "levels"
  | "metrics" | "graph" | "concepts" | "components" | "media" | "places";

export type ImageRecipeKind = "technical" | "cutout" | "illustration" | "scene" | "reconstruction";
export type ExportStrategy = "shapes" | "chart" | "image";

/** Modelos de página que hospedam um bloco visual. */
export const SCENE_LAYOUTS = [
  "visual-hero", "diagram-full", "image-left", "image-right", "full-image", "title-content", "two-columns",
] as const;
export type SceneLayout = (typeof SCENE_LAYOUTS)[number];

export interface VisualCommandSpec {
  id: string;
  component: VisualComponent;
  variant: string;
  renderMode: RenderMode;
  itemShape: ItemShape;
  intents: readonly VisualIntent[];
  layouts: readonly SceneLayout[];
  minItems: number;
  maxItems: number;
  requires?: { values?: number; edges?: number; groups?: number; subject?: boolean };
  motion: MotionPresetId;
  imageRecipe?: ImageRecipeKind;
  /** Pode ser servido por foto real (Pexels) em vez de IA. */
  photoEligible?: boolean;
  exportStrategy: ExportStrategy;
  fallback: string | null;
  nativeComponent?: VisualComponent;
  /** Visual de dados — desligado quando includeCharts=false. */
  dataVisual?: boolean;
  domains?: readonly Domain[];
  abstraction?: "literal" | "abstract";
  mvp: boolean;
  /** Contrato compacto enviado no prompt (só dos comandos candidatos). */
  contract: string;
}

const FLOW: readonly SceneLayout[] = ["diagram-full", "title-content", "visual-hero", "two-columns"];
const CYCLE: readonly SceneLayout[] = ["visual-hero", "two-columns", "diagram-full"];
const TIMELINE: readonly SceneLayout[] = ["diagram-full", "title-content"];
const COMPARE: readonly SceneLayout[] = ["diagram-full", "title-content", "visual-hero"];
const VERTICAL: readonly SceneLayout[] = ["two-columns", "visual-hero", "image-right", "image-left"];
const DATA: readonly SceneLayout[] = ["two-columns", "visual-hero", "diagram-full"];
const SYSTEM: readonly SceneLayout[] = ["diagram-full", "visual-hero"];
const CONCEPT: readonly SceneLayout[] = ["visual-hero", "two-columns", "diagram-full"];
const HYBRID: readonly SceneLayout[] = ["visual-hero", "diagram-full", "image-left", "image-right"];
const MEDIA: readonly SceneLayout[] = ["image-right", "image-left", "full-image", "visual-hero"];
const HERO: readonly SceneLayout[] = ["visual-hero", "image-left", "image-right"];

export const VISUAL_COMMANDS: readonly VisualCommandSpec[] = [
  // ── Fluxos (FlowDiagram) ──────────────────────────────────────────────
  { id: "PROCESS_FLOW", component: "FlowDiagram", variant: "flow", renderMode: "native", itemShape: "sequence",
    intents: ["SHOW_PROCESS", "EXPLAIN", "SHOW_CAUSE_EFFECT"], layouts: FLOW, minItems: 3, maxItems: 6,
    motion: "connect-draw", exportStrategy: "shapes", fallback: "SEQUENCE", mvp: true,
    contract: "3-6 etapas em ordem (label curto, detail, icon)" },
  { id: "STEP_BY_STEP", component: "FlowDiagram", variant: "steps", renderMode: "native", itemShape: "sequence",
    intents: ["SHOW_PROCESS", "EXPLAIN"], layouts: FLOW, minItems: 3, maxItems: 6,
    motion: "step-cascade", exportStrategy: "shapes", fallback: "SEQUENCE", domains: ["education"], mvp: true,
    contract: "3-6 passos numerados (label=ação, detail=como fazer)" },
  { id: "SEQUENCE", component: "FlowDiagram", variant: "sequence", renderMode: "native", itemShape: "sequence",
    intents: ["SHOW_PROCESS", "SHOW_EVOLUTION", "EXPLAIN", "SHOW_CAUSE_EFFECT"], layouts: FLOW, minItems: 2, maxItems: 6,
    motion: "connect-draw", exportStrategy: "shapes", fallback: null, mvp: true,
    contract: "2-6 elementos encadeados (label, detail)" },
  { id: "PIPELINE", component: "FlowDiagram", variant: "pipeline", renderMode: "native", itemShape: "sequence",
    intents: ["SHOW_PROCESS", "DECOMPOSE"], layouts: FLOW, minItems: 3, maxItems: 7,
    motion: "connect-draw", exportStrategy: "shapes", fallback: "SEQUENCE", domains: ["tech", "engineering", "product"], mvp: true,
    contract: "3-7 estágios de transformação (label, detail=o que entra e sai)" },
  { id: "WORKFLOW", component: "FlowDiagram", variant: "workflow", renderMode: "native", itemShape: "sequence",
    intents: ["SHOW_PROCESS", "SHOW_RELATIONSHIP"], layouts: FLOW, minItems: 3, maxItems: 7,
    motion: "connect-draw", exportStrategy: "shapes", fallback: "PROCESS_FLOW", domains: ["business", "product"], mvp: true,
    contract: "3-7 tarefas em ordem; group=responsável/área de cada tarefa" },

  // ── Ciclos (CycleDiagram) ─────────────────────────────────────────────
  { id: "CYCLE", component: "CycleDiagram", variant: "cycle", renderMode: "native", itemShape: "cycle",
    intents: ["SHOW_PROCESS", "SHOW_RELATIONSHIP", "EXPLAIN"], layouts: CYCLE, minItems: 3, maxItems: 6,
    motion: "orbit-reveal", exportStrategy: "shapes", fallback: "SEQUENCE", domains: ["science", "business"], mvp: true,
    contract: "3-6 fases que voltam ao início (label, detail)" },
  { id: "LOOP", component: "CycleDiagram", variant: "loop", renderMode: "native", itemShape: "cycle",
    intents: ["SHOW_CAUSE_EFFECT", "SHOW_PROCESS"], layouts: CYCLE, minItems: 2, maxItems: 5,
    motion: "orbit-reveal", exportStrategy: "shapes", fallback: "SEQUENCE", mvp: true,
    contract: "2-5 elementos que se realimentam (label, detail=efeito no próximo)" },

  // ── Tempo (TimelineDiagram) ───────────────────────────────────────────
  { id: "TIMELINE", component: "TimelineDiagram", variant: "timeline", renderMode: "native", itemShape: "events",
    intents: ["SHOW_EVOLUTION", "RECONSTRUCT"], layouts: TIMELINE, minItems: 3, maxItems: 7,
    motion: "timeline-sweep", exportStrategy: "shapes", fallback: "SEQUENCE", domains: ["history"], mvp: true,
    contract: "3-7 eventos; label=data ou período, detail=o que aconteceu" },
  { id: "EVOLUTION", component: "TimelineDiagram", variant: "evolution", renderMode: "native", itemShape: "events",
    intents: ["SHOW_EVOLUTION", "SHOW_CHANGE"], layouts: TIMELINE, minItems: 3, maxItems: 6,
    motion: "timeline-sweep", exportStrategy: "shapes", fallback: "TIMELINE", domains: ["science", "tech"], mvp: true,
    contract: "3-6 estágios de evolução; label=estágio, detail=o que mudou" },
  { id: "PROGRESSION", component: "TimelineDiagram", variant: "progression", renderMode: "native", itemShape: "events",
    intents: ["SHOW_EVOLUTION", "SHOW_SCALE", "SHOW_PROCESS"], layouts: TIMELINE, minItems: 3, maxItems: 6,
    motion: "timeline-sweep", exportStrategy: "shapes", fallback: "SEQUENCE", mvp: true,
    contract: "3-6 níveis crescentes (label, detail)" },

  // ── Comparação (ComparisonDiagram) ────────────────────────────────────
  { id: "SIDE_BY_SIDE", component: "ComparisonDiagram", variant: "sides", renderMode: "native", itemShape: "sides",
    intents: ["COMPARE"], layouts: COMPARE, minItems: 2, maxItems: 3,
    motion: "split-reveal", exportStrategy: "shapes", fallback: null, mvp: true,
    contract: "2-3 lados; label=nome do lado, detail=descrição, icon" },
  { id: "BEFORE_AFTER", component: "ComparisonDiagram", variant: "before-after", renderMode: "native", itemShape: "sides",
    intents: ["SHOW_CHANGE", "COMPARE"], layouts: COMPARE, minItems: 2, maxItems: 5,
    motion: "morph-ab", exportStrategy: "shapes", fallback: "SIDE_BY_SIDE", mvp: true,
    contract: "2 itens (antes, depois) com label+detail; ou 2-5 linhas com from→to" },
  { id: "FEATURE_COMPARISON", component: "ComparisonDiagram", variant: "features", renderMode: "native", itemShape: "rows",
    intents: ["COMPARE"], layouts: COMPARE, minItems: 3, maxItems: 8, requires: { groups: 2 },
    motion: "split-reveal", exportStrategy: "shapes", fallback: "SIDE_BY_SIDE", domains: ["product", "business", "tech"], mvp: true,
    contract: "3-8 linhas; group=nome do lado (exatamente 2 lados), label=critério, detail" },
  { id: "SCALE_COMPARISON", component: "ComparisonDiagram", variant: "scale", renderMode: "native", itemShape: "metrics",
    intents: ["SHOW_SCALE", "COMPARE", "SHOW_DATA"], layouts: COMPARE, minItems: 2, maxItems: 5, requires: { values: 2 },
    motion: "scale-grow", exportStrategy: "shapes", fallback: "SIDE_BY_SIDE", dataVisual: true, mvp: true,
    contract: "2-5 itens com value numérico comparável (label, value, detail)" },

  // ── Hierarquias ───────────────────────────────────────────────────────
  { id: "FUNNEL", component: "FunnelDiagram", variant: "funnel", renderMode: "native", itemShape: "stages",
    intents: ["SHOW_HIERARCHY", "SHOW_PROCESS", "SHOW_DATA"], layouts: VERTICAL, minItems: 3, maxItems: 6,
    motion: "stack-build", exportStrategy: "shapes", fallback: "SEQUENCE", domains: ["marketing", "business"], mvp: true,
    contract: "3-6 estágios do mais largo ao mais estreito (label, detail, value opcional)" },
  { id: "PYRAMID", component: "PyramidDiagram", variant: "pyramid", renderMode: "native", itemShape: "levels",
    intents: ["SHOW_HIERARCHY", "DECOMPOSE"], layouts: VERTICAL, minItems: 3, maxItems: 6,
    motion: "stack-build", exportStrategy: "shapes", fallback: "SEQUENCE", mvp: true,
    contract: "3-6 níveis do topo à base (label, detail)" },

  // ── Dados (DataScene) ─────────────────────────────────────────────────
  { id: "GROWTH_VISUAL", component: "DataScene", variant: "growth", renderMode: "native", itemShape: "metrics",
    intents: ["SHOW_DATA", "SHOW_EVOLUTION", "SHOW_SCALE"], layouts: DATA, minItems: 2, maxItems: 8, requires: { values: 2 },
    motion: "data-count", exportStrategy: "chart", fallback: null, dataVisual: true, domains: ["finance", "business", "marketing"], mvp: true,
    contract: "2-8 pontos; label=período, value=número real (unit opcional)" },
  { id: "TREND_VISUAL", component: "DataScene", variant: "trend", renderMode: "native", itemShape: "metrics",
    intents: ["SHOW_DATA", "SHOW_EVOLUTION"], layouts: DATA, minItems: 3, maxItems: 8, requires: { values: 3 },
    motion: "data-count", exportStrategy: "chart", fallback: "GROWTH_VISUAL", dataVisual: true, mvp: true,
    contract: "3-8 pontos de uma série; label=período, value=número real" },
  { id: "DATA_SCENE", component: "DataScene", variant: "categories", renderMode: "native", itemShape: "metrics",
    intents: ["SHOW_DATA", "COMPARE", "DECOMPOSE"], layouts: DATA, minItems: 2, maxItems: 6, requires: { values: 2 },
    motion: "data-count", exportStrategy: "chart", fallback: null, dataVisual: true, mvp: true,
    contract: "2-6 categorias; label, value=número real; modifiers: bar | donut" },

  // ── Sistemas (SystemDiagram) ──────────────────────────────────────────
  { id: "SYSTEM_ARCHITECTURE", component: "SystemDiagram", variant: "architecture", renderMode: "native", itemShape: "graph",
    intents: ["DECOMPOSE", "SHOW_RELATIONSHIP", "EXPLAIN"], layouts: SYSTEM, minItems: 3, maxItems: 9, requires: { edges: 1 },
    motion: "system-assemble", exportStrategy: "image", fallback: "LAYERED_VIEW", domains: ["tech", "engineering"], mvp: true,
    contract: "3-9 nós (label, group=camada) + arestas como items {from,to} usando os labels dos nós" },
  { id: "DATA_FLOW", component: "SystemDiagram", variant: "flow", renderMode: "native", itemShape: "graph",
    intents: ["SHOW_PROCESS", "SHOW_RELATIONSHIP"], layouts: SYSTEM, minItems: 3, maxItems: 8, requires: { edges: 1 },
    motion: "system-assemble", exportStrategy: "image", fallback: "PROCESS_FLOW", domains: ["tech"], mvp: true,
    contract: "3-8 nós + arestas {from,to} no sentido do fluxo" },
  { id: "NETWORK_MAP", component: "SystemDiagram", variant: "network", renderMode: "native", itemShape: "graph",
    intents: ["SHOW_RELATIONSHIP"], layouts: SYSTEM, minItems: 3, maxItems: 10, requires: { edges: 2 },
    motion: "system-assemble", exportStrategy: "image", fallback: "CONCEPTUAL_MODEL", mvp: true,
    contract: "3-10 nós + arestas {from,to} entre eles" },

  // ── Conceitos (ConceptMap) ────────────────────────────────────────────
  { id: "CONCEPTUAL_MODEL", component: "ConceptMap", variant: "hub", renderMode: "native", itemShape: "concepts",
    intents: ["EXPLAIN", "SHOW_RELATIONSHIP", "CREATE_METAPHOR", "DECOMPOSE"], layouts: CONCEPT, minItems: 3, maxItems: 7,
    requires: { subject: true }, motion: "hub-radiate", exportStrategy: "shapes", fallback: null, abstraction: "abstract", mvp: true,
    contract: "subject=conceito central; 3-7 ideias ligadas a ele (label, detail)" },

  // ── Gerados / híbridos (MediaVisual) ──────────────────────────────────
  { id: "EXPLODED_VIEW", component: "MediaVisual", variant: "exploded", renderMode: "hybrid", itemShape: "components",
    intents: ["DECOMPOSE", "REVEAL_INTERNAL"], layouts: HYBRID, minItems: 3, maxItems: 8, requires: { subject: true },
    motion: "annotate", imageRecipe: "technical", exportStrategy: "image", fallback: "CONCEPTUAL_MODEL",
    nativeComponent: "ConceptMap", domains: ["engineering", "product", "tech", "medical"], abstraction: "literal", mvp: true,
    contract: "subject=objeto real; 3-8 componentes reais dele (label, detail)" },
  { id: "CUTAWAY", component: "MediaVisual", variant: "cutaway", renderMode: "hybrid", itemShape: "components",
    intents: ["REVEAL_INTERNAL"], layouts: HYBRID, minItems: 2, maxItems: 8, requires: { subject: true },
    motion: "annotate", imageRecipe: "technical", exportStrategy: "image", fallback: "CONCEPTUAL_MODEL",
    nativeComponent: "ConceptMap", domains: ["engineering", "architecture", "science"], abstraction: "literal", mvp: true,
    contract: "subject=objeto; 2-8 partes internas reveladas (label, detail)" },
  { id: "CROSS_SECTION", component: "MediaVisual", variant: "cross-section", renderMode: "hybrid", itemShape: "components",
    intents: ["REVEAL_INTERNAL", "DECOMPOSE"], layouts: HYBRID, minItems: 2, maxItems: 8, requires: { subject: true },
    motion: "annotate", imageRecipe: "technical", exportStrategy: "image", fallback: "LAYERED_VIEW",
    nativeComponent: "LayerStack", domains: ["science", "geography", "medical", "engineering"], abstraction: "literal", mvp: true,
    contract: "subject=objeto; 2-8 camadas de fora para dentro (label, detail)" },
  { id: "X_RAY_VIEW", component: "MediaVisual", variant: "x-ray", renderMode: "hybrid", itemShape: "components",
    intents: ["REVEAL_INTERNAL"], layouts: HYBRID, minItems: 2, maxItems: 8, requires: { subject: true },
    motion: "annotate", imageRecipe: "technical", exportStrategy: "image", fallback: "CONCEPTUAL_MODEL",
    nativeComponent: "ConceptMap", domains: ["medical", "engineering", "product"], abstraction: "literal", mvp: true,
    contract: "subject=objeto; 2-8 partes internas (label, detail)" },
  { id: "LAYERED_VIEW", component: "MediaVisual", variant: "layers", renderMode: "hybrid", itemShape: "levels",
    intents: ["DECOMPOSE", "SHOW_HIERARCHY", "REVEAL_INTERNAL"], layouts: HYBRID, minItems: 2, maxItems: 7,
    motion: "stack-build", imageRecipe: "technical", exportStrategy: "image", fallback: "PYRAMID",
    nativeComponent: "LayerStack", domains: ["tech", "science", "geography"], mvp: true,
    contract: "subject opcional; 2-7 camadas do topo à base (label, detail)" },
  { id: "COMPONENT_MAP", component: "MediaVisual", variant: "components", renderMode: "hybrid", itemShape: "components",
    intents: ["DECOMPOSE"], layouts: HYBRID, minItems: 3, maxItems: 9, requires: { subject: true },
    motion: "annotate", imageRecipe: "technical", exportStrategy: "image", fallback: "CONCEPTUAL_MODEL",
    nativeComponent: "ConceptMap", domains: ["engineering", "product", "tech"], abstraction: "literal", mvp: true,
    contract: "subject=sistema/objeto; 3-9 componentes (label, detail)" },
  { id: "METAPHOR", component: "MediaVisual", variant: "metaphor", renderMode: "generated", itemShape: "media",
    intents: ["CREATE_METAPHOR", "EMPHASIZE"], layouts: MEDIA, minItems: 0, maxItems: 4, requires: { subject: true },
    motion: "focus-pull", imageRecipe: "illustration", exportStrategy: "image", fallback: "CONCEPTUAL_MODEL",
    abstraction: "abstract", mvp: true,
    contract: "subject=metáfora visual concreta em 1 frase (sem texto na imagem)" },
  { id: "SCENARIO", component: "MediaVisual", variant: "scenario", renderMode: "generated", itemShape: "media",
    intents: ["CREATE_SCENARIO", "EMPHASIZE", "EXPLAIN", "SHOW_LOCATION"], layouts: MEDIA, minItems: 0, maxItems: 4, requires: { subject: true },
    motion: "focus-pull", imageRecipe: "scene", photoEligible: true, exportStrategy: "image", fallback: null,
    abstraction: "literal", mvp: true,
    contract: "subject=cena concreta (quem, onde, fazendo o quê)" },
  { id: "HISTORICAL_RECONSTRUCTION", component: "MediaVisual", variant: "reconstruction", renderMode: "generated", itemShape: "media",
    intents: ["RECONSTRUCT", "SHOW_EVOLUTION", "CREATE_SCENARIO"], layouts: MEDIA, minItems: 0, maxItems: 4, requires: { subject: true },
    motion: "focus-pull", imageRecipe: "reconstruction", photoEligible: true, exportStrategy: "image", fallback: "TIMELINE",
    domains: ["history", "architecture"], abstraction: "literal", mvp: true,
    contract: "subject=cena histórica (lugar, época, elementos visíveis)" },
  { id: "HERO_OBJECT", component: "MediaVisual", variant: "hero", renderMode: "generated", itemShape: "media",
    intents: ["EMPHASIZE", "SHOW_SCALE", "EXPLAIN"], layouts: HERO, minItems: 0, maxItems: 4, requires: { subject: true },
    motion: "focus-pull", imageRecipe: "cutout", photoEligible: true, exportStrategy: "image", fallback: null,
    abstraction: "literal", mvp: true,
    contract: "subject=objeto único e literal do tema; items opcionais = destaques" },

  // ── Fase posterior (desligados) ───────────────────────────────────────
  { id: "MAP_VIEW", component: "MediaVisual", variant: "map", renderMode: "native", itemShape: "places",
    intents: ["SHOW_LOCATION"], layouts: SYSTEM, minItems: 1, maxItems: 8,
    motion: "hub-radiate", exportStrategy: "image", fallback: null, domains: ["geography", "history"], mvp: false,
    contract: "locais reais (label, detail)" },
  { id: "ROUTE_MAP", component: "MediaVisual", variant: "route", renderMode: "native", itemShape: "places",
    intents: ["SHOW_LOCATION", "SHOW_PROCESS"], layouts: SYSTEM, minItems: 2, maxItems: 8,
    motion: "connect-draw", exportStrategy: "image", fallback: null, domains: ["geography", "history"], mvp: false,
    contract: "paradas de uma rota real em ordem" },
];

export const VISUAL_COMMAND_IDS: readonly string[] = VISUAL_COMMANDS.map((c) => c.id);
/** Comandos que a IA pode escolher nesta fase. */
export const MVP_COMMAND_IDS: readonly string[] = VISUAL_COMMANDS.filter((c) => c.mvp).map((c) => c.id);

const BY_ID = new Map(VISUAL_COMMANDS.map((c) => [c.id, c]));

export function getCommand(id: unknown): VisualCommandSpec | undefined {
  return typeof id === "string" ? BY_ID.get(id) : undefined;
}

export const isVisualCommand = (v: unknown): boolean => typeof v === "string" && BY_ID.has(v);

/** Comando que precisa de mídia raster (foto ou IA) para ser exibido como planejado. */
export const needsMedia = (spec: VisualCommandSpec): boolean => spec.renderMode !== "native";

/** Irmãos: mesma forma de dados, trocáveis sem reescrever os itens. */
export function siblingsOf(id: string): VisualCommandSpec[] {
  const spec = BY_ID.get(id);
  if (!spec) return [];
  return VISUAL_COMMANDS.filter((c) => c.mvp && c.id !== id && c.itemShape === spec.itemShape);
}

/** Comandos do MVP que atendem uma intenção. */
export function commandsForIntent(intent: VisualIntent): VisualCommandSpec[] {
  return VISUAL_COMMANDS.filter((c) => c.mvp && c.intents.includes(intent));
}
