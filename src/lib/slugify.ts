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

/**
 * Escolha automática de fonte com base no tipo + mood do tema. Usada quando
 * o usuário não escolhe explicitamente uma fonte (o form de geração deixa
 * de expor esse controle — a plataforma passa a decidir de acordo com o
 * assunto para maximizar impacto visual sem opções paralisantes).
 */
export function autoFontForContext(type: string, theme: string, title: string): string {
  const t = (type || "").toLowerCase();
  const s = `${title || ""} ${type || ""}`.toLowerCase();
  // Sinais temáticos no título têm prioridade — é o que mais diferencia.
  if (/hist[óo]ria|cultura|literatura|arte|filosof/.test(s)) return "fraunces-warm";
  if (/esporte|futebol|treino|performance|atlet/.test(s)) return "archivo-poster";
  if (/startup|produto|saas|app|software|dados|ia\b|intelig/.test(s)) return "space-editorial";
  if (/marca|marketing|vendas|social|campanha|tend[êe]ncia/.test(s)) return "unbounded-pop";
  if (/ci[êe]ncia|qu[íi]mica|f[íi]sica|matem[áa]tica|estat[íi]stic/.test(s)) return "mono-technical";
  if (/luxo|moda|design|arquitetura/.test(s)) return "instrument-luxe";
  // Palette por tipo
  if (t.includes("acad") || t.includes("escolar") || t.includes("cient")) return "dm-editorial";
  if (t.includes("pitch")) return "neo-futurist";
  if (t.includes("marketing") || t.includes("criativo")) return "kinetic-brutal";
  if (t.includes("corp")) return "modern-sans";
  // Fallback determinístico pelo hash do título para variedade
  const pool = ["neo-futurist", "syne-editorial", "kinetic-brutal", "instrument-luxe", "bold-display", "unbounded-pop", "space-editorial"];
  const h = (title || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[h % pool.length];
}

/** Valida um par tipográfico sugerido pela IA, com fallback contextual. */
export function resolveFontPairing(
  aiPairing: string | null | undefined,
  fallback: string,
): string {
  if (aiPairing && FONTS[aiPairing]) return aiPairing;
  return FONTS[fallback] ? fallback : "modern-sans";
}

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
