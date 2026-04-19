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

export const THEMES: Record<string, { bg: string; text: string; accent: string; name: string }> = {
  "profissional-azul": { bg: "#0F172A", text: "#F1F5F9", accent: "#3B82F6", name: "Profissional Azul" },
  "elegante-escuro": { bg: "#1A1A1A", text: "#FAFAFA", accent: "#A855F7", name: "Elegante Escuro" },
  "vibrante-colorido": { bg: "#FFFFFF", text: "#1E293B", accent: "#EC4899", name: "Vibrante Colorido" },
  "minimalista-branco": { bg: "#FFFFFF", text: "#0F172A", accent: "#0F172A", name: "Minimalista Branco" },
  "verde-natureza": { bg: "#064E3B", text: "#ECFDF5", accent: "#34D399", name: "Verde Natureza" },
  "roxo-criativo": { bg: "#1E1B4B", text: "#EDE9FE", accent: "#8B5CF6", name: "Roxo Criativo" },
};

export const FONTS: Record<string, { family: string; name: string }> = {
  "modern-sans": { family: "'Plus Jakarta Sans', sans-serif", name: "Modern Sans" },
  "classic-serif": { family: "'Playfair Display', serif", name: "Classic Serif" },
  "bold-display": { family: "'Inter', sans-serif", name: "Bold Display" },
  "minimal-clean": { family: "'Inter', system-ui, sans-serif", name: "Minimal Clean" },
};
