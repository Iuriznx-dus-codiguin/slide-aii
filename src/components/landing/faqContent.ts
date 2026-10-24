// Perguntas frequentes da home. O index.html repete estas perguntas no
// JSON-LD (FAQPage) para buscadores que não executam JavaScript; o teste
// src/test/landingSeo.test.ts garante que os dois textos sejam iguais — e,
// como os números vêm das constantes de cobrança, falha se um preço ou limite
// mudar sem o index.html acompanhar.
import {
  CREDITS_PER_SLIDE, DEPTH_CREDITS, MAX_USAGE_MULTIPLIER, PLAN_MONTHLY_CREDITS, SPEECHES_CREDITS, estimatedDecks,
} from "@/lib/cakto";
import { FAIR_USE_HOURLY_GENERATIONS } from "@/lib/fairUse";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const MAX_CREDITS = PLAN_MONTHLY_CREDITS.max_mensal;

export const LANDING_FAQS: { q: string; a: string }[] = [
  {
    q: "Como a IA gera as apresentações?",
    a: "Você descreve o tema e algumas preferências (número de slides, tipo, idioma, profundidade do texto). A IA estrutura a narrativa, escreve cada slide, escolhe imagens e cria gráficos quando o conteúdo tem dados. Revise sempre o resultado: textos gerados por IA podem conter imprecisões.",
  },
  {
    q: "Posso editar as apresentações depois?",
    a: "Sim. O editor permite mudar textos, imagens, layout, elementos visuais, animações e a ordem dos slides, além de adicionar ou remover slides. Você também pode pedir ajustes em linguagem natural ao assistente de edição.",
  },
  {
    q: "Em quais formatos posso exportar?",
    a: "PowerPoint (.pptx), PDF, imagem PNG do slide exibido e link público para apresentar em qualquer dispositivo. Com as falas dos apresentadores ativadas, o roteiro também sai em PDF, Word (.docx) ou texto.",
  },
  {
    q: "Como funcionam os créditos?",
    a: `Cada apresentação custa ${CREDITS_PER_SLIDE} créditos por slide, mais a profundidade do texto (curto ${DEPTH_CREDITS.short}, equilibrado ${DEPTH_CREDITS.balanced}, longo ${DEPTH_CREDITS.long}) e ${SPEECHES_CREDITS} se você ativar as falas dos apresentadores. O custo aparece antes de gerar, e se a geração falhar por um problema nosso os créditos voltam automaticamente.`,
  },
  {
    q: "Posso cancelar a assinatura quando quiser?",
    a: "Sim, sem multa. Os planos PRO e MAX podem ser cancelados a qualquer momento: a renovação para e você mantém o acesso até o fim do período já pago.",
  },
  {
    q: "E se eu me arrepender da compra?",
    a: "Você tem 7 dias corridos, contados da compra, para desistir e receber o reembolso integral, como prevê o Código de Defesa do Consumidor. Basta falar com o suporte; os créditos daquela compra são cancelados.",
  },
  {
    q: "O plano MAX é mesmo ilimitado?",
    a: `É de uso ilimitado para uma pessoa, dentro da Política de Uso Justo: até ${fmt(MAX_CREDITS)} créditos por ciclo mensal (${MAX_USAGE_MULTIPLIER}x o PRO, cerca de ${estimatedDecks(MAX_CREDITS)} apresentações de 10 slides com falas) e ${FAIR_USE_HOURLY_GENERATIONS} gerações por hora. Os detalhes estão nos Termos de Uso.`,
  },
  {
    q: "De quem é o conteúdo das apresentações?",
    a: "O conteúdo que você envia continua seu, e você pode usar livremente o que gerar, inclusive comercialmente, respeitando os Termos de Uso e os direitos de terceiros. Suas apresentações são privadas até você decidir publicá-las.",
  },
  {
    q: "Meus dados estão protegidos?",
    a: "Sim. Tratamos os dados conforme a LGPD, não vendemos dados pessoais e não usamos suas apresentações para treinar modelos de IA. Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento. Veja a Política de Privacidade.",
  },
];
