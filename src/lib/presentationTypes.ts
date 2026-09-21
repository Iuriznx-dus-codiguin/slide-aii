// Tipos canônicos de apresentação — a mesma lista exibida no Select de /gerar.
// Os templates (src/lib/templates.ts) historicamente gravaram rótulos próprios
// ("Vendas", "Palestra", "Educacional"...). O backend já resolve esses aliases
// em supabase/functions/_shared/presentationType.ts; aqui espelhamos o mesmo
// mapeamento para que a UI nunca fique com o campo "Tipo" em branco.

export const PRESENTATION_TYPES = [
  "Acadêmico",
  "Escolar",
  "Corporativo",
  "Marketing",
  "Criativo",
  "Científico",
  "Pitch de negócios",
] as const;

export type PresentationType = (typeof PRESENTATION_TYPES)[number];

/** Rótulos legados → tipo canônico exibido no Select. */
const UI_TYPE_ALIASES: Record<string, PresentationType> = {
  educacional: "Escolar",
  treinamento: "Escolar",
  aula: "Escolar",
  escolar: "Escolar",
  palestra: "Criativo",
  pessoal: "Criativo",
  criativo: "Criativo",
  pitch: "Pitch de negócios",
  "pitch de negócios": "Pitch de negócios",
  vendas: "Marketing",
  comercial: "Marketing",
  marketing: "Marketing",
  tcc: "Acadêmico",
  acadêmico: "Acadêmico",
  academico: "Acadêmico",
  corporativo: "Corporativo",
  científico: "Científico",
  cientifico: "Científico",
};

/**
 * Devolve sempre um tipo presente no Select. Entradas desconhecidas caem em
 * "Corporativo", o perfil mais neutro — nunca em vazio.
 */
export function toUiPresentationType(type?: string | null): PresentationType {
  const key = String(type ?? "").trim().toLowerCase();
  if (!key) return "Corporativo";
  const exact = PRESENTATION_TYPES.find((t) => t.toLowerCase() === key);
  if (exact) return exact;
  return UI_TYPE_ALIASES[key] ?? "Corporativo";
}
