// Client-side PPTX export using pptxgenjs.
// Renders slide content as native PowerPoint shapes (text + image) so the file
// can be edited inside PowerPoint/Keynote afterwards.
//
// Motor v2 (slides com bloco visual):
//   • visuais nativos simples (fluxo, ciclo, linha do tempo, comparação,
//     funil, pirâmide, mapa conceitual) saem como SHAPES do pptxgenjs, a partir
//     da MESMA geometria da tela (src/lib/scene/diagramLayout) — editáveis;
//   • visuais de dados saem como gráfico nativo;
//   • visuais complexos (sistemas, camadas, mídia/híbridos) saem como IMAGEM
//     do bloco (rasterizado com fallbacks estáticos), com o texto em caixas
//     nativas.
// O tema vem da APRESENTAÇÃO (presentations.dynamic_theme). Antes vinha de
// slides[0].content.dynamic_theme, que as gerações novas não gravam — o PPTX
// saía com o tema padrão.
import pptxgen from "pptxgenjs";
import { resolveTheme, type ThemeColors } from "@/lib/slugify";
import type { CreativeBrief } from "@/lib/creativeBrief";
import { buildVisualModel, type VisualModel } from "@/lib/scene/visualModel";
import {
  center, edgePoint, layoutColumns, layoutConcept, layoutCycle, layoutFlow, layoutFunnel, layoutPyramid,
  layoutScale, layoutTimeline, type Box, type DiagramGeometry,
} from "@/lib/scene/diagramLayout";
import { formatValue } from "@/lib/scene/visualModel";
import { mix, readableOn } from "@/lib/scene/color";
import { rasterizeSceneSlot, SLIDE_W, SLIDE_H } from "@/lib/exportRaster";
import { isSceneContent, isCoverSlide } from "../../supabase/functions/_shared/sceneMedia.ts";

interface SlideRow {
  position: number;
  slide_type: string;
  layout_template: string | null;
  speaker_notes?: string | null;
  content: any;
}

interface ExportOpts {
  title: string;
  themeId: string;
  slides: SlideRow[];
  /** Tema da apresentação (presentations.dynamic_theme). */
  dynamicTheme?: Partial<ThemeColors> | null;
  fontId?: string;
  creativeBrief?: CreativeBrief | null;
}

const hexNoHash = (h: string) => (h || "#000000").replace("#", "").slice(0, 6);

// ────────────────────────────────────────────────────────────────
// Slots do compositor de cenas em polegadas (LAYOUT_WIDE 13.333 × 7.5),
// espelhando a grade de 12 colunas do SceneSlide.
// ────────────────────────────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }
const SW = 13.333;
const SH = 7.5;
const PAD = 0.62;
const GAP = 0.4;
const IW = SW - 2 * PAD;
const IH = SH - 2 * PAD;
const COL = (IW - 11 * GAP) / 12;
const span = (n: number) => n * COL + (n - 1) * GAP;
const colX = (k: number) => PAD + k * (COL + GAP);

export function sceneSlots(layout: string, index: number): { text: Rect; visual: Rect } {
  switch (layout) {
    case "diagram-full":
      return { text: { x: PAD, y: PAD, w: IW, h: IH * 0.26 }, visual: { x: PAD, y: PAD + IH * 0.3, w: IW, h: IH * 0.7 } };
    case "title-content":
      return { text: { x: PAD, y: PAD, w: IW, h: IH * 0.36 }, visual: { x: PAD, y: PAD + IH * 0.4, w: IW, h: IH * 0.6 } };
    case "image-left":
      return { visual: { x: colX(0), y: PAD, w: span(6), h: IH }, text: { x: colX(6), y: PAD, w: span(6), h: IH } };
    case "image-right":
      return { text: { x: colX(0), y: PAD, w: span(6), h: IH }, visual: { x: colX(6), y: PAD, w: span(6), h: IH } };
    case "two-columns":
      return { text: { x: colX(0), y: PAD, w: span(5), h: IH }, visual: { x: colX(5), y: PAD, w: span(7), h: IH } };
    case "full-image":
      return { visual: { x: 0, y: 0, w: SW, h: SH }, text: { x: PAD, y: SH * 0.55, w: SW * 0.6, h: SH * 0.38 } };
    case "visual-hero":
    default: {
      const visualFirst = index % 2 === 1;
      return visualFirst
        ? { visual: { x: colX(0), y: PAD, w: span(8), h: IH }, text: { x: colX(8), y: PAD, w: span(4), h: IH } }
        : { text: { x: colX(0), y: PAD, w: span(4), h: IH }, visual: { x: colX(4), y: PAD, w: span(8), h: IH } };
    }
  }
}

