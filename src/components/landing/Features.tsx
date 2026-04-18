import { motion } from "framer-motion";
import { Brain, Edit3, Sparkles, Image as ImageIcon, FileDown, Link2, BarChart3, Palette } from "lucide-react";

const features = [
  { icon: Brain, title: "Geração com IA", desc: "Conteúdo, estrutura e narrativa criados em segundos a partir do seu tema." },
  { icon: Edit3, title: "Editor inteligente", desc: "Edite textos, imagens e layouts em uma interface visual fluida estilo Canva." },
  { icon: Sparkles, title: "Animações cinematográficas", desc: "Transições e entradas profissionais aplicadas automaticamente." },
  { icon: ImageIcon, title: "Banco de imagens", desc: "Acesso a milhões de fotos via Unsplash diretamente no editor." },
  { icon: BarChart3, title: "Gráficos automáticos", desc: "Detectamos dados no seu tema e geramos visualizações lindas." },
  { icon: Palette, title: "Paletas e fontes premium", desc: "6 temas de cores e 4 famílias tipográficas para cada estilo." },
  { icon: FileDown, title: "Exportar PDF / PPTX", desc: "Baixe em formatos universais ou compartilhe por link público." },
  { icon: Link2, title: "Link público compartilhável", desc: "Apresente em qualquer dispositivo, com modo full-screen e contagem de visualizações." },
];

export const Features = () => {
  return (
    <section id="features" className="py-24 md:py-32 bg-gradient-subtle relative overflow-hidden">
      <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-accent/10 blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-6 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
            Recursos
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Tudo que você precisa para <span className="text-gradient">brilhar</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Uma suíte completa para apresentações, com a IA fazendo o trabalho pesado.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
              className="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-glow transition-all duration-500"
            >
              <div className="h-11 w-11 rounded-xl bg-gradient-card border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="h-5 w-5 text-primary" strokeWidth={2} />
              </div>
              <h3 className="font-display text-base font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
