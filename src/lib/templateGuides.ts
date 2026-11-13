// Guias dos templates (/templates/<id>): estrutura slide a slide, dicas, erros
// comuns e perguntas frequentes de cada modelo. São páginas para quem busca
// "como fazer uma apresentação de X" e chega pelo Google; o botão "Usar este
// template" leva ao gerador (/gerar?template=<id>) com o formulário preenchido.
//
// Regras do conteúdo (as mesmas da Central de Ajuda): português do Brasil,
// frases curtas, nada de recurso que o produto não tem. A quantidade de itens
// em `outline` é igual a `seed.slidesCount` do template (o teste
// src/test/templateGuides.test.ts confere).

export interface TemplateGuide {
  /** Mesmo id de src/lib/templates.ts (permanente: /gerar?template=<id> usa). */
  id: string;
  /** <title>, até 60 caracteres. */
  seoTitle: string;
  /** Meta description, entre 120 e 160 caracteres. */
  metaDescription: string;
  h1: string;
  intro: string[];
  /** Para quem o modelo serve. */
  audience: string;
  outline: { title: string; text: string }[];
  tips: string[];
  mistakes: string[];
  faq: { q: string; a: string }[];
}

/** Data da última revisão do conteúdo dos guias (dateModified do JSON-LD). */
export const TEMPLATE_GUIDES_UPDATED = "2026-11-12";