const SCENE_LAYOUTS = new Set(["visual-hero", "diagram-full", "image-left", "image-right", "full-image", "title-content", "two-columns"]);

// ────────────────────────────────────────────────────────────────
// Desenho nativo
// ────────────────────────────────────────────────────────────────

/** Converte geometria (W=1000) para polegadas dentro do slot. */
function mapper(geo: Pick<DiagramGeometry, "W" | "H">, slot: Rect) {
  const sx = slot.w / geo.W;
  const sy = slot.h / geo.H;
  return {
    box: (b: Box): Rect => ({ x: slot.x + b.x * sx, y: slot.y + b.y * sy, w: Math.max(0.05, b.w * sx), h: Math.max(0.05, b.h * sy) }),
    pt: (p: { x: number; y: number }) => ({ x: slot.x + p.x * sx, y: slot.y + p.y * sy }),
  };
}

function addLine(slide: any, pptx: any, a: { x: number; y: number }, b: { x: number; y: number }, color: string, arrow = true) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(0.01, Math.abs(b.x - a.x));
  const h = Math.max(0.01, Math.abs(b.y - a.y));
  try {
    slide.addShape(pptx.ShapeType.line, {
      x, y, w, h,
      flipH: b.x < a.x,
      flipV: b.y < a.y,
      line: { color: hexNoHash(color), width: 1.75, ...(arrow ? { endArrowType: "triangle" } : {}) },
    });
  } catch { /* forma opcional */ }
}

function nodeText(item: { label: string; detail?: string; value?: number; unit?: string }, textColor: string, accent: string, number?: number) {
  const runs: any[] = [];
  if (number !== undefined) runs.push({ text: `${number}  `, options: { bold: true, color: hexNoHash(accent), fontSize: 12 } });
  runs.push({ text: item.label, options: { bold: true, color: hexNoHash(textColor), fontSize: 13, breakLine: !!(item.detail || item.value !== undefined) } });
  const value = formatValue(item.value, item.unit);
  if (value) runs.push({ text: value, options: { bold: true, color: hexNoHash(accent), fontSize: 13, breakLine: !!item.detail } });
  if (item.detail) runs.push({ text: item.detail, options: { color: hexNoHash(textColor), fontSize: 10 } });
  return runs;
}

function addNode(slide: any, pptx: any, r: Rect, item: any, theme: ThemeColors, opts: { number?: number; fill?: string; plain?: boolean; align?: "left" | "center" } = {}) {
  const fill = opts.fill;
  const textColor = fill ? readableOn(fill) : theme.text;
  slide.addText(nodeText(item, textColor, fill ? textColor : theme.accent, opts.number), {
    x: r.x, y: r.y, w: r.w, h: r.h,
    shape: opts.plain ? undefined : pptx.ShapeType.roundRect,
    rectRadius: 0.08,
    fill: opts.plain ? undefined : fill ? { color: hexNoHash(fill) } : { color: hexNoHash(mix(theme.bg, theme.text, 0.06)) },
    line: opts.plain || fill ? undefined : { color: hexNoHash(mix(theme.bg, theme.accent, 0.45)), width: 1 },
    valign: "middle",
    align: opts.align ?? "left",
    margin: 6,
    fontFace: "Calibri",
    fit: "shrink",
  });
}

