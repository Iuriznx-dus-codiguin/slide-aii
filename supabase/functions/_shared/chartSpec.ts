// Gráficos do motor principal (v1) — contrato, saneamento e destaque.
//
// O v1 sempre teve `content.chart` (barras, linha, área, pizza, rosca), mas o
// que vinha da IA ia direto para a tela: tipo desconhecido virava pizza,
// listas de tamanhos diferentes desenhavam barras vazias e o gráfico aparecia
// mesmo com "Gráficos & dados" desligado. Do motor v2 vieram as boas ideias do
// DataScene: o número em destaque (o último de uma série, com a variação; o
// maior de um ranking) e a fonte do dado visível. Aqui fica a regra única,
// usada pela geração (servidor), pelo renderer e pela exportação PPTX.
// Módulo puro — Deno e Vite.

import { parseValue } from "./visualBlock.ts";

export const CHART_TYPES = ["bar", "horizontal-bar", "line", "area", "pie", "donut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export interface ChartSpec {
  type: ChartType;
  labels: string[];
  values: number[];
  title?: string;
  /** Unidade dos valores ("%", "mi", "R$", "°C"…). */
  unit?: string;
  /** Fonte e ano do dado ("IBGE, 2023"). */
  source?: string;
}

const MAX_POINTS = 12;
const MAX_SLICES = 8;

const TYPE_ALIASES: Record<string, ChartType> = {
  bar: "bar", bars: "bar", column: "bar", columns: "bar", barras: "bar", colunas: "bar", vertical: "bar",
  "horizontal-bar": "horizontal-bar", horizontal: "horizontal-bar", hbar: "horizontal-bar", barh: "horizontal-bar",
  ranking: "horizontal-bar", "bar-horizontal": "horizontal-bar",
  line: "line", linha: "line", lines: "line",
  area: "area", "área": "area",
  pie: "pie", pizza: "pie", torta: "pie",
  donut: "donut", doughnut: "donut", rosca: "donut", ring: "donut",
};

// eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
const clean = (v: unknown, max: number): string => String(v ?? "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function normalizeChartType(raw: unknown): ChartType {
  const k = clean(raw, 30).toLowerCase().replace(/_/g, "-");
  return TYPE_ALIASES[k] ?? "bar";
}

/**
 * Saneia o gráfico vindo da IA, do chat ou do Editor. Devolve null quando não
 * há dado suficiente para desenhar (menos de 2 pontos numéricos).
 */
export function sanitizeChart(raw: unknown): ChartSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const labelsIn = Array.isArray(r.labels) ? r.labels : [];
  const valuesIn = Array.isArray(r.values) ? r.values : [];
  const labels: string[] = [];
  const values: number[] = [];
  let inferredUnit: string | undefined;
  const n = Math.min(labelsIn.length, valuesIn.length, MAX_POINTS);
  for (let i = 0; i < n; i++) {
    const parsed = parseValue(valuesIn[i]);
    if (parsed.value === undefined) continue;
    labels.push(clean(labelsIn[i], 40) || `${i + 1}`);
    values.push(parsed.value);
    if (!inferredUnit && parsed.unit) inferredUnit = parsed.unit;
  }
  if (values.length < 2) return null;
  let type = normalizeChartType(r.type);
  const total = values.reduce((a, v) => a + v, 0);
  // Pizza/rosca só para partes de um todo: sem negativos, com soma e poucas fatias.
  if ((type === "pie" || type === "donut") && (values.some((v) => v < 0) || total <= 0 || values.length > MAX_SLICES)) {
    type = "horizontal-bar";
  }
  // Muitos rótulos longos numa barra vertical ficam ilegíveis: vira ranking.
  if (type === "bar" && labels.length >= 6 && labels.some((l) => l.length > 14)) type = "horizontal-bar";
  const spec: ChartSpec = { type, labels, values };
  const title = clean(r.title, 80);
  if (title) spec.title = title;
  const unit = clean(r.unit, 8) || inferredUnit;
  if (unit) spec.unit = unit;
  const source = clean(r.source, 120);
  if (source) spec.source = source;
  return spec;
}

