import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Cycle = "monthly" | "yearly";

export const CHECKOUT_URLS = {
  single: "https://pay.cakto.com.br/qw6rzxx_856330",
  monthly: "https://pay.cakto.com.br/yw7ej87_856334",
  yearly: "https://pay.cakto.com.br/m6z7n3k_856339",
};

const monthly = {
  name: "Ilimitado",
  price: "49,90",
  period: "por mês",
  description: "Para quem cria apresentações com frequência. Cancele quando quiser.",
  cta: "Assinar plano mensal",
  badge: "Mais popular",
  href: CHECKOUT_URLS.monthly,
};

const yearly = {
  name: "Ilimitado Anual",
  price: "397,90",
  period: "por ano",
  description: "Pague o equivalente a 8 meses e ganhe 4 meses grátis. Melhor custo-benefício.",
  cta: "Assinar plano anual",
  badge: "4 meses grátis",
  monthlyEquivalent: "33,16",
  href: CHECKOUT_URLS.yearly,
};

const features = [
  "Gerações ilimitadas com IA",
  "Editor visual completo",
  "Exportar PDF, PPTX e PNG",
  "Modo apresentador com timer",
  "Templates premium exclusivos",
  "Histórico de versões",
  "Suporte prioritário",
];

const perGen = {
  name: "Geração única",
  price: "14,90",
  period: "por apresentação",
  description: "Pague apenas pelo que usar. Ideal para apresentações esporádicas.",
  features: [
    "1 apresentação completa com IA",
    "Editor visual completo",
    "Exportar PDF e PPTX",
    "Link público compartilhável",
    "Acesso vitalício à apresentação",
  ],
  cta: "Criar apresentação",
  href: CHECKOUT_URLS.single,
};

export const Pricing = () => {
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const sub = cycle === "yearly" ? yearly : monthly;

  return (
    <section id="pricing" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none" />

      <div className="container mx-auto px-6 relative">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
            Preços
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Simples e <span className="text-gradient">transparente</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sem pegadinhas. Sem letras miúdas. Escolha o que faz sentido pra você.
          </p>
        </div>

        {/* Toggle mensal/anual */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-card border border-border">
            <button
              onClick={() => setCycle("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                cycle === "monthly" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                cycle === "yearly" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cycle === "yearly" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"} font-bold`}>
                -33%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Por geração */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl p-8 md:p-10 border border-border bg-card hover:border-primary/30 transition-all"
          >
            <h3 className="font-display text-2xl font-bold">{perGen.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">{perGen.description}</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-5xl font-extrabold tracking-tight">{perGen.price}</span>
              <span className="text-sm text-muted-foreground">/ {perGen.period}</span>
            </div>
            <Button asChild variant="outline" size="lg" className="w-full mt-6">
              <a href="/gerar">{perGen.cta}</a>
            </Button>
            <ul className="mt-8 space-y-3">
              {perGen.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-muted-foreground" strokeWidth={3} />
                  </div>
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Plano de assinatura (mensal/anual) */}
          <motion.div
            key={cycle}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative rounded-3xl p-8 md:p-10 border border-primary/50 bg-gradient-card shadow-elegant"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow whitespace-nowrap">
                <Sparkles className="h-3 w-3" />
                {sub.badge}
              </div>
            </div>

            <h3 className="font-display text-2xl font-bold">{sub.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">{sub.description}</p>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-5xl font-extrabold tracking-tight">{sub.price}</span>
              <span className="text-sm text-muted-foreground">/ {sub.period}</span>
            </div>
            {cycle === "yearly" && (
              <p className="mt-1 text-xs text-primary font-medium">
                Equivalente a R$ {yearly.monthlyEquivalent}/mês · economiza R$ 200,90
              </p>
            )}

            <Button asChild variant="hero" size="lg" className="w-full mt-6">
              <a href="/gerar">{sub.cta}</a>
            </Button>

            <ul className="mt-8 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                  </div>
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