/** Desenha o visual com shapes nativos. Devolve false se o comando não tem desenho nativo simples. */
function drawNativeVisual(slide: any, pptx: any, model: VisualModel, visual: any, slot: Rect, theme: ThemeColors): boolean {
  const aspect = slot.w / slot.h;
  const n = model.nodes.length;
  switch (model.component) {
    case "FlowDiagram": {
      const geo = layoutFlow(n, aspect);
      const m = mapper(geo, slot);
      geo.edges.forEach((e) => {
        const a = geo.nodes[e.from], b = geo.nodes[e.to];
        addLine(slide, pptx, m.pt(edgePoint(a, center(b))), m.pt(edgePoint(b, center(a))), theme.accent);
      });
      const numbered = model.variant === "steps" || model.variant === "pipeline";
      model.nodes.forEach((item, i) => addNode(slide, pptx, m.box(geo.nodes[i]), item, theme, { number: numbered ? i + 1 : undefined }));
      return true;
    }
    case "CycleDiagram": {
      const geo = layoutCycle(n, aspect);
      const m = mapper(geo, slot);
      for (let i = 0; i < n && n >= 2; i++) {
        const a = geo.nodes[i], b = geo.nodes[(i + 1) % n];
        addLine(slide, pptx, m.pt(edgePoint(a, center(b), 10)), m.pt(edgePoint(b, center(a), 10)), theme.accent);
      }
      model.nodes.forEach((item, i) => addNode(slide, pptx, m.box(geo.nodes[i]), item, theme, { align: "center" }));
      return true;
    }
    case "TimelineDiagram": {
      const geo = layoutTimeline(n, aspect);
      const m = mapper(geo, slot);
      const y = geo.H / 2;
      addLine(slide, pptx, m.pt({ x: 20, y }), m.pt({ x: geo.W - 20, y }), theme.accent, false);
      model.nodes.forEach((item, i) => {
        const b = geo.nodes[i];
        const c = m.pt({ x: b.x + b.w / 2, y });
        slide.addShape(pptx.ShapeType.ellipse, { x: c.x - 0.09, y: c.y - 0.09, w: 0.18, h: 0.18, fill: { color: hexNoHash(theme.accent) }, line: { color: hexNoHash(theme.bg), width: 2 } });
        addNode(slide, pptx, m.box(b), item, theme, { plain: true, align: "center" });
      });
      return true;
    }
    case "ComparisonDiagram": {
      if (model.variant === "scale") {
        const values = model.nodes.map((x) => x.value ?? 0);
        const geo = layoutScale(values, aspect);
        const m = mapper(geo, slot);
        model.nodes.forEach((item, i) => {
          const r = m.box(geo.nodes[i]);
          const d = Math.min(r.w, r.h);
          slide.addText(formatValue(item.value, item.unit), {
            x: r.x + (r.w - d) / 2, y: r.y + (r.h - d), w: d, h: d, shape: pptx.ShapeType.ellipse,
            fill: { color: hexNoHash(theme.accent), transparency: 35 }, color: hexNoHash(readableOn(theme.accent)),
            bold: true, fontSize: 16, align: "center", valign: "middle", fontFace: "Calibri",
          });
          slide.addText(item.label, { x: r.x, y: slot.y + slot.h * 0.88, w: r.w, h: 0.4, align: "center", fontSize: 12, bold: true, color: hexNoHash(theme.text), fontFace: "Calibri" });
        });
        return true;
      }
      if (model.variant === "before-after" && model.rows.length >= 2) {
        const rowH = Math.min(0.9, slot.h / model.rows.length);
        model.rows.forEach((row, i) => {
          const y = slot.y + i * rowH;
          slide.addText(row.from ?? "", { x: slot.x, y, w: slot.w * 0.42, h: rowH * 0.9, fontSize: 13, color: hexNoHash(mix(theme.text, theme.bg, 0.4)), strike: true, fontFace: "Calibri", valign: "middle" });
          addLine(slide, pptx, { x: slot.x + slot.w * 0.45, y: y + rowH * 0.45 }, { x: slot.x + slot.w * 0.53, y: y + rowH * 0.45 }, theme.accent);
          slide.addText(row.to ?? "", { x: slot.x + slot.w * 0.56, y, w: slot.w * 0.44, h: rowH * 0.9, fontSize: 13, bold: true, color: hexNoHash(theme.text), fontFace: "Calibri", valign: "middle" });
        });
        return true;
      }
      if (model.variant === "features") {
        const sides = model.groups.slice(0, 2);
        const geo = layoutColumns(2, aspect, 60);
        const m = mapper(geo, slot);
        sides.forEach((side, s) => {
          const r = m.box(geo.nodes[s]);
          const items = model.nodes.filter((x) => x.group === side);
          slide.addText([
            { text: side.toUpperCase(), options: { bold: true, color: hexNoHash(s === 0 ? theme.accent : theme.accent2 || theme.accent), fontSize: 11, breakLine: true } },
            ...items.flatMap((it) => [
              { text: it.label, options: { bold: true, fontSize: 13, color: hexNoHash(theme.text), bullet: true, breakLine: !it.detail } },
              ...(it.detail ? [{ text: it.detail, options: { fontSize: 10, color: hexNoHash(theme.text), breakLine: true } }] : []),
            ]),
          ], { x: r.x, y: r.y, w: r.w, h: r.h, valign: "top", fontFace: "Calibri", fit: "shrink" });
        });
        return true;
      }
      const sides = model.nodes.slice(0, model.variant === "before-after" ? 2 : 3);
      const geo = layoutColumns(sides.length, aspect, sides.length === 2 ? 120 : 56);
      const m = mapper(geo, slot);
      sides.forEach((item, i) => addNode(slide, pptx, m.box(geo.nodes[i]), item, theme, { fill: i === 1 && model.variant === "before-after" ? theme.accent : undefined }));
      return true;
    }
    case "FunnelDiagram":
    case "PyramidDiagram": {
      const geo = model.component === "FunnelDiagram" ? layoutFunnel(n, aspect) : layoutPyramid(n, aspect);
      const m = mapper(geo, slot);
      const accent2 = theme.accent2 || mix(theme.accent, theme.bg, 0.45);
      model.nodes.forEach((item, i) => {
        const b = geo.nodes[i];
        // Faixa escalonada (retângulo com a largura média da faixa): editável.
        const band = { x: b.x - 16, y: b.y, w: b.w + 32, h: b.h };
        const fill = mix(theme.accent, accent2, i / Math.max(1, n - 1));
        addNode(slide, pptx, m.box(band), item, theme, { fill, align: "center" });
      });
      return true;
    }
    case "ConceptMap": {
      const geo = layoutConcept(n, aspect);
      const m = mapper(geo, slot);
      model.nodes.forEach((_, i) => {
        const b = geo.nodes[i];
        addLine(slide, pptx, m.pt(edgePoint(geo.hub, center(b))), m.pt(edgePoint(b, center(geo.hub))), theme.accent, false);
      });
      const hub = m.box(geo.hub);
      slide.addText(visual?.subject ?? "", {
        x: hub.x, y: hub.y, w: hub.w, h: hub.h, shape: pptx.ShapeType.ellipse,
        fill: { color: hexNoHash(theme.accent) }, color: hexNoHash(readableOn(theme.accent)), bold: true, fontSize: 15,
        align: "center", valign: "middle", fontFace: "Calibri", fit: "shrink",
      });
      model.nodes.forEach((item, i) => addNode(slide, pptx, m.box(geo.nodes[i]), item, theme, { align: "center" }));
      return true;
    }
    case "DataScene": {
      const data = model.nodes.filter((x) => typeof x.value === "number");
      if (!data.length) return false;
      const donut = (visual?.modifiers ?? []).some((x: string) => x === "donut" || x === "pie");
      const type = model.variant === "trend" ? pptx.ChartType.area : donut ? pptx.ChartType.doughnut : pptx.ChartType.bar;
      try {
        slide.addChart(type, [{ name: visual?.subject || "Dados", labels: data.map((x) => x.label), values: data.map((x) => x.value) }], {
          x: slot.x, y: slot.y, w: slot.w, h: slot.h,
          chartColors: [hexNoHash(theme.accent), hexNoHash(theme.accent2 || "#F59E0B")],
          showLegend: donut,
          catAxisLabelColor: hexNoHash(theme.text),
          valAxisLabelColor: hexNoHash(theme.text),
        });
      } catch (e) {
        console.warn("chart add failed", e);
      }
      return true;
    }
    default:
      return false;
  }
}

