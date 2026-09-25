// Geometria dos diagramas nativos do motor de cenas (v2) — módulo puro.
//
// Uma geometria só para duas saídas: o SVG/HTML da tela (src/components/scene)
// e os shapes nativos do PPTX (src/lib/exportPptx.ts). Tudo determinístico,
// sem DOM, testável.
//
// Sistema de coordenadas: largura fixa W = 1000 e altura H = 1000 / aspect,
// onde aspect é a proporção do slot de mídia do layout. Caixas em unidades
// desse sistema; o renderer converte para % do slot.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Edge {
  from: number;
  to: number;
  /** Caminho SVG no mesmo sistema de coordenadas. */
  d: string;
  label?: string;
  /** Ponto médio (para rótulo da aresta). */
  mid: { x: number; y: number };
}

export interface DiagramGeometry {
  W: number;
  H: number;
  nodes: Box[];
  edges: Edge[];
  /** Formas extras (faixas do funil, fatias da pirâmide, eixo, placas…). */
  shapes: { d: string; kind: string; index?: number }[];
  orientation?: "horizontal" | "vertical" | "snake";
}

export const W = 1000;

const r1 = (n: number) => Math.round(n * 10) / 10;
export const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Ponto na borda da caixa na direção de `toward` (para conectores que não invadem o nó). */
export function edgePoint(b: Box, toward: { x: number; y: number }, pad = 6): { x: number; y: number } {
  const c = center(b);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = b.w / 2 + pad;
  const hh = b.h / 2 + pad;
  const t = Math.min(Math.abs(hw / (dx || 1e-9)), Math.abs(hh / (dy || 1e-9)));
  return { x: r1(c.x + dx * t), y: r1(c.y + dy * t) };
}

