// Utilidades de cor do motor de cenas (puras).
import { contrastRatio, hexToRgb } from "../../../supabase/functions/_shared/qualityGate.ts";

export function rgba(hex: string | undefined, alpha: number): string {
  const rgb = hexToRgb(hex ?? "#000000") ?? [0, 0, 0];
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Mistura linear de duas cores hex (t=0 → a, t=1 → b). */
export function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a) ?? [0, 0, 0];
  const rb = hexToRgb(b) ?? [0, 0, 0];
  const c = ra.map((v, i) => Math.round(v + (rb[i] - v) * Math.max(0, Math.min(1, t))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Texto legível (AA) sobre um fundo sólido: quase branco ou quase preto. */
export function readableOn(bg: string): string {
  const dark = "#0B0B12";
  const light = "#F8FAFC";
  return (contrastRatio(dark, bg) ?? 0) >= (contrastRatio(light, bg) ?? 0) ? dark : light;
}

export const isDarkColor = (hex: string): boolean => {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 < 0.5;
};
