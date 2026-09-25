// Contrato genérico do bloco visual de um slide (motor criativo v2).
//
//   visual: { intent, command, modifiers[], subject,
//             items: [{ label, detail?, value?, icon?, group?, from?, to? }],
//             annotation, composition }
//
// A MESMA lista de items representa etapas, eventos, estágios de funil, nós e
// arestas, lados de comparação, métricas ou componentes de uma vista
// explodida — quem interpreta é o comando (visualCommands.ts). Este módulo
// saneia o que vem da IA/Editor/chat-editor, mede o que os itens de fato
// contêm e valida contra o contrato do comando, sem nunca lançar exceção.

import { isVisualIntent, type VisualIntent } from "./sceneCatalog.ts";
import { isSceneIcon, type SceneIconName } from "./sceneIcons.ts";
import { getCommand, MVP_COMMAND_IDS, type RenderMode, type VisualCommandSpec } from "./visualCommands.ts";

export interface VisualItem {
  label: string;
  detail?: string;
  value?: number;
  /** Unidade do valor ("%", "mi", "R$"…), extraída quando a IA manda "45%". */
  unit?: string;
  icon?: SceneIconName;
  group?: string;
  from?: string;
  to?: string;
}

export interface SceneVisual {
  intent: VisualIntent;
  command: string;
  modifiers?: string[];
  subject?: string;
  items: VisualItem[];
  annotation?: string;
  composition?: string;
  /**
   * Como o bloco é de fato desenhado depois da resolução. Pode divergir do
   * render_mode padrão do comando: um EXPLODED_VIEW sem orçamento de IA é
   * desenhado nativamente (nativeComponent) e fica com render_mode "native".
   */
  render_mode?: RenderMode;
}

const MAX_ITEMS = 12;
const LIMITS = { label: 60, detail: 160, subject: 160, annotation: 200, group: 40, modifier: 24 };

const clean = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  // eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
  const s = String(v).replace(/[\u0000-\u001f]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
};

/** "45%", "R$ 1,2 mi", "3.4k", 12 → { value, unit }. */
export function parseValue(raw: unknown): { value?: number; unit?: string } {
  if (typeof raw === "number") return Number.isFinite(raw) ? { value: raw } : {};
  if (typeof raw !== "string") return {};
  const s = raw.trim();
  const m = s.match(/-?\d[\d.,]*/);
  if (!m) return {};
  let num = m[0];
  // Formato brasileiro (1.234,5) e americano (1,234.5).
  if (/,\d{1,2}$/.test(num) && num.includes(".")) num = num.replace(/\./g, "").replace(",", ".");
  else if (/,\d{1,2}$/.test(num)) num = num.replace(",", ".");
  else num = num.replace(/,/g, "");
  const value = Number(num);
  if (!Number.isFinite(value)) return {};
  const unit = (s.slice(0, m.index).trim() + " " + s.slice((m.index ?? 0) + m[0].length).trim()).trim().slice(0, 8);
  return unit ? { value, unit } : { value };
}

function sanitizeItem(raw: unknown): VisualItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const from = clean(r.from, LIMITS.label);
  const to = clean(r.to, LIMITS.label);
  const label = clean(r.label, LIMITS.label) ?? (from && to ? "" : undefined);
  if (label === undefined) return null;
  const item: VisualItem = { label };
  const detail = clean(r.detail, LIMITS.detail);
  if (detail) item.detail = detail;
  const parsed = parseValue(r.value);
  if (parsed.value !== undefined) item.value = parsed.value;
  const unit = clean(r.unit, 8) ?? parsed.unit;
  if (unit && item.value !== undefined) item.unit = unit;
  if (isSceneIcon(r.icon)) item.icon = r.icon;
  const group = clean(r.group, LIMITS.group);
  if (group) item.group = group;
  if (from) item.from = from;
  if (to) item.to = to;
  return item;
}

/** Saneia um bloco visual vindo de fora. Devolve null se não houver comando conhecido. */
export function sanitizeVisual(raw: unknown): SceneVisual | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const spec = getCommand(typeof r.command === "string" ? r.command.trim().toUpperCase() : r.command);
  if (!spec) return null;
  const items = (Array.isArray(r.items) ? r.items : [])
    .map(sanitizeItem)
    .filter((i): i is VisualItem => i !== null)
    .slice(0, MAX_ITEMS);
  const intent = isVisualIntent(r.intent) ? r.intent : spec.intents[0];
  const visual: SceneVisual = { intent, command: spec.id, items };
  const modifiers = (Array.isArray(r.modifiers) ? r.modifiers : [])
    .map((m) => clean(m, LIMITS.modifier)?.toLowerCase())
    .filter((m): m is string => !!m)
    .slice(0, 4);
  if (modifiers.length) visual.modifiers = Array.from(new Set(modifiers));
  const subject = clean(r.subject, LIMITS.subject);
  if (subject) visual.subject = subject;
  const annotation = clean(r.annotation, LIMITS.annotation);
  if (annotation) visual.annotation = annotation;
  const composition = clean(r.composition, 40);
  if (composition) visual.composition = composition;
  if (r.render_mode === "native" || r.render_mode === "generated" || r.render_mode === "hybrid") {
    visual.render_mode = r.render_mode;
  }
  return visual;
}

export interface ItemAnalysis {
  /** Itens que não são arestas. */
  nodes: VisualItem[];
  /** Arestas válidas (from/to apontam para nós existentes, por label ou índice 1-based). */
  edges: { from: number; to: number; label?: string }[];
  /** Linhas from→to (antes/depois por linha). */
  rows: VisualItem[];
  values: number;
  groups: string[];
}

