import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "Como a IA gera as apresentações?",
    a: "Você descreve o tema e algumas preferências (número de slides, estilo, idioma). A IA estrutura o conteúdo, escreve cada slide com narrativa coerente, sugere imagens e até cria gráficos quando detecta dados.",
  },
  {
    q: "Posso editar as apresentações depois?",
    a: "Sim. Após a geração, você tem acesso a um editor visual completo onde pode mudar textos, imagens, cores, animações, layouts e adicionar ou remover slides livremente.",
  },
  {
    q: "Em quais formatos posso exportar?",
    a: "PDF, PPTX (PowerPoint), PNG por slide, e link público compartilhável que funciona em qualquer dispositivo, com modo full-screen.",
  },
  {
    q: "Os slides são realmente únicos ou usam templates prontos?",
    a: "Cada apresentação é gerada do zero pela IA com base no seu tema, com layouts adaptados ao conteúdo. Não são templates engessados — o resultado é único.",
  },
  {
    q: "Posso cancelar a assinatura quando quiser?",
    a: "Sim, sem multa. Os planos PRO e MAX podem ser cancelados a qualquer momento e você mantém acesso até o fim do período pago.",
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
