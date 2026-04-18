import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Por geração",
    price: "19,90",
    period: "por apresentação",
    description: "Pague apenas pelo que usar. Ideal para apresentações esporádicas.",
    features: [
      "1 apresentação completa com IA",
      "Até 20 slides por geração",
      "Editor visual completo",
      "Exportar PDF e PPTX",
      "Link público compartilhável",
      "Acesso vitalício à apresentação",
    ],
    cta: "Criar apresentação",
    highlighted: false,
  },
  {
    name: "Ilimitado",
    price: "49,90",
    period: "por mês",
    description: "Para quem cria apresentações com frequência. Cancele quando quiser.",
    features: [
      "Gerações ilimitadas com IA",
      "Até 30 slides por apresentação",
      "Editor visual completo",
      "Exportar PDF, PPTX e PNG",
      "Modo apresentador com timer",
      "Suporte prioritário",
      "Templates premium exclusivos",
      "Histórico de versões",
    ],
    cta: "Assinar plano",
    highlighted: true,
    badge: "Mais popular",
  },
];

export const Pricing = () => {
  return (
    <section id="pricing" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none" />

      <div className="container mx-auto px-6 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
            Preços
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Simples e <span className="text-gradient">transparente</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sem pegadinhas. Sem letras miúdas. Comece grátis e pague apenas quando quiser publicar.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={`relative rounded-3xl p-8 md:p-10 border transition-all ${
                tier.highlighted
                  ? "border-primary/50 bg-gradient-card shadow-elegant"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow">
                    <Sparkles className="h-3 w-3" />
                    {tier.badge}
                  </div>
                </div>
              )}

              <h3 className="font-display text-2xl font-bold">{tier.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">{tier.description}</p>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="font-display text-5xl font-extrabold tracking-tight">{tier.price}</span>
                <span className="text-sm text-muted-foreground">/ {tier.period}</span>
              </div>

              <Button
                variant={tier.highlighted ? "hero" : "outline"}
                size="lg"
                className="w-full mt-6"
              >
                {tier.cta}
              </Button>

              <ul className="mt-8 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${tier.highlighted ? "bg-primary/15" : "bg-muted"}`}>
                      <Check className={`h-3 w-3 ${tier.highlighted ? "text-primary" : "text-muted-foreground"}`} strokeWidth={3} />
                    </div>
                    <span className="text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
