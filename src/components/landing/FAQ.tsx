import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
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
    a: "Cada apresentação custa 10 créditos por slide, mais a profundidade do texto (curto 10, equilibrado 20, longo 30) e 50 se você ativar as falas dos apresentadores. O custo aparece antes de gerar, e se a geração falhar por um problema nosso os créditos voltam automaticamente.",
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
    a: "É de uso ilimitado para uma pessoa, dentro da Política de Uso Justo: até 16.000 créditos por ciclo mensal (cerca de 130 apresentações de 10 slides) e 12 gerações por hora. Os detalhes estão nos Termos de Uso.",
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

export const FAQ = () => {
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
            FAQ
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Perguntas <span className="text-gradient">frequentes</span>
          </h2>
        </div>

        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border border-border rounded-2xl px-6 bg-card data-[state=open]:border-primary/30 data-[state=open]:shadow-md transition-all"
              >
                <AccordionTrigger className="text-left font-display font-semibold text-base hover:no-underline py-5">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
