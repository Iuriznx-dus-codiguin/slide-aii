import { motion } from "framer-motion";
import { PenLine, Sparkles, Share2 } from "lucide-react";

const steps = [
  {
    icon: PenLine,
    number: "01",
    title: "Descreva o tema",
    desc: "Conte em poucas palavras sobre o que sua apresentação será. Quanto mais contexto, melhor.",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "IA gera os slides",
    desc: "Em segundos, nossa IA cria a estrutura, conteúdo, imagens e gráficos automaticamente.",
  },
  {
    icon: Share2,
    number: "03",
    title: "Edite e publique",
    desc: "Refine no editor visual e compartilhe com um link público ou exporte em PDF/PPTX.",
  },
];

export const HowItWorks = () => {
  return (
    <section id="how" className="py-24 md:py-32 relative">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
            Como funciona
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Da ideia ao slide em <span className="text-gradient">3 passos</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sem templates engessados. Sem horas perdidas. Apenas resultado.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-16 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="relative"
            >
              <div className="relative bg-card border border-border rounded-3xl p-8 hover:shadow-elegant transition-all hover:-translate-y-1 duration-500">
                <div className="absolute -top-6 left-8 h-12 w-12 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <div className="text-7xl font-display font-extrabold text-primary/10 mb-2 leading-none">
                  {step.number}
                </div>
                <h3 className="font-display text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
