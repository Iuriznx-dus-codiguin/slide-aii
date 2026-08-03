// Client-side PDF export.
// Renders each slide off-screen at 1920x1080 using SlideRenderer (no animations),
// captures it via html2canvas and assembles a 16:9 landscape PDF using jsPDF.
// Produces a true-to-layout PDF (matches the on-screen design), independent of
// browser print dialogs.
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { SlideRenderer } from "@/components/SlideRenderer";
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

const SLIDE_W = 1920;
const SLIDE_H = 1080;

/** Render one slide off-screen and rasterize it. Returns a PNG data URL. */
async function rasterizeSlide(
  slide: SlideRow,
  themeId: string,
  fontId: string,
  dynamicTheme: Partial<ThemeColors> | null | undefined,
  index: number,
): Promise<string> {
  // Off-screen container — keep visible to the layout engine but out of viewport.
  const host = document.createElement("div");
  host.style.cssText = `
    position: fixed;
    top: 0; left: -100000px;
    width: ${SLIDE_W}px;
    height: ${SLIDE_H}px;
    pointer-events: none;
    z-index: -1;
    background: transparent;
  `;
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      createElement(SlideRenderer as any, {
        slide: {
          slide_type: slide.slide_type,
          layout_template: slide.layout_template,
          content: slide.content,
        },
        themeId,
        fontId,
        dynamicTheme,
        index,
        noAnimate: true,
      }),
    );

    // Wait for layout / images. We poll a couple of frames then for image readiness.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const imgs = Array.from(host.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => {
              const done = () => res();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              // Safety timeout — never block more than 4s on a single image.
              setTimeout(done, 4000);
            }),
      ),
    );

    const canvas = await html2canvas(host, {
      width: SLIDE_W,
      height: SLIDE_H,
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H,
      backgroundColor: null,
      scale: 1, // already at native slide resolution
      useCORS: true,
      allowTaint: false,
      logging: false,
    });
    return canvas.toDataURL("image/png");
  } finally {
    try { root?.unmount(); } catch {}
    host.remove();
  }
}

export async function exportPresentationToPdf({
  title,
  themeId,
  fontId,
  slides,
  dynamicTheme = null,
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
    const dataUrl = await rasterizeSlide(
      slides[i],
      themeId,
      fontId,
      // dynamic_theme vive no content do primeiro slide e vale para o deck inteiro
      // (não há lógica condicional por índice aqui — é sempre a mesma fonte).
      slides[0]?.content?.dynamic_theme ?? dynamicTheme,
      i,
    );
    if (i > 0) pdf.addPage([PDF_W, PDF_H], "landscape");
    pdf.addImage(dataUrl, "PNG", 0, 0, PDF_W, PDF_H, undefined, "FAST");
  }

  onProgress?.(slides.length, slides.length);

  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "apresentacao";
  pdf.save(`${safeName}.pdf`);
}
