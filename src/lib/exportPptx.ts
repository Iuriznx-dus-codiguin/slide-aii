// Client-side PPTX export using pptxgenjs.
// Renders slide content as native PowerPoint shapes (text + image) so the file
// can be edited inside PowerPoint/Keynote afterwards.
import pptxgen from "pptxgenjs";
import { resolveTheme, type ThemeColors } from "@/lib/slugify";

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
}

const hexNoHash = (h: string) => (h || "#000000").replace("#", "");

export async function exportPresentationToPptx({ title, themeId, slides }: ExportOpts) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches (16:9)
  pptx.title = title;
  pptx.company = "SlideAI";

  // First slide may carry the dynamic_theme used by the whole deck.
  const dyn = slides[0]?.content?.dynamic_theme ?? null;
  const theme: ThemeColors = resolveTheme(themeId, dyn);

  for (const s of slides) {
    const c = s.content || {};
    const layout = s.layout_template || "title-content";
    const slide = pptx.addSlide();
    slide.background = { color: hexNoHash(theme.bg) };

    if (s.speaker_notes) slide.addNotes(s.speaker_notes);

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
