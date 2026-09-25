// Rasterização offscreen de slides para exports (PDF e PPTX).
//
// Renderiza o SlideRenderer fora da tela a 1920×1080, sem animação e com os
// FALLBACKS ESTÁTICOS dos efeitos do motor v2 ligados (html2canvas ignora
// backdrop-filter, filter, mix-blend-mode e máscaras — ver
// SceneRenderContext). O mesmo caminho serve o PDF (slide inteiro) e o PPTX
// (só o slot do bloco visual, recortado pelo retângulo real do DOM).
//
// Avaliação do rasterizador: um rasterizador baseado em foreignObject
// (html-to-image / modern-screenshot) desenharia filter/blend nativamente,
// porque delega a pintura ao próprio navegador. Fica como próximo passo — o
// fallback estático garante hoje paridade tela × arquivo sem dependência nova.
import html2canvas from "html2canvas";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { SlideRenderer } from "@/components/SlideRenderer";
import { SceneRenderProvider, type SceneRenderOptions } from "@/components/scene/SceneRenderContext";
import type { ThemeColors } from "@/lib/slugify";
import type { CreativeBrief } from "@/lib/creativeBrief";

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

export interface RasterSlide {
  position?: number;
  slide_type: string;
  layout_template: string | null;
  content: any;
}

export interface RasterOptions {
  themeId: string;
  fontId: string;
  dynamicTheme?: Partial<ThemeColors> | null;
  creativeBrief?: CreativeBrief | null;
  index: number;
  render?: SceneRenderOptions;
}

async function withOffscreenSlide<T>(slide: RasterSlide, opts: RasterOptions, fn: (host: HTMLDivElement) => Promise<T>): Promise<T> {
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
      createElement(
        SceneRenderProvider,
        { value: opts.render ?? { staticEffects: true } },
        createElement(SlideRenderer as any, {
          slide: { slide_type: slide.slide_type, layout_template: slide.layout_template, content: slide.content },
          themeId: opts.themeId,
          fontId: opts.fontId,
          dynamicTheme: opts.dynamicTheme ?? null,
          index: opts.index,
          creativeBrief: opts.creativeBrief ?? null,
          noAnimate: true,
        }),
      ),
    );

    // Espera layout, imagens e o ajuste de texto do Quality Gate (FitText).
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
              // Nunca bloqueia mais de 4s numa única imagem.
              setTimeout(done, 4000);
            }),
      ),
    );
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await fn(host);
  } finally {
    try { root?.unmount(); } catch { /* ignore */ }
    host.remove();
  }
}

/** Slide inteiro → PNG (data URL). */
export async function rasterizeSlide(slide: RasterSlide, opts: RasterOptions): Promise<string> {
  return withOffscreenSlide(slide, opts, async (host) => {
    const canvas = await html2canvas(host, {
      width: SLIDE_W,
      height: SLIDE_H,
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H,
      backgroundColor: null,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      logging: false,
    });
    return canvas.toDataURL("image/png");
  });
}

export interface SlotRaster {
  dataUrl: string;
  /** Retângulo do slot no slide 1920×1080 (px). */
  rect: { x: number; y: number; w: number; h: number };
}

/**
 * Só o bloco visual de um slide v2 → PNG transparente + retângulo real do
 * slot. Usado pelo PPTX para visuais complexos (sistemas, mídia, híbridos):
 * o desenho entra como imagem e o texto como caixa nativa editável.
 */
export async function rasterizeSceneSlot(slide: RasterSlide, opts: RasterOptions): Promise<SlotRaster | null> {
  return withOffscreenSlide(slide, { ...opts, render: { staticEffects: true, only: "visual" } }, async (host) => {
    const slot = host.querySelector<HTMLElement>("[data-scene-slot='visual']");
    if (!slot) return null;
    const hostRect = host.getBoundingClientRect();
    const r = slot.getBoundingClientRect();
    const rect = { x: r.left - hostRect.left, y: r.top - hostRect.top, w: r.width, h: r.height };
    if (rect.w < 4 || rect.h < 4) return null;
    // Renderiza o próprio elemento do slot: o clone do html2canvas mantém os
    // ancestrais (unidades cqw e layout resolvem igual à tela).
    const canvas = await html2canvas(slot, {
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H,
      backgroundColor: null,
      scale: 1.5,
      useCORS: true,
      allowTaint: false,
      logging: false,
    });
    return { dataUrl: canvas.toDataURL("image/png"), rect };
  });
}
