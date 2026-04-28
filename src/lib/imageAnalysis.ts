// ============================================================
// SlideAI — Image Analysis (Fase C)
// ------------------------------------------------------------
// Smart Layout + Auto-Contraste:
//   1) Carrega imagem em <canvas> off-DOM (CORS-safe)
//   2) Subdivide em 9 zonas (3x3) e calcula:
//        - luminância média (0..1)
//        - "uniformidade" (1 - desvio_padrão_normalizado) → áreas planas
//          são SAFE (sem rosto/objeto) para sobrepor texto
//   3) Decide:
//        - safeSide: "left" | "right" → onde colocar o painel de texto
//        - overlay: cor + opacidade ideal para garantir WCAG AA
//        - textColor: branco ou preto, o que tiver maior contraste
//
// Resultado é cacheado por URL (Map global).
// ============================================================

export interface ZoneStats {
  luminance: number;   // 0 (escuro) .. 1 (claro)
  uniformity: number;  // 0 (cheio de detalhes) .. 1 (chapado, ideal p/ texto)
}

export interface ImageInsight {
  url: string;
  width: number;
  height: number;
  /** matriz 3x3, índice 0-8 (left→right, top→bottom) */
  zones: ZoneStats[];
  /** lado mais "vazio" (mais uniforme) — onde texto fica seguro */
  safeSide: "left" | "right";
  /** safeSide com mais detalhe: posição da zona vencedora */
  safeAnchor: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  /** luminância média da metade do texto */
  textHalfLuminance: number;
  /** cor de texto recomendada para contraste ideal */
  textColor: "#FFFFFF" | "#0A0A0A";
  /** overlay sugerido (cor + alpha) para colocar atrás do texto */
  overlay: { color: string; alpha: number };
}

const cache = new Map<string, ImageInsight>();
const inflight = new Map<string, Promise<ImageInsight | null>>();

/** WCAG relative luminance from 0..255 RGB. */
function relLum(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

/**
 * Analisa uma imagem em canvas. Pode falhar silenciosamente (CORS, erro de rede)
 * — nesses casos retorna null e o renderer cai no comportamento default.
 */
export async function analyzeImage(url: string): Promise<ImageInsight | null> {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url)!;
  if (inflight.has(url)) return inflight.get(url)!;

  const p = (async () => {
    try {
      const img = await loadImage(url);
      // Reduz para 90x60 → análise rápida e uniforme
      const W = 90, H = 60;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, W, H);
      let pixels: Uint8ClampedArray;
      try {
        pixels = ctx.getImageData(0, 0, W, H).data;
      } catch {
        // CORS taint — não conseguimos ler. Retorna null.
        return null;
      }

      const zones: ZoneStats[] = [];
      // 3x3 zones
      for (let zy = 0; zy < 3; zy++) {
        for (let zx = 0; zx < 3; zx++) {
          const x0 = Math.floor((W * zx) / 3);
          const x1 = Math.floor((W * (zx + 1)) / 3);
          const y0 = Math.floor((H * zy) / 3);
          const y1 = Math.floor((H * (zy + 1)) / 3);
          let sumL = 0, sumL2 = 0, n = 0;
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = (y * W + x) * 4;
              const l = relLum(pixels[i], pixels[i + 1], pixels[i + 2]);
              sumL += l; sumL2 += l * l; n++;
            }
          }
          const mean = n ? sumL / n : 0;
          const variance = n ? Math.max(0, sumL2 / n - mean * mean) : 0;
          const stdev = Math.sqrt(variance);
          // Normaliza: stdev máximo plausível ~0.35
          const uniformity = Math.max(0, 1 - stdev / 0.35);
          zones.push({ luminance: mean, uniformity });
        }
      }

      // Decide safeSide: soma uniformidade dos 6 quadrados de cada lado
      // (lado esquerdo = colunas 0,1; direito = colunas 1,2; coluna do meio é compartilhada)
      const leftScore = [0, 3, 6].reduce((s, i) => s + zones[i].uniformity, 0);
      const rightScore = [2, 5, 8].reduce((s, i) => s + zones[i].uniformity, 0);
      const safeSide: "left" | "right" = leftScore >= rightScore ? "left" : "right";

      // Anchor mais específico: zona com maior uniformidade do lado vencedor
      const anchorMap: Record<number, ImageInsight["safeAnchor"]> = {
        0: "top-left", 6: "bottom-left", 3: "top-left",
        2: "top-right", 8: "bottom-right", 5: "top-right",
        4: "center", 1: "center", 7: "center",
      };
      const sideIdxs = safeSide === "left" ? [0, 3, 6] : [2, 5, 8];
      const winner = sideIdxs.reduce((best, i) => zones[i].uniformity > zones[best].uniformity ? i : best, sideIdxs[0]);
      const safeAnchor = anchorMap[winner];

      // Luminância da metade onde o texto vai (média ponderada)
      const textHalfIdxs = safeSide === "left" ? [0, 3, 6, 1, 4, 7] : [2, 5, 8, 1, 4, 7];
      const textHalfLuminance = textHalfIdxs.reduce((s, i) => s + zones[i].luminance, 0) / textHalfIdxs.length;

      // Texto branco vs preto: escolhe o que dá MAIOR contraste
      const contrastWhite = (1.05) / (textHalfLuminance + 0.05);
      const contrastBlack = (textHalfLuminance + 0.05) / 0.05;
      const textColor: "#FFFFFF" | "#0A0A0A" = contrastWhite >= contrastBlack ? "#FFFFFF" : "#0A0A0A";

      // Overlay: se a imagem é clara e queremos texto branco → overlay escuro
      // se a imagem é escura e queremos texto preto → overlay claro
      // alpha proporcional à "necessidade" (quão longe está do contraste 4.5 alvo)
      const targetContrast = 4.5;
      const currentContrast = textColor === "#FFFFFF" ? contrastWhite : contrastBlack;
      const deficit = Math.max(0, (targetContrast - currentContrast) / targetContrast);
      const baseAlpha = textColor === "#FFFFFF" ? 0.35 : 0.25;
      const alpha = Math.min(0.85, baseAlpha + deficit * 0.6);
      const overlay = {
        color: textColor === "#FFFFFF" ? "#000000" : "#FFFFFF",
        alpha,
      };

      const insight: ImageInsight = {
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        zones,
        safeSide,
        safeAnchor,
        textHalfLuminance,
        textColor,
        overlay,
      };
      cache.set(url, insight);
      return insight;
    } catch (err) {
      console.warn("analyzeImage failed:", err);
      return null;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, p);
  return p;
}

/** Hook React para usar a análise de imagem com loading-state. */
import { useEffect, useState } from "react";
export function useImageInsight(url: string | null | undefined): ImageInsight | null {
  const [insight, setInsight] = useState<ImageInsight | null>(url ? cache.get(url) ?? null : null);
  useEffect(() => {
    if (!url) { setInsight(null); return; }
    const cached = cache.get(url);
    if (cached) { setInsight(cached); return; }
    let alive = true;
    analyzeImage(url).then((r) => { if (alive) setInsight(r); });
    return () => { alive = false; };
  }, [url]);
  return insight;
}