const line = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${r1(a.x)},${r1(a.y)} L${r1(b.x)},${r1(b.y)}`;

function curve(a: { x: number; y: number }, b: { x: number; y: number }, axis: "x" | "y"): string {
  if (axis === "x") {
    const mx = (a.x + b.x) / 2;
    return `M${r1(a.x)},${r1(a.y)} C${r1(mx)},${r1(a.y)} ${r1(mx)},${r1(b.y)} ${r1(b.x)},${r1(b.y)}`;
  }
  const my = (a.y + b.y) / 2;
  return `M${r1(a.x)},${r1(a.y)} C${r1(a.x)},${r1(my)} ${r1(b.x)},${r1(my)} ${r1(b.x)},${r1(b.y)}`;
}

const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: r1((a.x + b.x) / 2), y: r1((a.y + b.y) / 2) });

const heightFor = (aspect: number) => r1(W / Math.max(0.5, Math.min(4, aspect || 16 / 9)));

// ────────────────────────────────────────────────────────────────
// Fluxo / sequência / pipeline
// ────────────────────────────────────────────────────────────────

export function layoutFlow(n: number, aspect: number): DiagramGeometry {
  const H = heightFor(aspect);
  const count = Math.max(1, n);
  const margin = 20;
  const nodes: Box[] = [];
  let orientation: DiagramGeometry["orientation"];

  if (aspect < 1.25) {
    orientation = "vertical";
    const gap = Math.min(40, (H - 2 * margin) * 0.08);
    const h = (H - 2 * margin - gap * (count - 1)) / count;
    for (let i = 0; i < count; i++) nodes.push({ x: 60, y: r1(margin + i * (h + gap)), w: W - 120, h: r1(h) });
  } else if (count >= 5 && aspect < 2.6) {
    orientation = "snake";
    const perRow = Math.ceil(count / 2);
    const gapX = 56;
    const w = (W - 2 * margin - gapX * (perRow - 1)) / perRow;
    const rowH = (H - 2 * margin - 60) / 2;
    for (let i = 0; i < count; i++) {
      const row = i < perRow ? 0 : 1;
      const col = row === 0 ? i : perRow - 1 - (i - perRow);
      nodes.push({ x: r1(margin + col * (w + gapX)), y: r1(margin + row * (rowH + 60)), w: r1(w), h: r1(rowH) });
    }
  } else {
    orientation = "horizontal";
    const gap = count > 4 ? 44 : 64;
    const w = (W - 2 * margin - gap * (count - 1)) / count;
    const h = Math.min(H - 2 * margin, w * 1.15);
    const y = (H - h) / 2;
    for (let i = 0; i < count; i++) nodes.push({ x: r1(margin + i * (w + gap)), y: r1(y), w: r1(w), h: r1(h) });
  }

  const edges: Edge[] = [];
  for (let i = 0; i < count - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const sameRow = Math.abs(a.y - b.y) < 1;
    let d: string;
    let m: { x: number; y: number };
    if (orientation === "vertical") {
      const p = { x: a.x + a.w / 2, y: a.y + a.h + 4 };
      const q = { x: b.x + b.w / 2, y: b.y - 4 };
      d = line(p, q);
      m = mid(p, q);
    } else if (sameRow) {
      const leftToRight = b.x > a.x;
      const p = { x: leftToRight ? a.x + a.w + 6 : a.x - 6, y: a.y + a.h / 2 };
      const q = { x: leftToRight ? b.x - 6 : b.x + b.w + 6, y: b.y + b.h / 2 };
      d = line(p, q);
      m = mid(p, q);
    } else {
      // Virada da cobra: desce pela direita.
      const p = { x: a.x + a.w / 2, y: a.y + a.h + 4 };
      const q = { x: b.x + b.w / 2, y: b.y - 4 };
      d = curve(p, q, "y");
      m = mid(p, q);
    }
    edges.push({ from: i, to: i + 1, d, mid: m });
  }
  return { W, H, nodes, edges, shapes: [], orientation };
}

// ────────────────────────────────────────────────────────────────
// Ciclo
// ────────────────────────────────────────────────────────────────

export function layoutCycle(n: number, aspect: number): DiagramGeometry {
  const H = heightFor(aspect);
  const count = Math.max(2, n);
  const cx = W / 2;
  const cy = H / 2;
  const nodeW = Math.min(W * 0.27, 250);
  const nodeH = Math.min(H * 0.2, 150);
  const rx = W / 2 - nodeW / 2 - 16;
  const ry = H / 2 - nodeH / 2 - 16;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / count;
  const nodes: Box[] = [];
  for (let i = 0; i < count; i++) {
    const a = angle(i);
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    nodes.push({ x: r1(x - nodeW / 2), y: r1(y - nodeH / 2), w: r1(nodeW), h: r1(nodeH) });
  }
  // Arcos na própria elipse, recuados para não invadir os nós.
  const gapAngle = Math.min(0.42, Math.PI / count * 0.55);
  const edges: Edge[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = angle(i) + gapAngle;
    const a1 = angle(i + 1) - gapAngle;
    const p = { x: cx + rx * Math.cos(a0), y: cy + ry * Math.sin(a0) };
    const q = { x: cx + rx * Math.cos(a1), y: cy + ry * Math.sin(a1) };
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M${r1(p.x)},${r1(p.y)} A${r1(rx)},${r1(ry)} 0 ${large} 1 ${r1(q.x)},${r1(q.y)}`;
    const am = (a0 + a1) / 2;
    edges.push({ from: i, to: (i + 1) % count, d, mid: { x: r1(cx + rx * Math.cos(am)), y: r1(cy + ry * Math.sin(am)) } });
  }
  return { W, H, nodes: nodes.slice(0, n), edges: n >= 2 ? edges : [], shapes: [] };
}

// ────────────────────────────────────────────────────────────────
// Linha do tempo
// ────────────────────────────────────────────────────────────────

export function layoutTimeline(n: number, aspect: number): DiagramGeometry {
  const H = heightFor(aspect);
  const count = Math.max(1, n);
  const margin = 40;
  const axisY = H / 2;
  const step = (W - 2 * margin) / count;
  const nodeW = Math.min(step - 16, 260);
  const nodeH = Math.min(axisY - 36, 170);
  const nodes: Box[] = [];
  const shapes: DiagramGeometry["shapes"] = [{ d: line({ x: margin / 2, y: axisY }, { x: W - margin / 2, y: axisY }), kind: "axis" }];
  for (let i = 0; i < count; i++) {
    const x = margin + step * (i + 0.5);
    const above = i % 2 === 0;
    const y = above ? axisY - 24 - nodeH : axisY + 24;
    nodes.push({ x: r1(x - nodeW / 2), y: r1(y), w: r1(nodeW), h: r1(nodeH) });
    shapes.push({ d: line({ x, y: axisY - 10 }, { x, y: axisY + 10 }), kind: "tick", index: i });
    shapes.push({ d: line({ x, y: above ? axisY - 12 : axisY + 12 }, { x, y: above ? y + nodeH : y }), kind: "stem", index: i });
  }
  return { W, H, nodes, edges: [], shapes, orientation: "horizontal" };
}

