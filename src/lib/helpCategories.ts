// Rótulos das categorias da Central de Ajuda. No banco, `help_articles.category`
// guarda só a chave (ex.: "planos"); a interface mostra o rótulo. As chaves
// válidas estão em scripts/help-center.ts (HELP_CATEGORIES).

export interface HelpCategoryMeta {
  label: string;
  description: string;
}

export const HELP_CATEGORY_META: Record<string, HelpCategoryMeta> = {
  comecar: { label: "Primeiros passos", description: "Do cadastro à primeira apresentação" },
  geracao: { label: "Criar apresentações", description: "Opções de geração, imagens, falas e dicas" },
  editor: { label: "Editor", description: "Editar slides, imagens e usar o assistente de IA" },
  apresentacao: { label: "Apresentar e compartilhar", description: "Modo apresentação, publicação e links" },
  exportacao: { label: "Exportar", description: "PowerPoint, PDF, imagem e roteiro" },
  planos: { label: "Créditos, planos e pagamentos", description: "Custos, assinaturas, cancelamento e reembolso" },
  conta: { label: "Conta e perfil", description: "Perfil, portfólio, segurança e exclusão" },
  privacidade: { label: "Privacidade e termos", description: "Seus dados, direitos e regras de uso" },
  autenticacao: { label: "Acesso e login", description: "Cadastro, login e recuperação de senha" },
  suporte: { label: "Suporte", description: "Atendimento, códigos de erro e diagnóstico" },
};

/** Ordem de exibição das categorias. */
export const HELP_CATEGORY_ORDER = Object.keys(HELP_CATEGORY_META);

export const helpCategoryLabel = (key: string | null | undefined): string =>
  (key && HELP_CATEGORY_META[key]?.label) || key || "Outros";

/** Artigos em destaque na página inicial da Central. */
export const FEATURED_HELP_SLUGS = [
  "primeiros-passos-slideai",
  "custo-por-apresentacao",
  "planos-e-precos",
  "falas-dos-apresentadores",
  "cancelar-assinatura",
  "reembolso",
];
