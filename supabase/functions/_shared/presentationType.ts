// Normalização do campo `type` da apresentação.
//
// O formulário de geração oferece 7 tipos, mas os TEMPLATES (src/lib/templates.ts)
// gravam outros rótulos — "Educacional", "Treinamento", "Palestra", "Pessoal",
// "Pitch", "Vendas" — e eles chegam ao backend exatamente assim. Sem este
// mapeamento, toda apresentação criada a partir de um template caía no perfil
// genérico do Creative Director e no arco padrão do Story Engine, justamente
// os casos em que o contexto é mais conhecido.

/** Rótulos vindos de templates → o tipo canônico equivalente. */
const TYPE_ALIASES: Record<string, string> = {
  educacional: "escolar",
  treinamento: "escolar",
  aula: "escolar",
  palestra: "criativo",
  pessoal: "criativo",
  pitch: "pitch de negócios",
  vendas: "marketing",
  comercial: "marketing",
  tcc: "acadêmico",
};

/**
 * Devolve o tipo em minúsculas, já resolvido para o rótulo canônico usado
 * pelas tabelas de perfil. Tipos desconhecidos voltam normalizados (sem
 * alias), para que quem consulta caia no próprio default.
 */
export function normalizePresentationType(type?: string | null): string {
  const key = String(type ?? "").trim().toLowerCase();
  return TYPE_ALIASES[key] ?? key;
}
