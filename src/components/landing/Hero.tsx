import { motion } from "framer-motion";
import { animated } from "@react-spring/web";
import { ArrowRight, Sparkles, Wand2, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSpringHover } from "@/lib/physics";
import heroImg from "@/assets/hero-slides.jpg";

const SpringWrap = ({ children, hoverY = -2 }: { children: React.ReactNode; hoverY?: number }) => {
  const { bind, style } = useSpringHover({ hoverScale: 1.04, pressScale: 0.96, hoverY });
  return (
    <animated.div style={style} {...bind} className="inline-block">
      {children}
    </animated.div>
  );
};

export const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />

      <div className="container relative mx-auto px-6">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Powered by ChatGPT 5.4 PRO
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]"
          >
            Crie apresentações{" "}
            <span className="text-gradient">incríveis</span>
            <br />
            em segundos com IA
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Descreva seu tema e deixe a inteligência artificial gerar slides profissionais,
            com design impecável, gráficos e imagens. Pronto em menos de um minuto.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <Link to="/gerar">
              <SpringWrap hoverY={-3}>
                <Button variant="hero" size="xl" className="group">
                  Criar minha apresentação
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </SpringWrap>
            </Link>
            <a href="#how">
              <SpringWrap>
                <Button variant="outline" size="xl">Ver como funciona</Button>
              </SpringWrap>
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-4 text-xs text-muted-foreground"
          >
            Sem cartão de crédito · Pré-visualize gratuitamente
          </motion.p>
        </div>

        {/* Hero mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.19, 1, 0.22, 1] }}
          className="relative mt-16 md:mt-20 mx-auto max-w-5xl"
        >
          <div className="relative rounded-3xl border border-border/60 bg-card shadow-elegant overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
                <div className="h-3 w-3 rounded-full bg-success/60" />
              </div>
              <div className="flex-1 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-background/60 text-xs text-muted-foreground">
                  slideai.app/editor
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 min-h-[400px] md:min-h-[500px]">
              {/* Sidebar slides */}
              <div className="col-span-3 border-r border-border/60 bg-muted/20 p-3 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`aspect-video rounded-md border ${i === 2 ? 'border-primary ring-2 ring-primary/30' : 'border-border'} bg-card p-2`}
                  >
                    <div className="h-1 w-2/3 rounded-full bg-muted-foreground/20 mb-1" />
                    <div className="h-1 w-1/2 rounded-full bg-muted-foreground/15" />
                  </div>
                ))}
              </div>

              {/* Canvas */}
              <div className="col-span-9 relative bg-gradient-subtle p-6 md:p-10 flex items-center justify-center">
                <img
                  src={heroImg}
                  alt="Preview do editor SlideAI com apresentações geradas por IA"
                  width={1536}
                  height={1024}
                  fetchPriority="high"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover opacity-20"
                />
                <div className="relative w-full max-w-2xl aspect-video rounded-xl bg-card shadow-glow border border-border/60 p-6 md:p-10 flex flex-col justify-center">
                  <div className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                    <Zap className="h-3 w-3" /> Slide 02 de 08
                  </div>
                  <h3 className="font-display text-2xl md:text-4xl font-bold mb-3">
                    O futuro das <span className="text-gradient">apresentações</span>
                  </h3>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Conteúdo gerado por IA em segundos, com gráficos, imagens e narrativa coerente.
                  </p>
                  <div className="mt-6 flex gap-3">
                    <div className="h-2 w-16 rounded-full bg-primary" />
                    <div className="h-2 w-10 rounded-full bg-muted-foreground/20" />
                    <div className="h-2 w-6 rounded-full bg-muted-foreground/20" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating badge */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="hidden md:flex absolute -left-6 top-1/3 items-center gap-2 rounded-2xl bg-card border border-border shadow-lg px-4 py-3"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Wand2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-xs font-semibold">Gerado em 23s</div>
              <div className="text-[10px] text-muted-foreground">8 slides · Tema: IA</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