// ────────────────────────────────────────────────────────────────
// Comparação (lados, linhas, escala)
// ────────────────────────────────────────────────────────────────

export function layoutColumns(k: number, aspect: number, gutter = 48): DiagramGeometry {
  const H = heightFor(aspect);
  const count = Math.max(1, k);
  const margin = 12;
  const w = (W - 2 * margin - gutter * (count - 1)) / count;
  const nodes: Box[] = [];
  for (let i = 0; i < count; i++) nodes.push({ x: r1(margin + i * (w + gutter)), y: margin, w: r1(w), h: r1(H - 2 * margin) });
  return { W, H, nodes, edges: [], shapes: [] };
}

/** Círculos com ÁREA proporcional ao valor, alinhados numa linha de base. */
export function layoutScale(values: number[], aspect: number): DiagramGeometry {
  const H = heightFor(aspect);
  const vals = values.map((v) => Math.max(0, Number.isFinite(v) ? v : 0));
  const max = Math.max(...vals, 1e-9);
  const count = Math.max(1, vals.length);
  const slot = (W - 40) / count;
  const maxD = Math.min(H * 0.72, slot * 0.92);
  const baseY = H * 0.86;
  const nodes = vals.map((v, i) => {
    const d = Math.max(maxD * 0.12, maxD * Math.sqrt(v / max));
    const cx = 20 + slot * (i + 0.5);
    return { x: r1(cx - d / 2), y: r1(baseY - d), w: r1(d), h: r1(d) };
  });
  return { W, H, nodes, edges: [], shapes: [{ d: line({ x: 10, y: baseY }, { x: W - 10, y: baseY }), kind: "baseline" }] };
}

// ────────────────────────────────────────────────────────────────
// Hierarquias: funil, pirâmide, camadas
// ────────────────────────────────────────────────────────────────

export function layoutFunnel(n: number, aspect: number): DiagramGeometry {
  const H = heightFor(aspect);
  const count = Math.max(1, n);
  const top = 12;
  const bottom = H - 12;
  const gap = 8;
  const bandH = (bottom - top - gap * (count - 1)) / count;
  const maxW = W * 0.96;
  const minW = W * 0.34;
  const widthAt = (t: number) => maxW - (maxW - minW) * t;
  const nodes: Box[] = [];
  const shapes: DiagramGeometry["shapes"] = [];
  for (let i = 0; i < count; i++) {
    const y0 = top + i * (bandH + gap);
    const y1 = y0 + bandH;
    const w0 = widthAt(i / count);
    const w1 = widthAt((i + 1) / count);
    const d = `M${r1(W / 2 - w0 / 2)},${r1(y0)} L${r1(W / 2 + w0 / 2)},${r1(y0)} L${r1(W / 2 + w1 / 2)},${r1(y1)} L${r1(W / 2 - w1 / 2)},${r1(y1)} Z`;
    shapes.push({ d, kind: "band", index: i });
    nodes.push({ x: r1(W / 2 - w1 / 2 + 16), y: r1(y0), w: r1(w1 - 32), h: r1(bandH) });
  }
  return { W, H, nodes, edges: [], shapes };
}

export function layoutPyramid(n: number, aspect: number): DiagramGeometry {
  const H = heightFor(aspect);
  const count = Math.max(1, n);
  const top = 10;
  const bottom = H - 10;
  const baseHalf = W * 0.46;
  const gap = 6;
  const bandH = (bottom - top - gap * (count - 1)) / count;
  const halfAt = (y: number) => baseHalf * ((y - top) / (bottom - top));
  const nodes: Box[] = [];
  const shapes: DiagramGeometry["shapes"] = [];
  for (let i = 0; i < count; i++) {
    const y0 = top + i * (bandH + gap);
    const y1 = y0 + bandH;
    const h0 = halfAt(y0);
    const h1 = halfAt(y1);
    const d = i === 0 && h0 < 1
      ? `M${r1(W / 2)},${r1(y0)} L${r1(W / 2 + h1)},${r1(y1)} L${r1(W / 2 - h1)},${r1(y1)} Z`
      : `M${r1(W / 2 - h0)},${r1(y0)} L${r1(W / 2 + h0)},${r1(y0)} L${r1(W / 2 + h1)},${r1(y1)} L${r1(W / 2 - h1)},${r1(y1)} Z`;
    shapes.push({ d, kind: "band", index: i });
    // Texto na parte mais larga da faixa (a de baixo), centralizado.
    const textW = Math.max(W * 0.16, h1 * 2 - 40);
    nodes.push({ x: r1(W / 2 - textW / 2), y: r1(y0 + bandH * (i === 0 ? 0.35 : 0.08)), w: r1(textW), h: r1(bandH * (i === 0 ? 0.62 : 0.86)) });
  }
  return { W, H, nodes, edges: [], shapes };
}

