import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Crown, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PLAN_MONTHLY_CREDITS, PLAN_SIGNUP_BONUS, proPlanFor, SINGLE_PURCHASE_CREDITS } from "@/lib/cakto";

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
  name: "Pagamento único",
  tagline: "Ideal para começar",
  price: "14,90",
  period: "≈ 3 Apresentações ",
  description: "Pague uma vez e crie suas primeiras apresentações. Sem assinatura, sem compromisso.",
  volume: "400 créditos + 100 Bônus ",
  cta: "Pagamento único",
};

// PRO — 3.200 créditos/mês em qualquer ciclo (+ bônus permanente na 1ª ativação).
// Trimestral: 15% off vs mensal (49,90 × 3 × 0,85 ≈ 127,90).
const pro = {
  mensal:     { price: "49,90",  period: "por mês",       cta: "Assinar PRO mensal" },
  trimestral: { price: "127,90", period: "por trimestre", cta: "Assinar PRO trimestral", monthlyEquivalent: "42,63" },
  anual:      { price: "397,90", period: "por ano",       cta: "Assinar PRO anual",      monthlyEquivalent: "33,16" },
};

// MAX — uso ilimitado dentro da Política de Uso Justo (16.000 créditos por
// ciclo mensal), divulgada no card e nos Termos (/termos#uso-justo).
const max = {
  mensal:     { price: "147,90",   period: "por mês",       cta: "Assinar MAX mensal" },
  trimestral: { price: "377,90",   period: "por trimestre", cta: "Assinar MAX trimestral", monthlyEquivalent: "125,97" },
  anual:      { price: "1.175,00", period: "por ano",       cta: "Assinar MAX anual",      monthlyEquivalent: "97,92" },
};

