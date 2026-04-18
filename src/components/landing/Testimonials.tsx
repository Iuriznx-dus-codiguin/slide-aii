import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Mariana Costa",
    role: "Estudante de Mestrado · USP",
    text: "Defendi minha dissertação com slides feitos em 5 minutos no SlideAI. A banca elogiou o design.",
    initial: "MC",
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    name: "Rafael Lima",
    role: "Gerente de Marketing · Stone",
    text: "Substituiu nosso PowerPoint por completo. Decks de proposta agora ficam prontos antes da reunião.",
    initial: "RL",
    color: "from-blue-500 to-violet-500",
  },
  {
    name: "Profª Ana Reis",
    role: "Professora de História",
    text: "Crio aulas semanais sobre temas diferentes em minutos. Meus alunos prestam muito mais atenção.",
    initial: "AR",
    color: "from-pink-500 to-rose-500",
  },
  {
    name: "Diego Almeida",
    role: "Founder · TechStartup",
    text: "Pitch deck de Series A feito em uma tarde. Levantamos investimento três semanas depois.",
    initial: "DA",
    color: "from-amber-500 to-orange-500",
  },
  {
    name: "Beatriz Souza",
    role: "Criadora de Conteúdo",
    text: "Uso para roteirizar meus vídeos no YouTube. A IA acerta o tom da minha audiência sempre.",
    initial: "BS",
    color: "from-emerald-500 to-teal-500",
  },
];

export const Testimonials = () => {
  // duplicate for marquee
  const items = [...testimonials, ...testimonials];

  return (
    <section className="py-24 md:py-32 bg-gradient-subtle overflow-hidden">
      <div className="container mx-auto px-6 mb-12">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
            Depoimentos
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Amado por mais de <span className="text-gradient">10.000 criadores</span>
          </h2>
        </div>
      </div>

      <div className="relative">
        {/* fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div className="flex gap-6 animate-marquee" style={{ width: "max-content" }}>
          {items.map((t, i) => (
            <motion.div
              key={`${t.name}-${i}`}
              className="w-[360px] flex-shrink-0 bg-card border border-border rounded-2xl p-6 shadow-md"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-foreground/85 leading-relaxed mb-5 text-sm">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-sm`}>
                  {t.initial}
                </div>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