/** Placas isométricas empilhadas (camadas), rótulos à direita. */
export function layoutLayers(n: number, aspect: number): DiagramGeometry {
  const H = heightFor(aspect);
  const count = Math.max(1, n);
  const plateW = W * 0.46;
  const depth = Math.min(90, (H * 0.7) / count);
  const gap = Math.min(40, (H * 0.22) / count);
  const totalH = count * depth + (count - 1) * gap + depth * 0.5;
  const startY = Math.max(10, (H - totalH) / 2);
  const x0 = 24;
  const nodes: Box[] = [];
  const shapes: DiagramGeometry["shapes"] = [];
  for (let i = 0; i < count; i++) {
    const y = startY + i * (depth + gap);
    const skew = depth * 0.5;
    // Face superior (losango achatado) + espessura.
    const top = `M${r1(x0 + skew)},${r1(y)} L${r1(x0 + plateW + skew)},${r1(y)} L${r1(x0 + plateW)},${r1(y + depth * 0.5)} L${r1(x0)},${r1(y + depth * 0.5)} Z`;
    const side = `M${r1(x0)},${r1(y + depth * 0.5)} L${r1(x0 + plateW)},${r1(y + depth * 0.5)} L${r1(x0 + plateW)},${r1(y + depth * 0.5 + 14)} L${r1(x0)},${r1(y + depth * 0.5 + 14)} Z`;
    shapes.push({ d: top, kind: "plate", index: i }, { d: side, kind: "plate-side", index: i });
    const labelX = x0 + plateW + skew + 36;
    nodes.push({ x: r1(labelX), y: r1(y - 6), w: r1(W - labelX - 8), h: r1(depth + 6) });
    shapes.push({ d: line({ x: x0 + plateW + skew * 0.6, y: y + depth * 0.25 }, { x: labelX - 8, y: y + depth * 0.25 }), kind: "leader", index: i });
  }
  return { W, H, nodes, edges: [], shapes };
}

// ────────────────────────────────────────────────────────────────
// Sistemas (grafo em camadas determinístico)
// ────────────────────────────────────────────────────────────────

/**
 * Camadas: pelo `group` quando os nós trazem (ordem de 1ª aparição); senão,
 * caminho mais longo a partir das fontes (grafo acíclico; ciclos são
 * quebrados pela ordem dos itens). Ordem dentro da camada por baricentro
 * (uma passada), estável.
 */
