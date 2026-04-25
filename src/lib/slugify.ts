export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "apresentacao";
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
}

export interface ThemeColors {
  bg: string;
  text: string;
  accent: string;
  accent2?: string;
  surface?: string;
  name: string;
  // Optional gradient stops
  gradient?: string;
}

export const THEMES: Record<string, ThemeColors> = {
  "auto": { bg: "#0F172A", text: "#F1F5F9", accent: "#6C47FF", name: "🎨 De acordo com o tema" },
  "profissional-azul": { bg: "#0F172A", text: "#F1F5F9", accent: "#3B82F6", name: "Profissional Azul" },
  "elegante-escuro": { bg: "#1A1A1A", text: "#FAFAFA", accent: "#A855F7", name: "Elegante Escuro" },
  "vibrante-colorido": { bg: "#FFFFFF", text: "#1E293B", accent: "#EC4899", name: "Vibrante Colorido" },
  "minimalista-branco": { bg: "#FFFFFF", text: "#0F172A", accent: "#0F172A", name: "Minimalista Branco" },
  "verde-natureza": { bg: "#064E3B", text: "#ECFDF5", accent: "#34D399", name: "Verde Natureza" },
  "roxo-criativo": { bg: "#1E1B4B", text: "#EDE9FE", accent: "#8B5CF6", name: "Roxo Criativo" },
  "laranja-energia": { bg: "#1F1410", text: "#FFF7ED", accent: "#F97316", name: "Laranja Energia" },
  "rose-gold": { bg: "#1C1018", text: "#FFE4E6", accent: "#F43F5E", name: "Rose Gold" },
};

/** Display font: distinta para títulos. Body permanece sans neutra. */
export const FONTS: Record<string, { family: string; name: string; display?: string }> = {
  "modern-sans":   { family: "'Plus Jakarta Sans', sans-serif", display: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif", name: "Modern Sans" },
  "classic-serif": { family: "'Playfair Display', 'Georgia', serif", display: "'Fraunces', 'Playfair Display', serif", name: "Classic Serif" },
  "bold-display":  { family: "'Inter', sans-serif", display: "'Bricolage Grotesque', 'Inter', sans-serif", name: "Bold Display" },
  "minimal-clean": { family: "'Inter', system-ui, sans-serif", display: "'Space Grotesk', 'Inter', system-ui, sans-serif", name: "Minimal Clean" },
  "editorial":     { family: "'Cormorant Garamond', 'Georgia', serif", display: "'Fraunces', 'Cormorant Garamond', serif", name: "Editorial" },
};

/**
 * Resolve a theme. If themeId === "auto" and the slide carries a `dynamic_theme`
 * coming from the IA (with bg/text/accent hex), use it. Otherwise fall back to
 * a preset theme.
 */
export function resolveTheme(themeId: string, dynamic?: Partial<ThemeColors> | null): ThemeColors {
  if (themeId === "auto" && dynamic && dynamic.bg && dynamic.text && dynamic.accent) {
    return {
      bg: dynamic.bg,
      text: dynamic.text,
      accent: dynamic.accent,
      accent2: dynamic.accent2,
      surface: dynamic.surface,
      gradient: dynamic.gradient,
      name: dynamic.name || "Auto",
    };
  }
  return THEMES[themeId] ?? THEMES["profissional-azul"];
}

export const ANIMATION_PRESETS = [
  "fade", "slide-up", "slide-left", "slide-right", "zoom-in",
  "blur-in", "stagger-up", "reveal-mask", "rotate-in", "bounce-in",
] as const;
export type AnimationPreset = typeof ANIMATION_PRESETS[number];
