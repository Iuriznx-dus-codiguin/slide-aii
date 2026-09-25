// Modelo normalizado de um bloco visual (motor v2) — módulo puro.
//
// Traduz `content.visual` (contrato genérico da IA) para o que um componente
// de desenho precisa: componente efetivo (o nativo, quando a mídia faltou),
// nós, arestas, valores e as contagens de trilhas do movimento. Usado pela
// tela (src/components/scene) e pelo export PPTX — a mesma leitura dos dados.

import { analyzeItems, type SceneVisual, type VisualItem } from "../../../supabase/functions/_shared/visualBlock.ts";
import { getCommand, type VisualComponent, type VisualCommandSpec } from "../../../supabase/functions/_shared/visualCommands.ts";

export interface VisualModel {
  spec: VisualCommandSpec;
  /** Componente que desenha de fato (o nativo quando render_mode = native). */
  component: VisualComponent;
  variant: string;
  /** O bloco depende de mídia raster (foto/IA) para ser exibido como planejado. */
  media: boolean;
  nodes: VisualItem[];
  edges: { from: number; to: number; label?: string }[];
  rows: VisualItem[];
  groups: string[];
  values: number[];
  counts: { items: number; edges: number; shapes: number };
}

/**
 * Proporção (largura/altura) do slot de mídia de cada layout, medida no
 * slide 1920×1080 com o padding padrão. Base da geometria dos diagramas.
 */
export const SLOT_ASPECT: Record<string, number> = {
  "visual-hero": 1.18,
  "diagram-full": 2.7,
  "image-left": 0.95,
  "image-right": 0.95,
  "full-image": 16 / 9,
  "title-content": 3.1,
  "two-columns": 1.12,
};

export const slotAspectFor = (layout: string | null | undefined): number => SLOT_ASPECT[layout ?? ""] ?? 1.18;

export function buildVisualModel(visual: SceneVisual | null | undefined, forceNative = false): VisualModel | null {
  if (!visual) return null;
  const spec = getCommand(visual.command);
  if (!spec) return null;
  const native = forceNative || visual.render_mode === "native";
  const media = spec.renderMode !== "native" && !native;
  const component: VisualComponent = spec.renderMode !== "native" && native && spec.nativeComponent ? spec.nativeComponent : spec.component;
  const a = analyzeItems(visual.items ?? []);
  const nodes = a.nodes;
  const values = nodes.map((n) => (typeof n.value === "number" ? n.value : NaN));
  let edges = a.edges;
  let shapes = 0;
  switch (component) {
    case "FlowDiagram": edges = nodes.slice(1).map((_, i) => ({ from: i, to: i + 1 })); break;
    case "CycleDiagram": edges = nodes.length >= 2 ? nodes.map((_, i) => ({ from: i, to: (i + 1) % nodes.length })) : []; break;
    case "ConceptMap": edges = nodes.map((_, i) => ({ from: -1, to: i })); break;
    case "TimelineDiagram": shapes = nodes.length; edges = []; break;
    case "FunnelDiagram":
    case "PyramidDiagram":
    case "LayerStack": shapes = nodes.length; edges = []; break;
    case "SystemDiagram": break;
    default: edges = [];
  }
  // Antes/depois em linhas from→to: cada linha é um "item" animado.
  const rowMode = component === "ComparisonDiagram" && spec.variant === "before-after" && a.rows.length >= 2;
  return {
    spec,
    component,
    variant: spec.variant,
    media,
    nodes,
    edges,
    rows: a.rows,
    groups: a.groups,
    values,
    counts: { items: rowMode ? a.rows.length : nodes.length, edges: edges.length, shapes },
  };
}

/** Formata um valor para exibição (1.234,5 no pt-BR; unidade colada). */
export function formatValue(value: number | undefined, unit?: string, locale = "pt-BR"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  const digits = abs >= 100 || Number.isInteger(value) ? 0 : 1;
  const n = value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  if (!unit) return n;
  return /^[%a-zà-ú]/i.test(unit) && unit !== "R$" && unit !== "US$" ? `${n}${unit.length <= 2 ? "" : " "}${unit}` : `${unit} ${n}`;
}
