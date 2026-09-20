// Tradução do perfil escolhido no onboarding (profiles.role) para os campos do
// formulário de geração.
//
// O onboarding pergunta "Como você pretende usar o SlideAI?" e promete
// personalizar a experiência, mas a resposta ficava parada no banco. Aqui ela
// vira o ponto de partida do formulário — o usuário continua livre para mudar
// tudo, só não começa mais do zero.

/** Valores aceitos em profiles.role (ver src/pages/Onboarding.tsx). */
export type UserRole = "estudante" | "professor" | "profissional" | "criador";

export interface GenerationDefaults {
  /** Persona do orador (ver personaGuide em generate-presentation). */
  persona: "educator" | "technical-authority" | "inspirational-leader" | "salesperson";
  /** Tipo/público da apresentação. */
  type: string;
  /** Profundidade dos textos. */
  textDepth: "short" | "balanced" | "long";
}

const BY_ROLE: Record<UserRole, GenerationDefaults> = {
  // Trabalho escolar: tom didático, densidade média.
  estudante: { persona: "educator", type: "Escolar", textDepth: "balanced" },
  // Material de aula: didático, mas com contexto e exemplos encadeados.
  professor: { persona: "educator", type: "Acadêmico", textDepth: "long" },
  // Reuniões e relatórios: precisão, dados e vocabulário técnico.
  profissional: { persona: "technical-authority", type: "Corporativo", textDepth: "balanced" },
  // Conteúdo e marketing: narrativa de propósito, texto enxuto e impactante.
  criador: { persona: "inspirational-leader", type: "Marketing", textDepth: "short" },
};

/** Defaults coerentes com o perfil, ou null quando o papel é desconhecido/ausente. */
export function defaultsForRole(role: string | null | undefined): GenerationDefaults | null {
  if (!role) return null;
  return BY_ROLE[role.trim().toLowerCase() as UserRole] ?? null;
}
