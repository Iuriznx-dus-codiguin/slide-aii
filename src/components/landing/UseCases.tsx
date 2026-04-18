import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, BookOpen, Briefcase, Megaphone, Heart } from "lucide-react";

const cases = [
  {
    id: "academic",
    icon: GraduationCap,
    label: "Acadêmico",
    title: "Defesas e seminários impecáveis",
    desc: "TCC, dissertações e artigos viram apresentações estruturadas com referências, gráficos de dados e narrativa clara.",
    bullets: ["Estrutura científica automática", "Citações e referências", "Gráficos a partir de dados"],
  },
  {
    id: "school",
    icon: BookOpen,
    label: "Escolar",
    title: "Trabalhos escolares em minutos",
    desc: "Estudantes e professores criam aulas e trabalhos visuais e divertidos sem perder horas no PowerPoint.",
    bullets: ["Linguagem adaptada à idade", "Imagens ilustrativas", "Layouts coloridos"],
  },
  {
    id: "work",
    icon: Briefcase,
    label: "Trabalho",
    title: "Reuniões corporativas afiadas",
    desc: "Relatórios, kickoffs e revisões trimestrais com dados, KPIs e visual profissional alinhado à sua marca.",
    bullets: ["Tom executivo", "Dashboards integrados", "Paleta corporativa"],
  },
  {
    id: "marketing",
    icon: Megaphone,
    label: "Marketing",
    title: "Pitches que vendem",
    desc: "Apresentações de venda, propostas e decks de investidores com storytelling persuasivo e design vibrante.",
    bullets: ["Storytelling de vendas", "Métricas em destaque", "CTAs claros"],
  },
  {
    id: "personal",
    icon: Heart,
    label: "Pessoal",
    title: "Para a vida toda",
    desc: "Casamentos, eventos, álbuns e até receitas — qualquer ideia ganha forma de slide elegante.",
    bullets: ["Templates afetivos", "Fotos pessoais", "Tom personalizado"],
  },
];

export const UseCases = () => {
  const [active, setActive] = useState(cases[0].id);
  const current = cases.find((c) => c.id === active)!;

  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
            Casos de uso
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Para qualquer momento da sua <span className="text-gradient">jornada</span>
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                active === c.id
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              }`}
            >
              <c.icon className="h-4 w-4" />
              {c.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="grid md:grid-cols-2 gap-8 md:gap-12 items-center max-w-5xl mx-auto"
          >
            <div>
              <h3 className="font-display text-3xl md:text-4xl font-bold mb-4">{current.title}</h3>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{current.desc}</p>
              <ul className="space-y-3">
                {current.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-gradient-primary" />
                    <span className="font-medium">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative aspect-video rounded-2xl bg-gradient-card border border-border overflow-hidden p-8 flex flex-col justify-center shadow-elegant">
              <div className="absolute inset-0 bg-gradient-glow opacity-50" />
              <div className="relative">
                <current.icon className="h-12 w-12 text-primary mb-4" strokeWidth={1.5} />
                <div className="font-display text-2xl font-bold mb-2">{current.label}</div>
                <div className="text-sm text-muted-foreground">Pré-visualização do tema</div>
                <div className="mt-6 space-y-2">
                  <div className="h-2 w-3/4 rounded bg-primary/20" />
                  <div className="h-2 w-1/2 rounded bg-primary/15" />
                  <div className="h-2 w-2/3 rounded bg-primary/10" />
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
