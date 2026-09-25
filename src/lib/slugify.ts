// Slug e escolha automática de fonte vêm do _shared desde o motor v2: a
// persistência passou para o servidor e a mesma regra roda nos dois lados.
import { generateSlug } from "../../supabase/functions/_shared/slug.ts";
import { autoFontForContext } from "../../supabase/functions/_shared/typography.ts";
export { generateSlug, autoFontForContext };

// Paletas vêm do _shared: o servidor precisa da paleta resolvida para montar
// as receitas de imagem e checar contraste antes de gravar o deck.
import { THEMES, resolveTheme, type ThemeColors } from "../../supabase/functions/_shared/themes.ts";
export { THEMES, resolveTheme };
export type { ThemeColors };

/** Display font: distinta para títulos. Body permanece sans neutra. */
export const FONTS: Record<string, { family: string; name: string; display?: string; mood?: string }> = {
  "modern-sans":     { family: "'Plus Jakarta Sans', sans-serif", display: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif", name: "Modern Sans", mood: "corporate,tech,default" },
  "classic-serif":   { family: "'Playfair Display', 'Georgia', serif", display: "'Fraunces', 'Playfair Display', serif", name: "Classic Serif", mood: "academic,elegant" },
  "bold-display":    { family: "'Inter', sans-serif", display: "'Bricolage Grotesque', 'Inter', sans-serif", name: "Bold Display", mood: "pitch,impact" },
  "minimal-clean":   { family: "'Inter', system-ui, sans-serif", display: "'Space Grotesk', 'Inter', system-ui, sans-serif", name: "Minimal Clean", mood: "minimalist,tech" },
  "editorial":       { family: "'Cormorant Garamond', 'Georgia', serif", display: "'Fraunces', 'Cormorant Garamond', serif", name: "Editorial", mood: "editorial,luxury" },
  "kinetic-brutal":  { family: "'Manrope', sans-serif", display: "'Archivo Black', 'Manrope', sans-serif", name: "Kinetic Brutal", mood: "creative,marketing,impact" },
  "neo-futurist":    { family: "'Sora', sans-serif", display: "'Unbounded', 'Sora', sans-serif", name: "Neo Futurist", mood: "tech,futuristic,pitch" },
  "syne-editorial":  { family: "'Manrope', sans-serif", display: "'Syne', 'Manrope', sans-serif", name: "Syne Editorial", mood: "creative,editorial" },
  "instrument-luxe": { family: "'Outfit', sans-serif", display: "'Instrument Serif', 'DM Serif Display', serif", name: "Instrument Luxe", mood: "luxury,editorial,elegant" },
  "mono-technical":  { family: "'Inter', sans-serif", display: "'Space Mono', 'Space Grotesk', monospace", name: "Mono Technical", mood: "scientific,technical,data" },
  "dm-editorial":    { family: "'Plus Jakarta Sans', sans-serif", display: "'DM Serif Display', 'Playfair Display', serif", name: "DM Editorial", mood: "academic,scholar,editorial" },
  // Novos pares — mais impacto e variedade por tema.
  "unbounded-pop":   { family: "'Outfit', sans-serif", display: "'Unbounded', 'Outfit', sans-serif", name: "Unbounded Pop", mood: "marketing,pop,energetic" },
  "space-editorial": { family: "'Sora', sans-serif", display: "'Space Grotesk', 'Sora', sans-serif", name: "Space Editorial", mood: "startup,product,tech" },
  "fraunces-warm":   { family: "'Manrope', sans-serif", display: "'Fraunces', 'Playfair Display', serif", name: "Fraunces Warm", mood: "history,culture,humanities" },
  "archivo-poster":  { family: "'Outfit', sans-serif", display: "'Archivo Black', 'Outfit', sans-serif", name: "Archivo Poster", mood: "sport,impact,bold" },
};

/** Valida um par tipográfico sugerido pela IA, com fallback contextual. */
export function resolveFontPairing(
  aiPairing: string | null | undefined,
  fallback: string,
): string {
  if (aiPairing && FONTS[aiPairing]) return aiPairing;
  return FONTS[fallback] ? fallback : "modern-sans";
}

export const ANIMATION_PRESETS = [
  "fade", "slide-up", "slide-left", "slide-right", "zoom-in",
  "blur-in", "stagger-up", "reveal-mask", "rotate-in", "bounce-in",
] as const;
export type AnimationPreset = typeof ANIMATION_PRESETS[number];