export const TEMPLATE_GUIDES: TemplateGuide[] = [
  {
    id: "pitch-startup",
    seoTitle: "Pitch Deck para Startup: Modelo de 12 Slides | SlideAI",
    metaDescription: "Estrutura de pitch deck slide a slide: problema, solução, mercado (TAM/SAM/SOM), tração, time e pedido de captação. Gere o seu pitch com IA no SlideAI.",
    h1: "Modelo de pitch deck para startup: estrutura de 12 slides",
    intro: [
      "Um pitch deck tem uma função: fazer o investidor querer a próxima reunião. Para isso ele precisa contar, em poucos minutos, qual problema você resolve, por que a sua solução é melhor, qual o tamanho da oportunidade e o que você já provou.",
      "Este modelo segue a ordem que investidores costumam esperar e cabe numa apresentação de 10 minutos. Use-o como roteiro: a IA escreve a primeira versão a partir do que você contar sobre a startup, e você ajusta números e argumentos no editor.",
    ],
    audience: "Fundadores que vão captar com anjos, aceleradoras ou fundos, participar de um programa de aceleração ou apresentar em demo day.",
    outline: [
      { title: "Capa", text: "Nome da startup, logo e uma frase que diga o que vocês fazem, sem jargão. Inclua um contato." },
      { title: "Problema", text: "A dor do cliente, quem a sente e quanto ela custa hoje. Um dado ou um exemplo real vale mais que adjetivos." },
      { title: "Solução", text: "Como o produto resolve o problema. Um antes e depois deixa o ganho claro em segundos." },
      { title: "Produto", text: "Telas, fluxo principal ou demonstração. Mostre o diferencial funcionando, não uma lista de funções." },
      { title: "Mercado", text: "TAM, SAM e SOM com a fonte e o método de cálculo. Prefira a conta de baixo para cima (clientes × ticket)." },
      { title: "Modelo de negócio", text: "Como vocês ganham dinheiro: preço, ticket médio, recorrência e margem, se já houver." },
      { title: "Tração", text: "Métricas reais: receita, clientes, crescimento mês a mês, retenção ou lista de espera. É o slide mais lido." },
      { title: "Concorrência", text: "Tabela ou matriz de posicionamento com concorrentes diretos e alternativas que o cliente usa hoje." },
      { title: "Estratégia de crescimento", text: "Canais de aquisição, custo de aquisição (CAC) e parcerias que vão levar o produto ao mercado." },
      { title: "Time", text: "Fundadores e pessoas-chave, com a experiência que torna o time capaz de executar. Diga quem falta contratar." },
      { title: "Finanças e projeções", text: "Projeção de 3 anos com as premissas explícitas e identificada como estimativa." },
      { title: "Pedido de captação", text: "Quanto vocês captam, como vão usar os recursos e quais marcos o dinheiro compra. Feche com o contato." },
    ],
    tips: [
      "Coloque na descrição os seus números reais (receita, clientes, crescimento). A IA não conhece a sua startup e não deve inventar tração.",
      "Use o tipo Pitch de negócios com a persona Líder inspiracional para um tom de visão; para reuniões técnicas, Autoridade técnica.",
      "Uma ideia por slide. Se o investidor precisa ler um parágrafo, ele para de ouvir você.",
      "Tenha duas versões: uma com pouco texto para apresentar e outra mais completa para enviar por e-mail. A profundidade do texto (curto ou longo) muda isso no formulário.",
      "Ative as falas dos apresentadores para receber um roteiro e ensaiar o tempo de cada slide.",
    ],
    mistakes: [
      "Projeções sem premissas, ou o clássico \"se pegarmos só 1% de um mercado bilionário\".",
      "Esconder concorrentes. Dizer que não há concorrência passa a ideia de que não há mercado.",
      "Deixar o pedido de captação vago: sem valor, uso dos recursos e prazo, a conversa não avança.",
    ],
    faq: [
      { q: "Quantos slides deve ter um pitch deck?", a: "Entre 10 e 15 é o mais comum para uma apresentação de 5 a 10 minutos. Este modelo usa 12; no SlideAI você escolhe de 5 a 20 slides antes de gerar e pode remover ou adicionar slides depois." },
      { q: "Posso usar os números que a IA escrever?", a: "Não como dados reais. Informe seus números na descrição para que entrem nos slides e nos gráficos, e marque projeções como estimativas. Revise tudo antes de enviar a um investidor." },
      { q: "Como envio o pitch para investidores?", a: "Exporte em PDF, que abre em qualquer dispositivo, ou em PowerPoint (.pptx) para editar. Também dá para publicar um link público e acompanhar quantas vezes ele foi visto." },
    ],
  },
  {
    id: "vendas-saas",
    seoTitle: "Apresentação Comercial SaaS: Modelo de 10 Slides | SlideAI",
    metaDescription: "Modelo de apresentação comercial B2B para reunião de vendas: dor do cliente, solução, demonstração, ROI, investimento e próximos passos. Crie com IA.",
    h1: "Apresentação comercial SaaS: modelo de 10 slides para reunião de vendas",
    intro: [
      "Uma boa apresentação comercial fala mais do cliente do que da sua empresa. Ela mostra que você entendeu o problema, conecta cada parte da solução a uma dor concreta e termina com um próximo passo combinado.",
      "Este modelo de 10 slides funciona para a primeira reunião ou para a apresentação da proposta. Conte na descrição quem é o cliente e o que ele precisa, e a IA monta a narrativa de dor para solução.",
    ],
    audience: "Vendedores, SDRs, fundadores e times de pré-vendas de empresas de software e serviços B2B.",
    outline: [
      { title: "Capa", text: "Nome do cliente, o objetivo da reunião em uma frase e o seu logo." },
      { title: "O que entendemos", text: "Resumo do contexto do cliente: mercado, momento e objetivos que ele contou nas conversas anteriores." },
      { title: "A dor e o custo dela", text: "O problema principal e quanto ele custa hoje em tempo, dinheiro ou risco." },
      { title: "Solução proposta", text: "Como o produto resolve exatamente essa dor. Evite a lista completa de funções." },
      { title: "Como funciona", text: "O fluxo principal ou uma demonstração, do ponto de vista de quem vai usar." },
      { title: "Diferenciais", text: "Três motivos para escolher você em vez das alternativas, incluindo não fazer nada." },
      { title: "Casos e resultados", text: "Clientes parecidos e resultados que você pode comprovar, com autorização para citá-los." },
      { title: "Retorno esperado", text: "Estimativa de ROI com as premissas do próprio cliente, identificada como estimativa." },
      { title: "Investimento e implantação", text: "Planos, prazo de implantação, suporte e o que o cliente precisa providenciar." },
      { title: "Próximos passos", text: "Ações, responsáveis e datas. A reunião deve terminar com um compromisso." },
    ],
    tips: [
      "Escreva na descrição o nome, o setor e as dores do cliente. Quanto mais específico, menos genérico fica o texto.",
      "Use a persona Vendedor (dor → solução): ela parte do problema do público e conduz até a oferta.",
      "Calcule o ROI com números do cliente. Um retorno genérico é ignorado; um retorno com os dados dele vira argumento interno.",
      "Duplique a apresentação para cada conta e ajuste só o que muda. O tempo de preparação cai bastante.",
    ],
    mistakes: [
      "Abrir com a história da sua empresa. O cliente quer saber se você entendeu o problema dele.",
      "Mostrar funcionalidades sem ligar cada uma a uma dor.",
      "Usar casos de sucesso que você não pode comprovar ou que o cliente citado não autorizou.",
    ],
    faq: [
      { q: "Qual a diferença entre apresentação comercial e proposta comercial?", a: "A apresentação conduz a conversa na reunião; a proposta formaliza escopo, preço e condições. Este modelo cobre a apresentação e termina com investimento e próximos passos, que levam à proposta." },
      { q: "Posso mandar a apresentação para o cliente depois da reunião?", a: "Sim. Exporte em PDF ou publique um link público: o link abre em qualquer dispositivo e mostra a contagem de visualizações, um bom sinal de que a proposta está circulando." },
    ],
  },
  {
    id: "relatorio-trimestral",
    seoTitle: "Apresentação de Resultados Trimestrais: Modelo | SlideAI",
    metaDescription: "Modelo de relatório trimestral em 10 slides: sumário executivo, receita, KPIs contra a meta, desafios e plano do próximo trimestre. Gere com gráficos.",
    h1: "Apresentação de resultados trimestrais: modelo de relatório em 10 slides",
    intro: [
      "Uma apresentação de resultados precisa responder rápido a três perguntas: como fomos, por quê e o que vamos fazer agora. Diretoria e conselho leem o sumário e os gráficos primeiro; o resto serve para quem quer o detalhe.",
      "Este modelo organiza o trimestre nessa ordem. Informe período, unidade e fonte de cada número na descrição e ative a opção de gráficos: a IA transforma os dados em visualizações que você confere e ajusta no editor.",
    ],
    audience: "Gestores, analistas e líderes de área que apresentam resultados para diretoria, conselho ou time.",
    outline: [
      { title: "Capa", text: "Área ou empresa, trimestre e ano, e quem apresenta." },
      { title: "Sumário executivo", text: "Três ou quatro destaques do trimestre, bons e ruins, em uma tela." },
      { title: "Receita e evolução", text: "Receita do trimestre comparada à meta e ao mesmo período do ano anterior." },
      { title: "KPIs contra a meta", text: "Os indicadores principais com valor, meta e variação. Use cores com moderação." },
      { title: "Conquistas", text: "Entregas e resultados que mudaram o trimestre, com o impacto de cada um." },
      { title: "Desafios e desvios", text: "O que ficou abaixo do esperado, a causa provável e o que já foi feito." },
      { title: "Análise por segmento", text: "Abertura por produto, região, canal ou equipe, onde a diferença estiver." },
      { title: "Clientes e operação", text: "Indicadores de clientes (retenção, satisfação) ou de operação (prazo, custo)." },
      { title: "Plano do próximo trimestre", text: "Prioridades, metas e as ações que vão corrigir os desvios." },
      { title: "Decisões necessárias", text: "O que você precisa da diretoria: aprovação, orçamento ou mudança de prioridade." },
    ],
    tips: [
      "Para cada número, diga o período, a unidade e a fonte. Gráfico sem unidade gera mais perguntas que respostas.",
      "Compare sempre com a meta e com um período anterior: um número sozinho não diz se o resultado é bom.",
      "Uma mensagem por gráfico, escrita no título do slide (\"Receita cresceu 12% com o novo canal\").",
      "Use o tipo Corporativo com a persona Autoridade técnica para um tom objetivo, e mantenha o mesmo tema visual em todos os trimestres.",
    ],
    mistakes: [
      "Tabelas enormes copiadas da planilha. Leve o detalhe para um anexo.",
      "Esconder resultados ruins. A credibilidade vem de explicar o desvio e o plano para corrigi-lo.",
      "Terminar sem pedir nada: o último slide deve dizer que decisão você precisa.",
    ],
    faq: [
      { q: "A IA cria os gráficos com os meus dados?", a: "Sim, quando você informa os dados na descrição e ativa a opção Gráficos e dados. Confira cada valor depois de gerar: os gráficos podem ser ajustados no editor." },
      { q: "Quantos slides deve ter um relatório trimestral?", a: "Para uma reunião de 20 a 30 minutos, de 8 a 12 slides costuma bastar. Detalhes que poucos vão consultar ficam melhores num anexo em PDF." },
      { q: "Como apresentar um resultado abaixo da meta?", a: "Mostre o número com a mesma clareza dos bons resultados, explique a causa provável e apresente o plano de correção com prazo e responsável. Diretoria e conselho confiam mais em quem antecipa o problema do que em quem o esconde." },
    ],
  },
  {
    id: "aula-historia",
    seoTitle: "Slides para Aula: Modelo de Aula Expositiva | SlideAI",
    metaDescription: "Modelo de slides para aula expositiva em 12 slides: objetivos, conceitos, exemplos, síntese e exercícios. Informe a série e gere a aula com IA.",
    h1: "Slides para aula: modelo de aula expositiva em 12 slides",
    intro: [
      "Slides de aula funcionam melhor como apoio visual do que como texto para ler em voz alta. Uma boa sequência ativa o que a turma já sabe, apresenta poucos conceitos de cada vez, mostra exemplos e termina com uma atividade.",
      "Este modelo segue essa sequência para uma aula de 40 a 60 minutos. Informe a disciplina, a série e o objetivo da aula na descrição, e confira datas, fontes e respostas antes de usar em sala.",
    ],
    audience: "Professores do ensino fundamental, médio, técnico e superior, e estudantes que precisam apresentar um tema para a turma.",
    outline: [
      { title: "Capa", text: "Tema da aula, disciplina, série ou turma e o nome do professor." },
      { title: "Objetivos de aprendizagem", text: "O que a turma vai saber ou conseguir fazer ao fim da aula, em dois ou três itens." },
      { title: "Pergunta disparadora", text: "Uma pergunta ou situação do dia a dia que conecta o tema ao que os alunos já sabem." },
      { title: "Contexto", text: "Onde e quando o assunto acontece, ou por que ele importa." },
      { title: "Conceito central 1", text: "A primeira ideia-chave, explicada com uma frase e uma imagem." },
      { title: "Conceito central 2", text: "A segunda ideia-chave, ligada à primeira." },
      { title: "Exemplo prático", text: "Um caso concreto que mostra os conceitos funcionando." },
      { title: "Esquema ou linha do tempo", text: "Um diagrama que organiza a sequência, as causas ou as partes do tema." },
      { title: "Estudo de caso ou curiosidade", text: "Um fato marcante que ajuda a memorizar e puxa a discussão." },
      { title: "Síntese", text: "Resumo visual da aula em poucas palavras, como um mapa mental." },
      { title: "Exercícios de fixação", text: "Duas ou três questões para resolver em sala, com nível crescente." },
      { title: "Referências e tarefa", text: "Fontes consultadas e a atividade para casa ou a próxima aula." },
    ],
    tips: [
      "Diga na descrição a série ou a idade da turma: a linguagem e os exemplos mudam bastante.",
      "Use o tipo Escolar com a persona Educador, que explica com calma e usa analogias.",
      "Prefira texto curto nos slides e ative as falas dos apresentadores para ter um roteiro do que dizer em cada slide.",
      "Revise datas, nomes, fórmulas e respostas dos exercícios. Textos gerados por IA podem conter imprecisões.",
      "Antes da aula, abra a apresentação no modo apresentação e passe por todos os slides no projetor da sala para conferir contraste e tamanho das letras.",
    ],
    mistakes: [
      "Parágrafos longos no slide, lidos em voz alta pelo professor.",
      "Aula sem nenhuma atividade: sem prática, a turma esquece rápido.",
      "Letras pequenas e imagens escuras, que somem no projetor da sala.",
    ],
    faq: [
      { q: "Quantos slides usar numa aula de 50 minutos?", a: "Uma referência é um slide a cada 3 a 5 minutos, ou seja, de 10 a 15 slides, deixando tempo para perguntas e exercícios. No SlideAI você escolhe de 5 a 20 slides." },
      { q: "Posso apresentar a aula sem internet?", a: "O link público precisa de conexão. Para a sala sem internet, exporte a aula em PowerPoint ou PDF antes e leve o arquivo." },
    ],
  },
  {
    id: "tcc-defesa",
    seoTitle: "Apresentação de TCC: Modelo de Slides para Defesa | SlideAI",
    metaDescription: "Modelo de apresentação de TCC em 14 slides: problema, objetivos, metodologia, resultados e conclusão. Monte os slides da defesa a partir do seu trabalho.",
    h1: "Apresentação de TCC: modelo de slides para a defesa em 14 slides",
    intro: [
      "Na defesa do TCC, a banca já leu o trabalho. A apresentação serve para mostrar que você domina a pesquisa: o problema, o caminho que escolheu para investigá-lo, o que encontrou e o que isso significa.",
      "Este modelo de 14 slides cabe numa defesa de 15 a 20 minutos e serve também para dissertações e teses. Cole na descrição o resumo, os objetivos, a metodologia e os principais resultados: os slides saem do seu trabalho, não de um texto genérico.",
    ],
    audience: "Estudantes de graduação, especialização, mestrado e doutorado que vão defender TCC, monografia, dissertação ou tese.",
    outline: [
      { title: "Capa", text: "Título do trabalho, seu nome, orientador, curso, instituição e data." },
      { title: "Introdução", text: "O tema e o contexto em que ele se insere, em poucas linhas." },
      { title: "Problema de pesquisa", text: "A pergunta que o trabalho responde, escrita de forma direta." },
      { title: "Justificativa", text: "Por que o problema importa, para a área e para a sociedade." },
      { title: "Objetivos", text: "Objetivo geral e objetivos específicos, como no trabalho escrito." },
      { title: "Hipóteses ou perguntas", text: "O que você esperava encontrar, quando o trabalho tiver hipóteses." },
      { title: "Referencial teórico", text: "Os autores e conceitos principais que sustentam a análise." },
      { title: "Metodologia", text: "Tipo de pesquisa, abordagem e etapas. A banca costuma perguntar sobre isso." },
      { title: "Coleta e amostra", text: "Onde, como e com quem os dados foram coletados, e o tamanho da amostra." },
      { title: "Resultados (parte 1)", text: "Os achados principais, de preferência em gráfico ou tabela simples." },
      { title: "Resultados (parte 2)", text: "Os demais resultados relevantes para responder ao problema." },
      { title: "Discussão", text: "O que os resultados significam e como dialogam com o referencial teórico." },
      { title: "Conclusão", text: "Resposta ao problema, limitações da pesquisa e sugestões de trabalhos futuros." },
      { title: "Referências e agradecimentos", text: "As referências centrais citadas na apresentação e um agradecimento à banca." },
    ],
    tips: [
      "Use o seu trabalho como base: quanto mais conteúdo real na descrição, mais fiel fica a apresentação.",
      "Escolha o tipo Acadêmico com a persona Autoridade técnica para um texto preciso e com os termos da área.",
      "Para 15 a 20 minutos, planeje cerca de um slide por minuto e ensaie com cronômetro.",
      "Use as notas do apresentador para anotar respostas às perguntas prováveis da banca.",
      "Confira cada referência e cada dado. A IA pode errar, e a defesa é sua.",
    ],
    mistakes: [
      "Copiar parágrafos do trabalho escrito para os slides.",
      "Apresentar resultados só em texto, quando um gráfico simples mostraria a diferença.",
      "Esconder as limitações. Reconhecê-las mostra maturidade e costuma evitar perguntas difíceis.",
    ],
    faq: [
      { q: "Quantos slides deve ter uma apresentação de TCC?", a: "Depende do tempo de defesa. Para 15 a 20 minutos, de 12 a 18 slides costuma funcionar. Confira as regras do seu curso, que às vezes definem tempo e formato." },
      { q: "A IA escreve o meu TCC?", a: "Não é esse o objetivo. O SlideAI transforma o conteúdo do seu trabalho em slides. Revise tudo e siga as regras da sua instituição sobre o uso de IA." },
      { q: "Consigo levar a apresentação para o computador da faculdade?", a: "Sim. Exporte em PowerPoint (.pptx) ou PDF e leve num pen drive, ou abra o link público da apresentação no navegador, sem precisar entrar na sua conta." },
    ],
  },
  {
    id: "marketing-lancamento",
    seoTitle: "Plano de Lançamento de Produto: Modelo de Slides | SlideAI",
    metaDescription: "Modelo de apresentação de lançamento de produto (go-to-market): persona, posicionamento, canais, cronograma, orçamento e métricas. Gere com IA.",
    h1: "Plano de lançamento de produto: modelo de apresentação go-to-market",
    intro: [
      "Um plano de lançamento alinha produto, marketing e vendas em torno das mesmas respostas: para quem é o produto, qual a mensagem, por quais canais ele chega ao cliente, em que datas e como vamos medir o sucesso.",
      "Este modelo de 11 slides organiza o go-to-market nessa ordem. Descreva o produto, o público e o orçamento disponível, e a IA monta a primeira versão do plano para você discutir com o time.",
    ],
    audience: "Gerentes de produto e de marketing, fundadores e agências que planejam o lançamento de um produto, serviço ou nova funcionalidade.",
    outline: [
      { title: "Capa", text: "Nome do produto, data prevista de lançamento e o time responsável." },
      { title: "Oportunidade", text: "O problema ou a demanda de mercado que justifica o lançamento agora." },
      { title: "Persona", text: "Quem é o cliente ideal: perfil, rotina, dores e onde ele busca informação." },
      { title: "Proposta de valor e posicionamento", text: "O que o produto entrega, para quem e por que é diferente das alternativas." },
      { title: "Mensagem principal", text: "A frase central da campanha e as provas que a sustentam." },
      { title: "Canais de aquisição", text: "Canais pagos, orgânicos e de parceria, com o papel de cada um no funil." },
      { title: "Cronograma", text: "Pré-lançamento, lançamento e pós-lançamento, com marcos e datas." },
      { title: "Orçamento", text: "Distribuição do investimento por canal e por fase." },
      { title: "Metas e métricas", text: "Os KPIs do lançamento (leads, vendas, ativação) e a meta de cada um." },
      { title: "Riscos e plano B", text: "O que pode dar errado e a resposta já combinada para cada risco." },
      { title: "Responsáveis e próximos passos", text: "Quem faz o quê até a data de lançamento." },
    ],
    tips: [
      "Informe o orçamento e o prazo reais: um plano sem limite de recursos não ajuda a decidir.",
      "Use o tipo Marketing com a persona Vendedor para um texto persuasivo, ou Autoridade técnica para apresentar à diretoria.",
      "Defina poucas métricas, ligadas ao objetivo do lançamento, e diga como cada uma será medida.",
      "Gere uma versão interna (detalhada) e duplique para uma versão resumida para parceiros.",
      "Ative os gráficos e informe as metas e o orçamento na descrição: a distribuição por canal vira uma visualização fácil de discutir.",
    ],
    mistakes: [
      "Tentar falar com todo mundo: sem persona clara, a mensagem fica genérica.",
      "Cronograma sem responsáveis, que vira lista de desejos.",
      "Medir só alcance e curtidas quando o objetivo é venda ou ativação.",
    ],
    faq: [
      { q: "O que não pode faltar num plano de go-to-market?", a: "Público-alvo, proposta de valor, canais, cronograma, orçamento e métricas. Este modelo cobre todos e acrescenta riscos e responsáveis." },
      { q: "Posso editar o plano depois de gerado?", a: "Sim. No editor você muda textos, imagens, gráficos e a ordem dos slides, e pode pedir ajustes ao assistente de edição em português." },
      { q: "Com quanto tempo de antecedência preparar o plano de lançamento?", a: "Depende do tamanho do lançamento, mas o plano costuma ser apresentado semanas antes da data, para dar tempo de produzir conteúdo, ajustar canais e treinar o time de vendas. Revise o cronograma a cada reunião de acompanhamento." },
    ],
  },
  {
    id: "marketing-redes",
    seoTitle: "Estratégia de Redes Sociais: Modelo de Slides | SlideAI",
    metaDescription: "Modelo de apresentação de estratégia de redes sociais em 10 slides: diagnóstico, persona, pilares de conteúdo, calendário editorial e KPIs.",
    h1: "Estratégia de redes sociais: modelo de apresentação do plano editorial",
    intro: [
      "Uma estratégia de redes sociais transforma \"vamos postar mais\" num plano com objetivo, público, assuntos, frequência e forma de medir. É o documento que aprova o trabalho com o cliente ou com a diretoria.",
      "Este modelo de 10 slides parte do diagnóstico atual e chega a um calendário editorial e aos indicadores. Conte na descrição a marca, as redes usadas hoje e o objetivo do plano.",
    ],
    audience: "Social media, analistas de marketing, agências e empreendedores que planejam a presença da marca nas redes.",
    outline: [
      { title: "Capa", text: "Marca, período do plano e quem apresenta." },
      { title: "Diagnóstico atual", text: "Seguidores, alcance, engajamento e os conteúdos que mais funcionaram." },
      { title: "Público e persona", text: "Quem a marca quer alcançar e o que essa pessoa procura nas redes." },
      { title: "Objetivos", text: "Metas mensuráveis e com prazo, ligadas ao negócio (vendas, leads, reconhecimento)." },
      { title: "Pilares de conteúdo", text: "Três a cinco temas fixos, com exemplos de posts para cada um." },
      { title: "Plataformas", text: "O papel de cada rede no plano: onde descobrir, onde se relacionar e onde converter." },
      { title: "Frequência e formatos", text: "Quantos posts por semana em cada rede e quais formatos (vídeo curto, carrossel, stories)." },
      { title: "Calendário editorial", text: "Exemplo de um mês de publicações, com datas importantes do setor." },
      { title: "KPIs e relatórios", text: "Indicadores acompanhados, meta de cada um e a periodicidade dos relatórios." },
      { title: "Recursos e próximos passos", text: "Equipe, ferramentas, orçamento de mídia e o que acontece na primeira semana." },
    ],
    tips: [
      "Inclua na descrição os números atuais das redes: o diagnóstico fica concreto e os gráficos mostram o ponto de partida.",
      "Escolha o tipo Marketing e um tema visual próximo da identidade da marca.",
      "Mostre exemplos de posts para cada pilar: o cliente aprova com mais segurança quando vê o conteúdo.",
      "Mantenha uma apresentação por período (trimestre, semestre) e duplique para atualizar os resultados.",
      "Inclua no slide de KPIs o que acontece se a meta não for atingida: quais ajustes de conteúdo ou de mídia entram em teste.",
    ],
    mistakes: [
      "Objetivos vagos, como \"aumentar o engajamento\", sem número nem prazo.",
      "Estar em todas as redes com a mesma frequência, sem considerar a equipe disponível.",
      "Relatar só métricas de vaidade, sem ligar o resultado ao objetivo do negócio.",
    ],
    faq: [
      { q: "O que deve ter uma apresentação de estratégia de redes sociais?", a: "Diagnóstico, público, objetivos, pilares de conteúdo, plataformas, frequência, calendário e indicadores. Este modelo segue essa ordem em 10 slides." },
      { q: "Consigo compartilhar com o cliente sem enviar arquivo?", a: "Sim. Publique a apresentação e envie o link público: ele abre no celular e no computador, em tela cheia." },
      { q: "Com que frequência atualizar a estratégia de redes sociais?", a: "Revise os indicadores todo mês e a estratégia a cada trimestre, ou antes se o objetivo do negócio mudar. Duplique a apresentação anterior e atualize o diagnóstico, os resultados e o calendário, mantendo a comparação com o período passado." },
    ],
  },
  {
    id: "evento-workshop",
    seoTitle: "Apresentação de Workshop e Treinamento: Modelo | SlideAI",
    metaDescription: "Modelo de apresentação para workshop ou treinamento em 10 slides: objetivos, agenda, conceitos, exercício prático e plano de ação. Gere com IA.",
    h1: "Apresentação de workshop ou treinamento: modelo de 10 slides",
    intro: [
      "Num workshop, os slides guiam a prática. Eles mostram para onde o grupo vai, explicam o mínimo de teoria necessário e dão instruções claras para cada exercício.",
      "Este modelo de 10 slides funciona para treinamentos internos, oficinas e aulas práticas de duas a quatro horas. Descreva o tema, o público e quanto tempo você tem.",
    ],
    audience: "Facilitadores, instrutores, times de RH e de treinamento, consultores e professores de cursos livres.",
    outline: [
      { title: "Capa", text: "Tema do workshop, data e quem facilita." },
      { title: "Boas-vindas e combinados", text: "Apresentação rápida, regras do encontro e como o grupo vai participar." },
      { title: "Objetivos de aprendizagem", text: "O que cada participante vai conseguir fazer ao final." },
      { title: "Agenda", text: "Blocos com horários, incluindo pausas e exercícios." },
      { title: "Conceito-chave 1", text: "A primeira ideia necessária para a prática, com um exemplo." },
      { title: "Conceito-chave 2", text: "A segunda ideia, ligada ao exercício que vem a seguir." },
      { title: "Exercício prático", text: "Instruções passo a passo, tempo e o que entregar ao final." },
      { title: "Discussão", text: "Perguntas para o grupo compartilhar resultados e aprendizados." },
      { title: "Plano de ação", text: "O que cada pessoa vai aplicar no trabalho nos próximos dias." },
      { title: "Recursos e avaliação", text: "Materiais complementares, contato do facilitador e o link da avaliação." },
    ],
    tips: [
      "Informe a duração e o tamanho do grupo na descrição: isso muda a quantidade de exercícios.",
      "Use a persona Educador para explicações didáticas e texto curto nos slides.",
      "Deixe as instruções do exercício num slide próprio, visível durante toda a atividade.",
      "Com vários facilitadores, defina de 1 a 8 apresentadores e ative as falas: cada um recebe a sua parte do roteiro.",
      "Planeje uma pausa a cada 60 a 90 minutos e coloque-a na agenda: o grupo participa melhor quando sabe quando vai descansar.",
    ],
    mistakes: [
      "Teoria demais antes da primeira prática: o grupo perde energia.",
      "Exercício sem tempo definido nem entrega clara.",
      "Terminar sem plano de ação, o que reduz a aplicação no dia a dia.",
      "Ignorar o tempo de cada bloco e cortar o exercício final, que é onde o aprendizado se consolida.",
    ],
    faq: [
      { q: "Quantos slides para um workshop de 3 horas?", a: "Workshops têm menos slides por hora que palestras, porque boa parte do tempo é prática. De 10 a 20 slides costuma bastar para 3 horas." },
      { q: "Dá para dividir a apresentação entre facilitadores?", a: "Sim. Escolha o número de apresentadores no formulário e ative as falas: o roteiro é dividido por pessoa e por slide." },
      { q: "Como saber se o workshop funcionou?", a: "Defina antes o que cada participante deve conseguir fazer ao final e verifique isso no exercício prático. Feche com uma avaliação curta, de duas ou três perguntas, e acompanhe o plano de ação algumas semanas depois." },
      { q: "O modelo serve para workshop online?", a: "Sim. Compartilhe a aba do navegador com a apresentação em tela cheia e deixe as instruções do exercício num slide fixo enquanto o grupo trabalha. Em salas de reunião online, combine no início como as pessoas vão pedir a palavra." },
    ],
  },
  {
    id: "pessoal-portfolio",
    seoTitle: "Portfólio Profissional em Slides: Modelo | SlideAI",
    metaDescription: "Modelo de portfólio profissional em 9 slides: apresentação pessoal, trajetória, habilidades e projetos com resultados. Crie e compartilhe por link.",
    h1: "Portfólio profissional em slides: modelo de apresentação de carreira",
    intro: [
      "Um portfólio em slides conta a sua trajetória com provas: o que você fez, como fez e qual foi o resultado. É útil em entrevistas, propostas para clientes e processos seletivos que pedem uma apresentação pessoal.",
      "Este modelo de 9 slides destaca três projetos no formato desafio, ação e resultado. Descreva a sua experiência e os projetos que quer mostrar, e depois ajuste textos e imagens no editor.",
    ],
    audience: "Profissionais em busca de emprego, freelancers, designers, desenvolvedores, consultores e estudantes montando o primeiro portfólio.",
    outline: [
      { title: "Capa", text: "Seu nome, a área de atuação e uma foto profissional." },
      { title: "Quem sou", text: "Resumo em três frases: o que você faz, para quem e o que te diferencia." },
      { title: "Trajetória", text: "Linha do tempo com as experiências e formações mais relevantes." },
      { title: "Habilidades", text: "Competências técnicas e comportamentais, com o nível de cada uma." },
      { title: "Projeto de destaque 1", text: "Desafio, o que você fez e o resultado, com números quando possível." },
      { title: "Projeto de destaque 2", text: "Um projeto que mostre outra habilidade ou outro tipo de cliente." },
      { title: "Projeto de destaque 3", text: "O projeto mais recente ou o mais alinhado à vaga desejada." },
      { title: "Depoimentos", text: "Recomendações de clientes, gestores ou colegas, com nome e cargo." },
      { title: "Contato", text: "E-mail, LinkedIn, site e o que você procura agora." },
    ],
    tips: [
      "Escolha projetos que conversem com a vaga ou o cliente que você quer conquistar.",
      "No editor, troque as imagens sugeridas por fotos e telas reais dos seus projetos, colando o endereço (URL) de cada imagem.",
      "Use resultados mensuráveis: \"reduzi o tempo de entrega em 30%\" diz mais que \"melhorei processos\".",
      "Publique a apresentação no seu portfólio público do SlideAI e use o link no currículo e no LinkedIn.",
      "Atualize o portfólio a cada projeto relevante, trocando o mais antigo pelo mais recente, em vez de só acrescentar slides.",
      "Use a persona Autoridade técnica para portfólios técnicos e Líder inspiracional para cargos de gestão.",
    ],
    mistakes: [
      "Mostrar todos os projetos que você já fez, em vez dos três melhores.",
      "Descrever tarefas em vez de resultados.",
      "Usar depoimentos sem autorização de quem os deu.",
      "Mostrar trabalhos de clientes com informações confidenciais sem permissão.",
      "Terminar sem dizer o que você procura agora: vaga, tipo de projeto ou cliente ideal.",
    ],
    faq: [
      { q: "Qual a diferença entre portfólio em slides e currículo?", a: "O currículo resume a trajetória; o portfólio mostra trabalhos e resultados com mais detalhe e imagens. Para um currículo visual mais curto, veja o modelo CV Visual." },
      { q: "Posso deixar o portfólio público?", a: "Sim. Ao publicar, a apresentação ganha um link público e pode aparecer no seu portfólio no SlideAI. Você despublica quando quiser." },
      { q: "Quantos projetos mostrar num portfólio em slides?", a: "Três projetos bem contados costumam funcionar melhor que dez resumidos. Escolha os que têm resultado claro e que se parecem com o trabalho que você quer conseguir agora." },
    ],
  },
  {
    id: "negocios-plano",
    seoTitle: "Plano de Negócios em Slides: Modelo de 14 Slides | SlideAI",
    metaDescription: "Modelo de plano de negócios em apresentação: sumário executivo, mercado, modelo de negócio, marketing, finanças, investimento, time e roadmap.",
    h1: "Plano de negócios em apresentação: modelo de 14 slides",
    intro: [
      "O plano de negócios em slides resume o documento completo para sócios, bancos, investidores ou programas de apoio. Ele precisa mostrar que a oportunidade é real, que o modelo se sustenta e que o time sabe executar.",
      "Este modelo de 14 slides cobre as seções clássicas do plano de negócios. Descreva a empresa, o mercado e os números que você já tem, e revise as projeções com cuidado.",
    ],
    audience: "Empreendedores, pequenas empresas, estudantes de administração e quem vai pedir crédito, investimento ou entrar num programa de aceleração.",
    outline: [
      { title: "Capa", text: "Nome da empresa, logo e a frase que resume o negócio." },
      { title: "Sumário executivo", text: "O negócio inteiro em uma tela: oportunidade, solução, mercado, números e pedido." },
      { title: "Problema e oportunidade", text: "A necessidade do mercado e por que agora é o momento." },
      { title: "Solução e proposta de valor", text: "O produto ou serviço e o benefício principal para o cliente." },
      { title: "Análise de mercado", text: "Tamanho, crescimento e tendências, com as fontes." },
      { title: "Público-alvo", text: "Segmentos de clientes e o perfil do cliente ideal." },
      { title: "Concorrência e diferenciais", text: "Quem disputa o mesmo cliente e por que você vence." },
      { title: "Modelo de negócio", text: "Fontes de receita, preços, custos principais e margem." },
      { title: "Marketing e vendas", text: "Como o cliente conhece, compra e volta a comprar." },
      { title: "Operação", text: "Estrutura, fornecedores, processos e localização." },
      { title: "Projeções financeiras", text: "Receita, custos e resultado em 3 a 5 anos, com premissas explícitas." },
      { title: "Investimento necessário", text: "Quanto é preciso, onde será aplicado e em quanto tempo volta." },
      { title: "Time", text: "Sócios e pessoas-chave, com as competências de cada um." },
      { title: "Roadmap e marcos", text: "As etapas dos próximos 12 a 24 meses e como medir cada uma." },
    ],
    tips: [
      "Use o tipo Corporativo e ative os gráficos para receita, custos e projeções.",
      "Deixe as premissas das projeções visíveis no slide: é a primeira coisa que um banco ou investidor questiona.",
      "Ajuste o tom ao público: Autoridade técnica para banco e programas de apoio, Líder inspiracional para sócios e investidores.",
      "Mantenha a apresentação coerente com o documento completo do plano de negócios.",
      "Deixe um slide de sumário executivo forte: muitas pessoas decidem se continuam ouvindo a partir dele.",
    ],
    mistakes: [
      "Projeções otimistas sem premissas nem cenário conservador.",
      "Mercado descrito só em grandes números, sem chegar ao cliente que você consegue atender.",
      "Esquecer a operação: quem vai produzir, entregar e atender.",
      "Usar números de mercado antigos ou sem fonte.",
    ],
    faq: [
      { q: "Plano de negócios e pitch deck são a mesma coisa?", a: "Não. O pitch deck é curto e feito para despertar interesse de investidores; o plano de negócios é mais completo e inclui operação e finanças detalhadas. Para captação, veja também o modelo de pitch deck." },
      { q: "A IA calcula as projeções financeiras?", a: "Ela organiza e visualiza os números que você informar. Projeções devem vir das suas premissas e planilhas; revise todos os valores antes de apresentar." },
    ],
  },
  {
    id: "evento-palestra",
    seoTitle: "Slides para Palestra e Keynote: Modelo | SlideAI",
    metaDescription: "Modelo de apresentação para palestra ou keynote em 10 slides: gancho de abertura, ideia central, histórias, lições e chamada à ação para o público.",
    h1: "Palestra ou keynote: modelo de apresentação inspiracional em 10 slides",
    intro: [
      "Uma boa palestra se apoia numa única ideia central e em histórias que a tornam memorável. Os slides aparecem para reforçar a emoção e os dados, com muita imagem e pouco texto.",
      "Este modelo de 10 slides segue a estrutura clássica de keynote: abertura com gancho, contexto, ideia central, exemplos, virada e chamada à ação. Descreva o tema, o público e a mensagem que você quer deixar.",
    ],
    audience: "Palestrantes, líderes, professores e profissionais que vão falar em eventos, congressos, convenções de vendas ou encontros internos.",
    outline: [
      { title: "Abertura com gancho", text: "Uma pergunta, um dado surpreendente ou uma imagem forte para capturar a atenção." },
      { title: "Quem fala", text: "Por que você tem algo a dizer sobre o tema, em uma frase." },
      { title: "O contexto", text: "O problema ou a situação que o público reconhece." },
      { title: "Ideia central", text: "A mensagem da palestra em uma frase curta, que a plateia pode repetir." },
      { title: "História ou exemplo 1", text: "Um caso real que prova a ideia central." },
      { title: "Exemplo 2 ou dado marcante", text: "Uma segunda prova, de outro ângulo, para reforçar a mensagem." },
      { title: "A virada", text: "O que muda quando o público aplica a ideia." },
      { title: "Lições", text: "Três aprendizados práticos que o público leva para casa." },
      { title: "Chamada à ação", text: "O que você quer que as pessoas façam a partir de amanhã." },
      { title: "Encerramento", text: "Retome o gancho da abertura e mostre como encontrar você." },
    ],
    tips: [
      "Escolha o tipo Criativo ou Pitch de negócios com a persona Líder inspiracional para um tom de visão e propósito.",
      "Use profundidade de texto curta: na palestra, o texto do slide compete com a sua voz.",
      "Ative as falas dos apresentadores para receber um roteiro e ensaiar as transições.",
      "Apresente pelo link público em tela cheia ou leve o PowerPoint exportado como plano B.",
      "Escreva a ideia central antes de gerar e coloque-a na descrição: todo o roteiro passa a girar em torno dela.",
    ],
    mistakes: [
      "Tentar passar várias mensagens na mesma palestra.",
      "Slides com tópicos que o palestrante lê de costas para a plateia.",
      "Terminar com \"obrigado\" e nenhuma chamada à ação.",
      "Passar do tempo combinado com a organização do evento.",
    ],
    faq: [
      { q: "Quantos slides para uma palestra de 20 minutos?", a: "Palestras inspiracionais costumam ter poucos slides, com muita imagem: de 10 a 20 para 20 minutos, dependendo do ritmo. Ensaie para cada slide durar o tempo de uma ideia." },
      { q: "Funciona no projetor do evento?", a: "Sim. Abra o link público no computador do evento, ou exporte em PowerPoint ou PDF e leve o arquivo. Teste o contraste no projetor antes de começar." },
      { q: "Como abrir uma palestra?", a: "Comece por algo que prenda a atenção nos primeiros 30 segundos: uma pergunta para a plateia, um dado inesperado ou uma história curta. Deixe a apresentação pessoal para depois, quando o público já quiser saber quem está falando." },
    ],
  },
  {
    id: "pessoal-curriculo",
    seoTitle: "Currículo em Slides (CV Visual): Modelo | SlideAI",
    metaDescription: "Modelo de currículo em formato de apresentação em 8 slides: resumo, experiências, resultados, formação e habilidades. Ideal para entrevistas.",
    h1: "Currículo em slides (CV visual): modelo de 8 slides para entrevistas",
    intro: [
      "Algumas entrevistas pedem que o candidato se apresente em slides. Um CV visual resolve isso em poucos minutos: quem você é, o que já entregou e por que combina com a vaga.",
      "Este modelo de 8 slides tem visual limpo e foco em resultados. Descreva a vaga desejada e a sua experiência, e adapte a ordem dos slides ao que a empresa valoriza.",
    ],
    audience: "Candidatos a vagas de emprego e estágio, profissionais em transição de carreira e quem participa de processos seletivos com etapa de apresentação.",
    outline: [
      { title: "Capa", text: "Seu nome, o cargo que você busca e o contato principal." },
      { title: "Resumo profissional", text: "Três frases sobre sua experiência, especialidade e objetivo." },
      { title: "Experiências relevantes", text: "Empresas, cargos e períodos ligados à vaga, do mais recente para o mais antigo." },
      { title: "Principais resultados", text: "Conquistas com números: metas batidas, economias, projetos entregues." },
      { title: "Formação", text: "Graduação, pós e cursos que importam para a vaga." },
      { title: "Habilidades", text: "Competências técnicas e comportamentais pedidas na descrição da vaga." },
      { title: "Certificações e idiomas", text: "Certificados e o nível em cada idioma." },
      { title: "Projetos e contato", text: "Projetos pessoais ou voluntários e como falar com você." },
    ],
    tips: [
      "Cole a descrição da vaga na descrição da apresentação: os destaques ficam alinhados ao que a empresa procura.",
      "Prefira um tema claro e minimalista, como o deste modelo, para uma leitura rápida.",
      "Use números nos resultados sempre que puder e confira datas e nomes antes de enviar.",
      "Exporte em PDF para anexar à candidatura e mantenha a versão editável para cada vaga.",
      "Ative as falas dos apresentadores para receber um roteiro do que dizer em cada slide e ensaie em voz alta com cronômetro.",
    ],
    mistakes: [
      "Repetir o currículo inteiro em tópicos pequenos.",
      "Listar responsabilidades em vez de resultados.",
      "Usar a mesma apresentação para vagas muito diferentes.",
      "Encher os slides de logotipos e ícones que não acrescentam informação.",
      "Esquecer de conferir datas, nomes de empresas e contatos antes de enviar.",
    ],
    faq: [
      { q: "Quanto tempo deve durar uma apresentação pessoal em entrevista?", a: "Em geral, de 5 a 10 minutos. Oito slides com pouco texto cabem bem nesse tempo e deixam espaço para perguntas." },
      { q: "Posso mandar o CV visual em PDF?", a: "Sim. Exporte em PDF para anexar ao e-mail ou à plataforma da vaga. O PowerPoint (.pptx) também está disponível se a empresa pedir um arquivo editável." },
      { q: "O que falar durante a apresentação do CV?", a: "Use cada slide como apoio para uma história curta: o contexto, o que você fez e o resultado. O recrutador quer entender como você pensa e trabalha, então explique as escolhas, não só os cargos." },
      { q: "Devo colocar foto no CV visual?", a: "É opcional. Se usar, prefira uma foto profissional e neutra na capa. Em vagas com processos de seleção às cegas, siga a orientação da empresa e deixe a foto de fora." },
    ],
  },
];

export const templateGuide = (id: string | undefined): TemplateGuide | undefined =>
  TEMPLATE_GUIDES.find((g) => g.id === id);
