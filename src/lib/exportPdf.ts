// Client-side PDF export.
// Renders each slide off-screen at 1920x1080 using SlideRenderer (no animations),
// captures it via html2canvas and assembles a 16:9 landscape PDF using jsPDF.
// Produces a true-to-layout PDF (matches the on-screen design), independent of
// browser print dialogs.
//
// Motor v2: a renderização offscreen vive em ./exportRaster e liga os
// fallbacks estáticos dos efeitos de cena (html2canvas não desenha filter,
// backdrop-filter nem mix-blend-mode), para o arquivo bater com a tela.
import { jsPDF } from "jspdf";
import { rasterizeSlide } from "@/lib/exportRaster";
import type { ThemeColors } from "@/lib/slugify";
import type { CreativeBrief } from "@/lib/creativeBrief";

interface SlideRow {
  id?: string;
  position: number;
  slide_type: string;
  layout_template: string | null;
  content: any;
}

interface ExportPdfOpts {
  title: string;
  themeId: string;
  fontId: string;
  slides: SlideRow[];
  dynamicTheme?: Partial<ThemeColors> | null;
  /**
   * Brief do Creative Director. Sem ele o PDF era rasterizado com a
   * densidade/espaçamento padrão do SlideRenderer, enquanto a tela usava a
   * densidade do brief — o arquivo exportado não batia com o que o usuário
   * via. Mesma fonte de verdade nos dois caminhos.
   */
  creativeBrief?: CreativeBrief | null;
  onProgress?: (current: number, total: number) => void;
}

export async function exportPresentationToPdf({
  title,
  themeId,
  fontId,
  slides,
  dynamicTheme = null,
  creativeBrief = null,
  onProgress,
}: ExportPdfOpts) {
  if (!slides.length) throw new Error("Nenhum slide para exportar");

  // 16:9 landscape. Use 'pt' so we can think in a stable 1280x720 canvas (PDF points).
  const PDF_W = 1280;
  const PDF_H = 720;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [PDF_W, PDF_H] });
  pdf.setProperties({ title, creator: "SlideAI" });

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i, slides.length);
    const dataUrl = await rasterizeSlide(slides[i], {
      themeId,
      fontId,
      // Fonte de verdade do tema: a coluna presentations.dynamic_theme
      // (passada por quem chama). O legado content.dynamic_theme do primeiro
      // slide fica só como fallback para decks antigos.
      dynamicTheme: dynamicTheme ?? slides[0]?.content?.dynamic_theme ?? null,
      creativeBrief,
      index: i,
    });
    if (i > 0) pdf.addPage([PDF_W, PDF_H], "landscape");
    pdf.addImage(dataUrl, "PNG", 0, 0, PDF_W, PDF_H, undefined, "FAST");
  }

  onProgress?.(slides.length, slides.length);

  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "apresentacao";
  pdf.save(`${safeName}.pdf`);
}
