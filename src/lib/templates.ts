// Catálogo de templates pré-definidos. Cada template apenas pré-preenche
// o gerador (/gerar?template=ID) — a IA gera o conteúdo final.
export interface TemplateSeed {
  id: string;
  title: string;
  description: string;
  category: "Negócios" | "Educação" | "Pitch" | "Marketing" | "Pessoal" | "Eventos";
  emoji: string;
  // Cores de preview (não viram tema final — só para o card)
  bg: string;
  accent: string;
  // Pré-preenche o formulário
  seed: {
    title: string;
    description: string;
    type: string;
    slidesCount: number;
    theme: string;
    fontStyle: string;
    includeCharts: boolean;
    includeImages: boolean;
  };
}

export const TEMPLATES: TemplateSeed[] = [
  {
    id: "pitch-startup",
    title: "Pitch de Startup",
    description: "Estrutura clássica de pitch deck (problema, solução, mercado, tração, time, ask).",
    category: "Pitch", emoji: "🚀", bg: "#0F172A", accent: "#6C47FF",
    seed: { title: "Pitch — [Sua Startup]", description: "Pitch deck completo para investidores: problema, solução, mercado endereçável (TAM/SAM/SOM), modelo de negócio, tração, concorrência, time e ask de captação.", type: "Pitch", slidesCount: 12, theme: "auto", fontStyle: "modern-sans", includeCharts: true, includeImages: true },
  },
  {
    id: "vendas-saas",
    title: "Apresentação Comercial SaaS",
    description: "Demonstração comercial focada em dores, solução, ROI e prova social.",
    category: "Negócios", emoji: "💼", bg: "#0B1220", accent: "#3B82F6",
    seed: { title: "Apresentação Comercial — [Produto]", description: "Apresentação para reunião comercial B2B: dor do cliente, solução proposta, diferenciais, casos de sucesso, ROI esperado e próximos passos.", type: "Vendas", slidesCount: 10, theme: "profissional-azul", fontStyle: "modern-sans", includeCharts: true, includeImages: true },
  },
  {
    id: "relatorio-trimestral",
    title: "Relatório Trimestral",
    description: "Resultados do trimestre com KPIs, gráficos e próximos passos.",
    category: "Negócios", emoji: "📊", bg: "#1E293B", accent: "#10B981",
    seed: { title: "Resultados Q[X] [Ano]", description: "Relatório de resultados trimestrais com receita, KPIs principais, principais conquistas, desafios e plano para o próximo trimestre.", type: "Corporativo", slidesCount: 10, theme: "profissional-azul", fontStyle: "modern-sans", includeCharts: true, includeImages: false },
  },
  {
    id: "aula-historia",
    title: "Aula Expositiva",
    description: "Aula didática com contexto, conceitos-chave, exemplos e exercícios.",
    category: "Educação", emoji: "📚", bg: "#1F1410", accent: "#F97316",
    seed: { title: "Aula: [Tema]", description: "Aula expositiva sobre o tema: contexto histórico, conceitos centrais, exemplos práticos, fontes e exercícios para fixação. Linguagem clara e didática.", type: "Educacional", slidesCount: 12, theme: "auto", fontStyle: "editorial", includeCharts: false, includeImages: true },
  },
  {
    id: "tcc-defesa",
    title: "Defesa de TCC/Tese",
    description: "Estrutura acadêmica para defesa: introdução, metodologia, resultados e conclusão.",
    category: "Educação", emoji: "🎓", bg: "#0F172A", accent: "#A855F7",
    seed: { title: "Defesa: [Título do Trabalho]", description: "Apresentação de defesa acadêmica: justificativa, problema de pesquisa, hipóteses, metodologia, revisão da literatura, resultados, discussão e conclusões.", type: "Acadêmico", slidesCount: 14, theme: "elegante-escuro", fontStyle: "classic-serif", includeCharts: true, includeImages: false },
  },
  {
    id: "marketing-lancamento",
    title: "Lançamento de Produto",
    description: "Plano de go-to-market com posicionamento, canais, cronograma e métricas.",
    category: "Marketing", emoji: "🎯", bg: "#1C1018", accent: "#EC4899",
    seed: { title: "Lançamento — [Produto]", description: "Plano de lançamento de produto: posicionamento, persona, proposta de valor, canais de aquisição, cronograma, orçamento e métricas de sucesso.", type: "Marketing", slidesCount: 11, theme: "vibrante-colorido", fontStyle: "bold-display", includeCharts: true, includeImages: true },
  },
  {
    id: "marketing-redes",
    title: "Estratégia de Redes Sociais",
    description: "Plano editorial com pilares de conteúdo, frequência e métricas.",
    category: "Marketing", emoji: "📱", bg: "#1E1B4B", accent: "#8B5CF6",
    seed: { title: "Estratégia Social — [Marca]", description: "Estratégia de conteúdo para redes sociais: análise de público, pilares de conteúdo, frequência por plataforma, calendário editorial, formatos e KPIs.", type: "Marketing", slidesCount: 10, theme: "roxo-criativo", fontStyle: "modern-sans", includeCharts: true, includeImages: true },
  },
  {
    id: "evento-workshop",
    title: "Workshop / Treinamento",
    description: "Conteúdo prático com objetivos, agenda, exercícios e materiais.",
    category: "Eventos", emoji: "🛠️", bg: "#064E3B", accent: "#34D399",
    seed: { title: "Workshop: [Tema]", description: "Workshop prático: objetivos de aprendizagem, agenda, conceitos-chave, exercícios hands-on, recursos complementares e plano de ação.", type: "Treinamento", slidesCount: 10, theme: "verde-natureza", fontStyle: "modern-sans", includeCharts: false, includeImages: true },
  },
  {
    id: "pessoal-portfolio",
    title: "Portfólio Profissional",
    description: "Apresentação de carreira, projetos e conquistas.",
    category: "Pessoal", emoji: "👤", bg: "#0F172A", accent: "#F43F5E",
    seed: { title: "Portfólio — [Seu Nome]", description: "Apresentação pessoal de portfólio: trajetória, principais habilidades, projetos de destaque com resultados, depoimentos e contato.", type: "Pessoal", slidesCount: 9, theme: "rose-gold", fontStyle: "editorial", includeCharts: false, includeImages: true },
  },
  {
    id: "negocios-plano",
    title: "Plano de Negócios",
    description: "Visão completa: mercado, modelo, finanças, time e roadmap.",
    category: "Negócios", emoji: "📈", bg: "#0F172A", accent: "#6C47FF",
    seed: { title: "Plano de Negócios — [Empresa]", description: "Plano de negócios: sumário executivo, análise de mercado, modelo de negócio, plano de marketing e vendas, projeções financeiras, time e roadmap.", type: "Corporativo", slidesCount: 14, theme: "auto", fontStyle: "modern-sans", includeCharts: true, includeImages: true },
  },
  {
    id: "evento-palestra",
    title: "Palestra / Keynote",
    description: "Estrutura inspiracional com história, ideia central e chamada à ação.",
    category: "Eventos", emoji: "🎤", bg: "#1A1A1A", accent: "#A855F7",
    seed: { title: "Palestra: [Tema]", description: "Keynote inspiracional: gancho inicial, contexto, ideia central, exemplos marcantes, lições aprendidas e chamada à ação para o público.", type: "Palestra", slidesCount: 10, theme: "elegante-escuro", fontStyle: "bold-display", includeCharts: false, includeImages: true },
  },
  {
    id: "pessoal-curriculo",
    title: "CV Visual",
    description: "Currículo em formato apresentação para entrevistas.",
    category: "Pessoal", emoji: "📄", bg: "#FFFFFF", accent: "#0F172A",
    seed: { title: "CV — [Seu Nome]", description: "Currículo em formato visual: resumo profissional, experiências relevantes, formação, skills, certificações e projetos pessoais.", type: "Pessoal", slidesCount: 8, theme: "minimalista-branco", fontStyle: "minimal-clean", includeCharts: false, includeImages: false },
  },
];

export const TEMPLATE_CATEGORIES = ["Todos", "Negócios", "Educação", "Pitch", "Marketing", "Pessoal", "Eventos"] as const;
