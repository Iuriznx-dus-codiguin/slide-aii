import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Crown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type Cycle = "mensal" | "trimestral" | "anual";

// Benefícios IGUAIS em todos os planos — a única diferença entre eles é o
// volume de gerações por período. "Geração em segundos" abre a lista para
// reforçar a promessa central do produto; os demais são as capacidades que
// realmente entregamos hoje na plataforma.
const sharedBenefits = [
  "Geração em segundos",
  "Exportar PDF, PPTX e PNG",
  "Link público compartilhável",
  "Suporte prioritário",
];

const perGen = {
  name: "Geração única",
  tagline: "Ideal para começar",
  price: "14,90",
  period: "por apresentação",
  description: "Pague uma vez e crie a sua primeira apresentação. Sem assinatura, sem compromisso.",
  volume: "500 créditos (≈ 1 apresentação completa)",
  cta: "Criar apresentação",
};

// PRO — 3.200 créditos/mês em qualquer ciclo (+ bônus permanente na 1ª ativação).
// Trimestral: 15% off vs mensal (49,90 × 3 × 0,85 ≈ 127,90).
const pro = {
  mensal:     { price: "49,90",  period: "por mês",       cta: "Assinar PRO mensal" },
  trimestral: { price: "127,90", period: "por trimestre", cta: "Assinar PRO trimestral", monthlyEquivalent: "42,63" },
  anual:      { price: "397,90", period: "por ano",       cta: "Assinar PRO anual",      monthlyEquivalent: "33,16" },
};

// MAX — ilimitado (16.000 créditos/mês internos).
const max = {
  mensal:     { price: "147,90",   period: "por mês",       cta: "Assinar MAX mensal" },
  trimestral: { price: "377,90",   period: "por trimestre", cta: "Assinar MAX trimestral", monthlyEquivalent: "125,97" },
  anual:      { price: "1.175,00", period: "por ano",       cta: "Assinar MAX anual",      monthlyEquivalent: "97,92" },
};

export const Pricing = () => {
  // Trimestral é o predefinido — melhor equilíbrio de compromisso/desconto.
  const [cycle, setCycle] = useState<Cycle>("trimestral");
  const proPrice = pro[cycle];
  const maxPrice = max[cycle];

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
            Todos os planos incluem os mesmos recursos. A diferença é só o volume.
          </p>
        </div>

        {/* Toggle mensal / trimestral / anual */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-card border border-border">
            <button
              onClick={() => setCycle("mensal")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                cycle === "mensal" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setCycle("trimestral")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                cycle === "trimestral" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Trimestral
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cycle === "trimestral" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"} font-bold`}>
                -15%
              </span>
            </button>
            <button
              onClick={() => setCycle("anual")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                cycle === "anual" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cycle === "anual" ? "bg-white/20 text-white" : "bg-primary/15 text-primary"} font-bold`}>
                -33%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
          {/* Geração única */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl p-8 border-2 border-primary/30 bg-card hover:border-primary/50 transition-all shadow-md flex flex-col"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold whitespace-nowrap border border-primary/30">
                <Zap className="h-3 w-3" />
                {perGen.tagline}
              </div>
            </div>
            <h3 className="font-display text-2xl font-bold mt-2">{perGen.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">{perGen.description}</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-5xl font-extrabold tracking-tight">{perGen.price}</span>
              <span className="text-sm text-muted-foreground">/ {perGen.period}</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="h-3 w-3" /> {perGen.volume}
            </div>
            <Button asChild variant="outline" size="lg" className="w-full mt-6 border-primary/50 hover:bg-primary/10">
              <a href="/gerar">{perGen.cta}</a>
            </Button>
            <ul className="mt-8 space-y-3 flex-1">
              {sharedBenefits.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                  </div>
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* PRO — Mais popular */}
          <motion.div
            key={`pro-${cycle}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative rounded-3xl p-8 border-2 border-primary/60 bg-gradient-card shadow-elegant flex flex-col md:scale-[1.03]"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow whitespace-nowrap">
                <Sparkles className="h-3 w-3" /> Mais popular
              </div>
            </div>
            <h3 className="font-display text-2xl font-bold mt-2">Plano PRO</h3>
            <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">
              Para quem cria apresentações com frequência. Cancele quando quiser.
            </p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-5xl font-extrabold tracking-tight">{proPrice.price}</span>
              <span className="text-sm text-muted-foreground">/ {proPrice.period}</span>
            </div>
            {"monthlyEquivalent" in proPrice && (
              <p className="mt-1 text-xs text-primary font-medium">
                Equivalente a R$ {proPrice.monthlyEquivalent}/mês
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow">
              <Sparkles className="h-3 w-3" /> 3.200 créditos por mês
            </div>
            <Button asChild variant="hero" size="lg" className="w-full mt-6">
              <a href="/gerar">{proPrice.cta}</a>
            </Button>
            <ul className="mt-8 space-y-3 flex-1">
              {sharedBenefits.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                  </div>
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* MAX — Ilimitado */}
          <motion.div
            key={`max-${cycle}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative rounded-3xl p-8 border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-card to-primary/5 shadow-md flex flex-col"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-primary px-3 py-1 text-xs font-bold text-white shadow-glow whitespace-nowrap">
                <Crown className="h-3 w-3" /> Ilimitado
              </div>
            </div>
            <h3 className="font-display text-2xl font-bold mt-2">Plano MAX</h3>
            <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">
              Para agências e criadores de alto volume. Crie apresentações sem se preocupar com limites.
            </p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-5xl font-extrabold tracking-tight">{maxPrice.price}</span>
              <span className="text-sm text-muted-foreground">/ {maxPrice.period}</span>
            </div>
            {"monthlyEquivalent" in maxPrice && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-500 font-medium">
                Equivalente a R$ {maxPrice.monthlyEquivalent}/mês
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-gradient-to-r from-amber-500 to-primary px-3 py-1 text-xs font-bold text-white shadow-glow">
              <Crown className="h-3 w-3" /> Gerações ilimitadas
            </div>
            <Button asChild variant="outline" size="lg" className="w-full mt-6 border-amber-500/50 hover:bg-amber-500/10">
              <a href="/gerar">{maxPrice.cta}</a>
            </Button>
            <ul className="mt-8 space-y-3 flex-1">
              {sharedBenefits.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-amber-600 dark:text-amber-500" strokeWidth={3} />
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