export function layerAssignment(n: number, edges: { from: number; to: number }[], groups?: (string | undefined)[]): number[] {
  if (groups && groups.some(Boolean)) {
    const order: string[] = [];
    for (const g of groups) if (g && !order.includes(g)) order.push(g);
    return groups.map((g) => (g ? order.indexOf(g) : order.length));
  }
  const layer = new Array(n).fill(0);
  // Só arestas "para frente" na ordem dos itens entram na relaxação: garante
  // término mesmo com ciclos.
  const forward = edges.filter((e) => e.from < e.to);
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    for (const e of forward) {
      if (layer[e.to] < layer[e.from] + 1) {
        layer[e.to] = layer[e.from] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return layer;
}

export function layoutSystem(
  n: number,
  edgesIn: { from: number; to: number; label?: string }[],
  aspect: number,
  groups?: (string | undefined)[],
): DiagramGeometry {
  const H = heightFor(aspect);
  const layers = layerAssignment(n, edgesIn, groups);
  const layerCount = Math.max(1, ...layers.map((l) => l + 1));
  const horizontal = aspect >= 1.5; // camadas como colunas em slots largos
  const byLayer: number[][] = Array.from({ length: layerCount }, () => []);
  layers.forEach((l, i) => byLayer[l].push(i));

  // Baricentro: ordena cada camada pela média da posição dos predecessores.
  const pos = new Map<number, number>();
  byLayer[0].forEach((node, k) => pos.set(node, k));
  for (let l = 1; l < layerCount; l++) {
    const withBary = byLayer[l].map((node, k) => {
      const preds = edgesIn.filter((e) => e.to === node && pos.has(e.from)).map((e) => pos.get(e.from)!);
      const bary = preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : k;
      return { node, bary, k };
    });
    withBary.sort((a, b) => a.bary - b.bary || a.k - b.k);
    byLayer[l] = withBary.map((x) => x.node);
    byLayer[l].forEach((node, k) => pos.set(node, k));
  }

  const nodes: Box[] = new Array(n);
  const margin = 16;
  if (horizontal) {
    const colGap = 70;
    const colW = (W - 2 * margin - colGap * (layerCount - 1)) / layerCount;
    byLayer.forEach((col, l) => {
      const rowGap = 26;
      const h = Math.min(130, (H - 2 * margin - rowGap * (col.length - 1)) / Math.max(1, col.length));
      const totalH = col.length * h + (col.length - 1) * rowGap;
      const y0 = (H - totalH) / 2;
      col.forEach((node, k) => {
        nodes[node] = { x: r1(margin + l * (colW + colGap)), y: r1(y0 + k * (h + rowGap)), w: r1(colW), h: r1(h) };
      });
    });
  } else {
    const rowGap = 56;
    const rowH = Math.min(120, (H - 2 * margin - rowGap * (layerCount - 1)) / layerCount);
    byLayer.forEach((row, l) => {
      const colGap = 28;
      const w = Math.min(280, (W - 2 * margin - colGap * (row.length - 1)) / Math.max(1, row.length));
      const totalW = row.length * w + (row.length - 1) * colGap;
      const x0 = (W - totalW) / 2;
      const y = margin + l * (rowH + rowGap) + (H - 2 * margin - layerCount * rowH - (layerCount - 1) * rowGap) / 2;
      row.forEach((node, k) => {
        nodes[node] = { x: r1(x0 + k * (w + colGap)), y: r1(y), w: r1(w), h: r1(rowH) };
      });
    });
  }

  const edges: Edge[] = edgesIn.map((e) => {
    const a = nodes[e.from];
    const b = nodes[e.to];
    const p = edgePoint(a, center(b));
    const q = edgePoint(b, center(a));
    return { from: e.from, to: e.to, d: curve(p, q, horizontal ? "x" : "y"), label: e.label, mid: mid(p, q) };
  });
  return { W, H, nodes, edges, shapes: [], orientation: horizontal ? "horizontal" : "vertical" };
}

// ────────────────────────────────────────────────────────────────
// Mapa conceitual (hub + satélites)
// ────────────────────────────────────────────────────────────────

export function layoutConcept(n: number, aspect: number): DiagramGeometry & { hub: Box } {
  const H = heightFor(aspect);
  const count = Math.max(1, n);
  const hubW = Math.min(W * 0.28, 290);
  const hubH = Math.min(H * 0.24, 150);
  const hub: Box = { x: r1(W / 2 - hubW / 2), y: r1(H / 2 - hubH / 2), w: r1(hubW), h: r1(hubH) };
  const satW = Math.min(W * 0.25, 240);
  const satH = Math.min(H * 0.19, 120);
  const rx = W / 2 - satW / 2 - 12;
  const ry = H / 2 - satH / 2 - 12;
  const nodes: Box[] = [];
  const edges: Edge[] = [];
  // Distribuição a partir das 10h para não empilhar tudo no topo.
  for (let i = 0; i < count; i++) {
    const a = -Math.PI * 0.75 + (i * 2 * Math.PI) / count;
    const x = W / 2 + rx * Math.cos(a);
    const y = H / 2 + ry * Math.sin(a);
    const box = { x: r1(x - satW / 2), y: r1(y - satH / 2), w: r1(satW), h: r1(satH) };
    nodes.push(box);
    const p = edgePoint(hub, center(box));
    const q = edgePoint(box, center(hub));
    edges.push({ from: -1, to: i, d: line(p, q), mid: mid(p, q) });
  }
  return { W, H, nodes, edges, shapes: [], hub };
}

/** Converte uma caixa em estilo CSS (% do slot). */
export function boxToPercent(b: Box, geo: { W: number; H: number }) {
  return {
    left: `${(b.x / geo.W) * 100}%`,
    top: `${(b.y / geo.H) * 100}%`,
    width: `${(b.w / geo.W) * 100}%`,
    height: `${(b.h / geo.H) * 100}%`,
  };
}