const keyOf = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function analyzeItems(items: VisualItem[]): ItemAnalysis {
  const nodes = items.filter((i) => !(i.from && i.to));
  const rows = items.filter((i) => i.from && i.to);
  const index = new Map<string, number>();
  nodes.forEach((n, i) => { if (n.label) index.set(keyOf(n.label), i); });
  const ref = (s: string): number | undefined => {
    const byLabel = index.get(keyOf(s));
    if (byLabel !== undefined) return byLabel;
    const n = Number(s);
    return Number.isInteger(n) && n >= 1 && n <= nodes.length ? n - 1 : undefined;
  };
  const edges: ItemAnalysis["edges"] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const from = ref(r.from!);
    const to = ref(r.to!);
    if (from === undefined || to === undefined || from === to) continue;
    const k = `${from}>${to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push(r.label ? { from, to, label: r.label } : { from, to });
  }
  const groups = Array.from(new Set(nodes.map((n) => n.group).filter((g): g is string => !!g)));
  return { nodes, edges, rows, values: nodes.filter((n) => n.value !== undefined).length, groups };
}

export interface CommandCheck {
  ok: boolean;
  reason?: string;
}

/** O bloco cumpre o contrato do comando? */
export function checkCommand(spec: VisualCommandSpec, visual: SceneVisual): CommandCheck {
  const a = analyzeItems(visual.items);
  const req = spec.requires ?? {};
  if (req.subject && !visual.subject) return { ok: false, reason: "sem subject" };
  if (spec.itemShape === "graph") {
    if (a.nodes.length < spec.minItems) return { ok: false, reason: `nós insuficientes (${a.nodes.length})` };
    if (a.edges.length < (req.edges ?? 1)) return { ok: false, reason: `arestas insuficientes (${a.edges.length})` };
    return { ok: true };
  }
  // BEFORE_AFTER aceita tanto 2 lados quanto linhas from→to.
  const count = spec.id === "BEFORE_AFTER" && a.rows.length >= 2 ? a.rows.length : a.nodes.length;
  if (count < spec.minItems) return { ok: false, reason: `itens insuficientes (${count}/${spec.minItems})` };
  if (req.values && a.values < req.values) return { ok: false, reason: `valores numéricos insuficientes (${a.values})` };
  if (req.groups && a.groups.length !== req.groups) return { ok: false, reason: `esperava ${req.groups} grupos (${a.groups.length})` };
  return { ok: true };
}

/** Recorta os itens ao máximo do comando (arestas preservadas nos grafos). */
export function clampItems(spec: VisualCommandSpec, visual: SceneVisual): SceneVisual {
  if (spec.itemShape === "graph") {
    const a = analyzeItems(visual.items);
    if (a.nodes.length <= spec.maxItems) return visual;
    const kept = new Set(a.nodes.slice(0, spec.maxItems).map((n) => keyOf(n.label)));
    const items = visual.items.filter((i) =>
      i.from && i.to ? kept.has(keyOf(i.from)) && kept.has(keyOf(i.to)) : kept.has(keyOf(i.label)),
    );
    return { ...visual, items };
  }
  if (visual.items.length <= spec.maxItems) return visual;
  return { ...visual, items: visual.items.slice(0, spec.maxItems) };
}

export interface ChainResult {
  visual: SceneVisual | null;
  /** Comandos percorridos na cadeia, na ordem ("PIPELINE→SEQUENCE"). */
  fallbacks: string[];
  reason?: string;
}

/**
 * Cadeia de fallback: enquanto o comando não cumprir o contrato (ou não for
 * permitido pelo plano/opções), desce para `fallback`. Termina em null — o
 * slide volta ao layout de texto atual. Nunca produz slide vazio ou quebrado.
 *
 *   PIPELINE com < 3 etapas      → SEQUENCE
 *   SYSTEM_ARCHITECTURE sem aresta → LAYERED_VIEW
 *   dado insuficiente            → null (texto)
 */
export function resolveCommandChain(
  visual: SceneVisual,
  isAllowed: (spec: VisualCommandSpec) => boolean = () => true,
): ChainResult {
  const fallbacks: string[] = [];
  let current: SceneVisual | null = visual;
  let reason: string | undefined;
  const visited = new Set<string>();
  while (current) {
    const spec = getCommand(current.command);
    if (!spec || visited.has(spec.id)) return { visual: null, fallbacks, reason: reason ?? "comando desconhecido" };
    visited.add(spec.id);
    const check = spec.mvp && isAllowed(spec) ? checkCommand(spec, current) : { ok: false, reason: "comando não permitido" };
    if (check.ok) return { visual: clampItems(spec, current), fallbacks, reason };
    reason = `${spec.id}: ${check.reason}`;
    if (!spec.fallback) return { visual: null, fallbacks, reason };
    fallbacks.push(`${spec.id}→${spec.fallback}`);
    current = { ...current, command: spec.fallback };
  }
  return { visual: null, fallbacks, reason };
}

/** Comandos para os quais o bloco atual pode ser trocado no Editor sem reescrever itens. */
export function compatibleCommands(visual: SceneVisual): VisualCommandSpec[] {
  const out: VisualCommandSpec[] = [];
  for (const id of MVP_COMMAND_IDS) {
    const spec = getCommand(id)!;
    if (checkCommand(spec, { ...visual, command: id }).ok) out.push(spec);
  }
  return out;
}