function addSceneText(slide: any, c: any, r: Rect, theme: ThemeColors, opts: { hero?: boolean; showBullets?: boolean; color?: string }) {
  const color = hexNoHash(opts.color ?? theme.text);
  const runs: any[] = [
    { text: c.headline || "", options: { bold: true, fontSize: opts.hero ? 34 : 28, color, breakLine: true } },
  ];
  if (c.subtitle) runs.push({ text: c.subtitle, options: { fontSize: 15, color, breakLine: true } });
  if (c.body_text) runs.push({ text: c.body_text, options: { fontSize: 12, color, breakLine: true } });
  if (opts.showBullets !== false && Array.isArray(c.bullets)) {
    for (const b of c.bullets) runs.push({ text: b, options: { fontSize: 12, color, bullet: true, breakLine: true } });
  }
  slide.addShape("rect" as any, { x: r.x, y: r.y + 0.05, w: 0.45, h: 0.06, fill: { color: hexNoHash(theme.accent) }, line: { type: "none" } as any });
  slide.addText(runs, { x: r.x, y: r.y + 0.2, w: r.w, h: r.h - 0.2, valign: "middle", fontFace: "Calibri", fit: "shrink", paraSpaceAfter: 6 });
}

async function exportSceneSlide(pptx: any, slide: any, s: SlideRow, index: number, theme: ThemeColors, opts: ExportOpts) {
  const c = s.content || {};
  const model = buildVisualModel(c.visual);
  const layout = SCENE_LAYOUTS.has(s.layout_template ?? "") ? (s.layout_template as string) : "visual-hero";
  const slots = sceneSlots(layout, index);
  const hasImage = !!c.image_url;

  if (model && model.media && hasImage) {
    // Mídia: foto/recorte como imagem nativa; legenda do híbrido como texto.
    const cutout = model.spec.imageRecipe === "cutout" || model.spec.imageRecipe === "technical";
    const legend = model.spec.renderMode === "hybrid" && model.nodes.length > 0;
    const img: Rect = legend ? { ...slots.visual, w: slots.visual.w * 0.62 } : slots.visual;
    try {
      slide.addImage({ path: c.image_url, x: img.x, y: img.y, w: img.w, h: img.h, sizing: { type: cutout ? "contain" : "cover", w: img.w, h: img.h } });
    } catch { /* imagem indisponível */ }
    if (legend) {
      const lx = img.x + img.w + 0.3;
      slide.addText(
        model.nodes.flatMap((it, i) => [
          { text: `${i + 1}  `, options: { bold: true, color: hexNoHash(theme.accent), fontSize: 13 } },
          { text: it.label, options: { bold: true, fontSize: 13, color: hexNoHash(theme.text), breakLine: !it.detail } },
          ...(it.detail ? [{ text: ` — ${it.detail}`, options: { fontSize: 10, color: hexNoHash(theme.text), breakLine: true } }] : []),
        ]),
        { x: lx, y: slots.visual.y, w: slots.visual.x + slots.visual.w - lx, h: slots.visual.h, valign: "middle", fontFace: "Calibri", fit: "shrink" },
      );
    }
  } else if (model && !drawNativeVisual(slide, pptx, model.media ? buildVisualModel(c.visual, true) ?? model : model, c.visual, slots.visual, theme)) {
    // Complexo (sistemas, camadas, cartões): imagem do bloco com o texto
    // em caixa nativa.
    try {
      const raster = await rasterizeSceneSlot(s, { themeId: opts.themeId, fontId: opts.fontId ?? "modern-sans", dynamicTheme: opts.dynamicTheme, creativeBrief: opts.creativeBrief, index });
      if (raster) {
        slide.addImage({
          data: raster.dataUrl,
          x: (raster.rect.x / SLIDE_W) * SW,
          y: (raster.rect.y / SLIDE_H) * SH,
          w: (raster.rect.w / SLIDE_W) * SW,
          h: (raster.rect.h / SLIDE_H) * SH,
        });
      }
    } catch (e) {
      console.warn("visual raster failed", e);
    }
  }

  const fullBleed = layout === "full-image" && model?.media && hasImage;
  if (fullBleed) {
    slide.addShape("rect" as any, { x: 0, y: SH * 0.5, w: SW, h: SH * 0.5, fill: { color: "000000", transparency: 45 }, line: { type: "none" } as any });
  }
  const showBullets = layout !== "diagram-full" && layout !== "title-content";
  addSceneText(slide, c, slots.text, theme, { hero: !!fullBleed, showBullets, color: fullBleed ? "#FFFFFF" : undefined });
}

