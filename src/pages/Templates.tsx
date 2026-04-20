// Biblioteca pública de templates. Filtros por categoria, modal de preview
// e botão "Usar este template" → /gerar?template=ID
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { TEMPLATES, TEMPLATE_CATEGORIES, type TemplateSeed } from "@/lib/templates";

const Templates = () => {
  const navigate = useNavigate();
  const [cat, setCat] = useState<(typeof TEMPLATE_CATEGORIES)[number]>("Todos");
  const [preview, setPreview] = useState<TemplateSeed | null>(null);

  useEffect(() => { document.title = "Templates — SlideAI"; }, []);

  const filtered = useMemo(
    () => cat === "Todos" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat),
    [cat]
  );

  const useTemplate = (id: string) => navigate(`/gerar?template=${id}`);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
              Templates
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Comece com um <span className="text-gradient">template</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Modelos pré-estruturados que aceleram a geração. A IA usa a estrutura como base e cria conteúdo único pra você.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  cat === c
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Grade */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {filtered.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                onClick={() => setPreview(t)}
                className="group text-left rounded-3xl overflow-hidden bg-card border border-border hover:border-primary/40 transition-all shadow-sm hover:shadow-elegant"
              >
                <div
                  className="aspect-video relative flex items-center justify-center overflow-hidden"
                  style={{ background: t.bg }}
                >
                  <div
                    className="absolute -top-1/2 -right-1/3 w-2/3 h-full rounded-full opacity-30 blur-3xl"
                    style={{ background: t.accent }}
                  />
                  <div className="text-7xl relative z-10 group-hover:scale-110 transition-transform">{t.emoji}</div>
                  <div className="absolute bottom-4 left-4 right-4 z-10">
                    <div className="h-1 w-12 mb-2 rounded-full" style={{ background: t.accent }} />
                    <div className="text-white/90 text-sm font-semibold">{t.seed.slidesCount} slides</div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display font-bold text-lg">{t.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium uppercase tracking-wide">{t.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{t.description}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </main>
      <Footer />

      {/* Modal de preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          {preview && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-4xl">{preview.emoji}</div>
                  <div>
                    <DialogTitle className="font-display text-2xl">{preview.title}</DialogTitle>
                    <DialogDescription className="mt-1">{preview.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div
                className="aspect-video rounded-2xl relative overflow-hidden flex items-center justify-center my-2"
                style={{ background: preview.bg }}
              >
                <div className="absolute -top-1/3 -right-1/4 w-1/2 h-full rounded-full opacity-40 blur-3xl" style={{ background: preview.accent }} />
                <div className="text-9xl relative z-10">{preview.emoji}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/50 px-3 py-2"><span className="text-muted-foreground">Slides:</span> <span className="font-semibold">{preview.seed.slidesCount}</span></div>
                <div className="rounded-xl bg-muted/50 px-3 py-2"><span className="text-muted-foreground">Tipo:</span> <span className="font-semibold">{preview.seed.type}</span></div>
                <div className="rounded-xl bg-muted/50 px-3 py-2"><span className="text-muted-foreground">Gráficos:</span> <span className="font-semibold">{preview.seed.includeCharts ? "Sim" : "Não"}</span></div>
                <div className="rounded-xl bg-muted/50 px-3 py-2"><span className="text-muted-foreground">Imagens:</span> <span className="font-semibold">{preview.seed.includeImages ? "Sim" : "Não"}</span></div>
              </div>
              <Button variant="hero" size="lg" onClick={() => useTemplate(preview.id)} className="w-full mt-2">
                <Wand2 className="h-4 w-4" /> Usar este template
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Templates;
