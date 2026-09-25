// Paletas de tema — fonte única para o renderer (src/lib/slugify.ts) e para o
// servidor, que agora precisa da paleta resolvida para o Image Director
// (receitas com hex do tema) e para o Quality Gate (contraste AA).

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

/**
 * Resolve a theme. If themeId === "auto" and the presentation carries a
 * `dynamic_theme` coming from the IA (with bg/text/accent hex), use it.
 * Otherwise fall back to a preset theme.
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