export async function exportPresentationToPptx({ title, themeId, slides, dynamicTheme, fontId, creativeBrief }: ExportOpts) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches (16:9)
  pptx.title = title;
  pptx.company = "SlideAI";

  // Tema da apresentação; o de slides[0].content fica só para decks antigos.
  const theme: ThemeColors = resolveTheme(themeId, dynamicTheme ?? slides[0]?.content?.dynamic_theme ?? null);

  for (let index = 0; index < slides.length; index++) {
    const s = slides[index];
    const c = s.content || {};
    const layout = s.layout_template || "title-content";
    const slide = pptx.addSlide();
    slide.background = { color: hexNoHash(theme.bg) };

    if (s.speaker_notes) slide.addNotes(s.speaker_notes);

    // Motor v2: cena com bloco visual.
    if (isSceneContent(c) && c.visual && !isCoverSlide(s)) {
      await exportSceneSlide(pptx, slide, s, index, theme, { title, themeId, slides, dynamicTheme, fontId, creativeBrief });
      continue;
    }

    // Layout dispatch — kept simple so the result reads cleanly in PowerPoint.
    if (layout === "title-only" || s.slide_type === "title_slide" || layout === "split-hero") {
      slide.addShape("rect" as any, { x: 0.5, y: 1.2, w: 0.5, h: 0.08, fill: { color: hexNoHash(theme.accent) } });
      slide.addText(c.headline || title, {
        x: 0.5, y: 1.5, w: 12, h: 3,
        fontSize: 60, bold: true, color: hexNoHash(theme.text),
        fontFace: "Calibri", valign: "top",
      });
      if (c.subtitle) {
        slide.addText(c.subtitle, {
          x: 0.5, y: 4.6, w: 11, h: 1.5,
          fontSize: 24, color: hexNoHash(theme.text), transparency: 20,
          fontFace: "Calibri",
        });
      }
      if (c.image_url && layout === "split-hero") {
        try { slide.addImage({ path: c.image_url, x: 7, y: 0, w: 6.33, h: 7.5, sizing: { type: "cover", w: 6.33, h: 7.5 } }); } catch {}
      }
      continue;
    }

    if (s.slide_type === "quote" || layout === "quote") {
      slide.addText(`"${c.quote_text || c.headline || ""}"`, {
        x: 1, y: 2, w: 11.33, h: 3,
        fontSize: 36, italic: true, color: hexNoHash(theme.text),
        align: "center", valign: "middle", fontFace: "Calibri",
      });
      if (c.quote_author) {
        slide.addText(`— ${c.quote_author}`, {
          x: 1, y: 5.2, w: 11.33, h: 0.6,
          fontSize: 18, color: hexNoHash(theme.accent), align: "center",
        });
      }
      continue;
    }

    if (layout === "stat-highlight" && c.stat_value) {
      if (c.subtitle) slide.addText(c.subtitle, { x: 1, y: 1.5, w: 11.33, h: 0.5, fontSize: 14, color: hexNoHash(theme.text), align: "center", transparency: 40, charSpacing: 8 });
      slide.addText(c.stat_value, { x: 1, y: 2, w: 11.33, h: 3, fontSize: 200, bold: true, color: hexNoHash(theme.accent), align: "center", valign: "middle" });
      slide.addText(c.stat_label || c.headline || "", { x: 1, y: 5.5, w: 11.33, h: 1, fontSize: 22, color: hexNoHash(theme.text), align: "center" });
      continue;
    }

    if (layout === "full-image" && c.image_url) {
      try { slide.addImage({ path: c.image_url, x: 0, y: 0, w: 13.33, h: 7.5, sizing: { type: "cover", w: 13.33, h: 7.5 } }); } catch {}
      slide.addShape("rect" as any, { x: 0, y: 4, w: 13.33, h: 3.5, fill: { color: hexNoHash(theme.bg), transparency: 30 }, line: { type: "none" } as any });
      slide.addText(c.headline || "", { x: 0.5, y: 4.5, w: 12.33, h: 1.5, fontSize: 40, bold: true, color: hexNoHash(theme.text) });
      if (c.subtitle) slide.addText(c.subtitle, { x: 0.5, y: 6.1, w: 12.33, h: 1, fontSize: 18, color: hexNoHash(theme.text), transparency: 15 });
      continue;
    }

    // Default: heading + body/bullets, optional image on the side
    const hasSideImage = !!c.image_url && (layout === "image-right" || layout === "image-left");
    const imgLeft = layout === "image-left";
    const textX = hasSideImage && imgLeft ? 6.5 : 0.5;
    const textW = hasSideImage ? 6.3 : 12.33;

    slide.addText(c.headline || "", {
      x: textX, y: 0.5, w: textW, h: 1,
      fontSize: 32, bold: true, color: hexNoHash(theme.accent), fontFace: "Calibri",
    });
    if (c.subtitle) {
      slide.addText(c.subtitle, {
        x: textX, y: 1.5, w: textW, h: 0.6,
        fontSize: 16, color: hexNoHash(theme.text), transparency: 30,
      });
    }
    let cursorY = c.subtitle ? 2.2 : 1.7;
    if (c.body_text) {
      slide.addText(c.body_text, {
        x: textX, y: cursorY, w: textW, h: 2,
        fontSize: 14, color: hexNoHash(theme.text), valign: "top",
      });
      cursorY += 1.8;
    }
    if (c.bullets && c.bullets.length) {
      slide.addText(
        c.bullets.map((b: string) => ({ text: b, options: { bullet: { type: "bullet" }, color: hexNoHash(theme.text), fontSize: 15 } })),
        { x: textX, y: cursorY, w: textW, h: 5 - cursorY + 0.5, valign: "top" }
      );
    }

    if (hasSideImage) {
      const ix = imgLeft ? 0.5 : 7;
      try { slide.addImage({ path: c.image_url, x: ix, y: 0.7, w: 5.83, h: 6.1, sizing: { type: "cover", w: 5.83, h: 6.1 } }); } catch {}
    }

    // Chart (basic native chart)
    if (c.chart && (s.slide_type === "data_chart" || layout === "data-chart")) {
      const data = [{
        name: c.chart.title || "Dados",
        labels: c.chart.labels || [],
        values: c.chart.values || [],
      }];
      const chartType = c.chart.type === "line" ? pptx.ChartType.line
        : c.chart.type === "pie" || c.chart.type === "donut" ? pptx.ChartType.pie
        : c.chart.type === "area" ? pptx.ChartType.area
        : pptx.ChartType.bar;
      try {
        slide.addChart(chartType, data, {
          x: 0.5, y: 2.5, w: 12.33, h: 4.5,
          chartColors: [hexNoHash(theme.accent), hexNoHash(theme.accent2 || "#F59E0B")],
          showLegend: false,
        });
      } catch (e) { console.warn("chart add failed", e); }
    }
  }

  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "apresentacao";
  await pptx.writeFile({ fileName: `${safeName}.pptx` });
}