const MONTHS = /^(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*\.?(\s*\/?\s*\d{2,4})?$/i;

/** Os rótulos são períodos (anos, meses, trimestres)? Base do destaque de série temporal. */
export function isTemporalLabels(labels: string[]): boolean {
  if (labels.length < 2) return false;
  const temporal = labels.filter((l) => {
    const s = l.trim();
    return /^(1[5-9]|20)\d{2}(\s*[-–/]\s*(\d{2}|\d{4}))?$/.test(s) // 2019, 2019-20
      || /^(q|t)[1-4]([\s/-]*\d{2,4})?$/i.test(s) // Q1, T2 2024
      || /^\d{1,2}[ºo°]?\s*(tri|trim|sem)/i.test(s) // 1º tri
      || /^(s[ée]c(ulo)?\.?\s*)?[ivxlc]+$/i.test(s) // século XV
      || MONTHS.test(s);
  });
  return temporal.length >= Math.ceil(labels.length * 0.7);
}

export interface ChartHighlight {
  value: number;
  label: string;
  /** Série temporal: variação % do primeiro ao último ponto. */
  delta?: number;
  /** Pizza/rosca: participação % da maior fatia. */
  share?: number;
  kind: "latest" | "max" | "share";
}

/**
 * O número em destaque acima do gráfico: o último ponto (e a variação) numa
 * série temporal; o maior valor num ranking/categorias; a maior fatia numa
 * pizza. Nunca compara categorias como se fossem tempo.
 */
export function chartHighlight(chart: ChartSpec | null | undefined): ChartHighlight | null {
  if (!chart || chart.values.length < 2) return null;
  const { values, labels, type } = chart;
  if (type === "pie" || type === "donut") {
    const total = values.reduce((a, v) => a + v, 0);
    if (total <= 0) return null;
    const i = values.indexOf(Math.max(...values));
    return { value: values[i], label: labels[i], share: (values[i] / total) * 100, kind: "share" };
  }
  const series = type === "line" || type === "area" || (type === "bar" && isTemporalLabels(labels));
  if (series) {
    const first = values[0];
    const last = values[values.length - 1];
    const delta = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : undefined;
    return { value: last, label: labels[labels.length - 1], ...(delta !== undefined && Number.isFinite(delta) ? { delta } : {}), kind: "latest" };
  }
  const i = values.indexOf(Math.max(...values));
  return { value: values[i], label: labels[i], kind: "max" };
}

/** 1.234,5 · 45% · R$ 1,2 — formatação pt-BR com a unidade no lugar certo. */
export function formatChartValue(value: number, unit?: string, locale = "pt-BR"): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  const digits = abs >= 100 || Number.isInteger(value) ? 0 : abs >= 10 ? 1 : 2;
  const n = value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  if (!unit) return n;
  if (/^(R\$|US\$|\$|€|£)$/i.test(unit)) return `${unit} ${n}`;
  return unit.length <= 2 && !/^[a-z]/i.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
}

const TYPE_LABEL: Record<ChartType, string> = {
  bar: "Gráfico de barras",
  "horizontal-bar": "Ranking em barras horizontais",
  line: "Gráfico de linha",
  area: "Gráfico de área",
  pie: "Gráfico de pizza",
  donut: "Gráfico de rosca",
};

/** Descrição textual do gráfico para leitores de tela (aria-label). */
export function chartSummary(chart: ChartSpec): string {
  const points = chart.labels
    .map((l, i) => `${l}: ${formatChartValue(chart.values[i], chart.unit)}`)
    .join("; ");
  const title = chart.title ? ` — ${chart.title}` : "";
  const source = chart.source ? `. Fonte: ${chart.source}` : "";
  return `${TYPE_LABEL[chart.type]}${title}. ${points}${source}`;
}

/** Converte o gráfico em bullets (quando o gráfico é removido ou recusado). */
export function chartToBullets(chart: ChartSpec): string[] {
  return chart.labels.slice(0, 6).map((l, i) => `${l}: ${formatChartValue(chart.values[i], chart.unit)}`);
}