export const Pricing = () => {
  // Trimestral é o predefinido — melhor equilíbrio de compromisso/desconto.
  const [cycle, setCycle] = useState<Cycle>("trimestral");
  const proPrice = pro[cycle];
  const proId = proPlanFor(cycle);
  const proBonus = PLAN_SIGNUP_BONUS[proId] ?? 0;
  const maxPrice = max[cycle];
  // Estimativa divulgada (≈ 3 apresentações no avulso × escala PRO).
  const monthlyDecks = 20;

  return (
    <section id="pricing" className="py-12 sm:py-16 lg:py-20 relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 relative">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
            Preços
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Simples e <span className="text-gradient">transparente</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Todos os planos incluem os mesmos recursos. A diferença é só o volume.
          </p>
        </div>

        {/* Toggle mensal / trimestral / anual */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-card border border-border">
            <Button variant="ghost" aria-pressed={cycle === "mensal"}
              onClick={() => setCycle("mensal")}
              className={`h-11 px-2.5 sm:px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                cycle === "mensal" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </Button>
            <Button variant="ghost" aria-pressed={cycle === "trimestral"}
              onClick={() => setCycle("trimestral")}
              className={`h-11 px-2.5 sm:px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
                cycle === "trimestral" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Trimestral
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cycle === "trimestral" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"} font-bold`}>
                -15%
              </span>
            </Button>
            <Button variant="ghost" aria-pressed={cycle === "anual"}
              onClick={() => setCycle("anual")}
              className={`h-11 px-2.5 sm:px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
                cycle === "anual" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cycle === "anual" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"} font-bold`}>
                -33%
              </span>
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
          {/* Geração única */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="relative rounded-2xl p-5 sm:p-6 xl:p-8 border-2 border-primary/30 bg-card hover:border-primary/50 transition-colors shadow-md flex flex-col"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold whitespace-nowrap border border-primary/30">
                <Zap className="h-3 w-3" />
                {perGen.tagline}
              </div>
            </div>
            <h3 className="font-display text-2xl font-bold mt-2">{perGen.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground lg:min-h-[60px]">{perGen.description}</p>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-4xl xl:text-5xl font-extrabold tracking-tight">{perGen.price}</span>
              <span className="basis-full text-sm text-muted-foreground">{perGen.period}</span>
            </div>
            <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 self-start rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="h-3 w-3" /> {perGen.volume}
            </div>
            <Button asChild variant="outline" size="lg" className="w-full mt-6 border-primary/50 hover:bg-primary/10">
              <Link to="/gerar">{perGen.cta}</Link>
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
            
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative rounded-2xl p-5 sm:p-6 xl:p-8 border-2 border-primary/60 bg-gradient-card shadow-elegant flex flex-col"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow whitespace-nowrap">
                <Sparkles className="h-3 w-3" /> Mais popular
              </div>
            </div>
            <h3 className="font-display text-2xl font-bold mt-2">Plano PRO</h3>
            <p className="mt-2 text-sm text-muted-foreground lg:min-h-[60px]">
              Para quem cria apresentações com frequência. Cancele quando quiser.
            </p>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-4xl xl:text-5xl font-extrabold tracking-tight">{proPrice.price}</span>
              <span className="text-sm text-muted-foreground">/ {proPrice.period}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">≈ {monthlyDecks} apresentações por mês</p>
            {"monthlyEquivalent" in proPrice && (
              <p className="mt-1 text-xs text-primary font-medium">
                Equivalente a R$ {proPrice.monthlyEquivalent}/mês
              </p>
            )}
            <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 self-start rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow">
               <Sparkles className="h-3 w-3" /> {PLAN_MONTHLY_CREDITS[proId].toLocaleString("pt-BR")} créditos + {proBonus.toLocaleString("pt-BR")} Bônus
            </div>
            <Button asChild variant="hero" size="lg" className="w-full mt-6">
              <Link to="/gerar">{proPrice.cta}</Link>
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
            
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="relative rounded-2xl p-5 sm:p-6 xl:p-8 border-2 border-accent/40 bg-gradient-to-br from-accent/5 via-card to-primary/5 shadow-md flex flex-col"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow whitespace-nowrap">
                <Crown className="h-3 w-3" /> Uso ilimitado*
              </div>
            </div>
            <h3 className="font-display text-2xl font-bold mt-2">Plano MAX</h3>
            <p className="mt-2 text-sm text-muted-foreground lg:min-h-[60px]">
              Para agências e criadores de alto volume. Gere sem contar créditos, dentro do uso justo.
            </p>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="font-display text-4xl xl:text-5xl font-extrabold tracking-tight">{maxPrice.price}</span>
              <span className="text-sm text-muted-foreground">/ {maxPrice.period}</span>
            </div>
            {"monthlyEquivalent" in maxPrice && (
              <p className="mt-1 text-xs text-accent font-medium">
                Equivalente a R$ {maxPrice.monthlyEquivalent}/mês
              </p>
            )}
            <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 self-start rounded-full bg-gradient-to-r from-accent to-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow">
               <Crown className="h-3 w-3" /> Gerações ilimitadas*
            </div>
            {/* A ressalva do asterisco precisa estar na própria oferta (CDC, art. 31). */}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              *Dentro do{" "}
              <Link to="/termos#uso-justo" className="underline underline-offset-2 hover:text-foreground">uso justo</Link>: até{" "}
              5x mais uso que o Plano PRO.
            </p>
            <Button asChild variant="outline" size="lg" className="w-full mt-6 border-accent/50 hover:bg-accent/10">
              <Link to="/gerar">{maxPrice.cta}</Link>
            </Button>
            <ul className="mt-8 space-y-3 flex-1">
              {sharedBenefits.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-accent" strokeWidth={3} />
                  </div>
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Decreto 7.962/2013, art. 5º: o arrependimento é informado na oferta. */}
        <p className="max-w-3xl mx-auto mt-8 text-center text-xs text-muted-foreground leading-relaxed">
          Assinaturas renovam automaticamente; cancele quando quiser e use até o fim do período pago. 7 dias para desistir
          com reembolso integral.{" "}
          <Link to="/termos#planos" className="underline underline-offset-2 hover:text-foreground">Condições</Link>
        </p>
      </div>
    </section>
  );
};
