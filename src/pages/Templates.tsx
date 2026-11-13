// Biblioteca pública de templates. Filtros por categoria; cada card leva ao
// guia do template (/templates/<id>), com a estrutura slide a slide e o botão
// "Usar este template" → /gerar?template=<id>. Os cards são links (<a href>)
// para que buscadores encontrem e indexem cada guia.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates";
import { Seo } from "@/components/Seo";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const Templates = () => {
  const [cat, setCat] = useState<(typeof TEMPLATE_CATEGORIES)[number]>("Todos");

  const filtered = useMemo(
    () => cat === "Todos" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat),
    [cat]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo
        title="Modelos de Apresentação Prontos (Templates) | SlideAI"
        description="Modelos de apresentação com estrutura slide a slide: pitch deck, TCC, aula, relatório, plano de negócios, portfólio e mais. Escolha um e gere com IA."
        path="/templates"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Modelos de apresentação do SlideAI",
            url: absoluteUrl("/templates"),
            inLanguage: "pt-BR",
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: TEMPLATES.length,
              itemListElement: TEMPLATES.map((t, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: t.title,
                url: absoluteUrl(`/templates/${t.id}`),
              })),
            },
          },
          { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: "Templates", path: "/templates" }]) },
        ]}
      />
      <Navbar />
      <main className="flex-1 pt-24 pb-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
            <Link to="/" className="inline-flex items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground mb-6 [@media(pointer:coarse)]:min-h-11">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
              Templates
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Modelos de apresentação <span className="text-gradient">prontos</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Escolha um modelo para ver a estrutura slide a slide, dicas e erros comuns. A IA usa a estrutura como base e escreve um conteúdo único para o seu tema.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={`px-4 py-1.5 [@media(pointer:coarse)]:min-h-11 rounded-full text-sm font-medium transition-all ${
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
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {filtered.map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <Link
                  to={`/templates/${t.id}`}
                  className="group flex h-full flex-col text-left rounded-3xl overflow-hidden bg-card border border-border hover:border-primary/40 transition-all shadow-sm hover:shadow-elegant"
                >
                  <div
                    className="aspect-video relative flex items-center justify-center overflow-hidden"
                    style={{ background: t.bg }}
                  >
                    <div
                      className="absolute -top-1/2 -right-1/3 w-2/3 h-full rounded-full opacity-30 blur-3xl"
                      style={{ background: t.accent }}
                    />
                    <div className="text-7xl relative z-10 group-hover:scale-110 transition-transform" aria-hidden>{t.emoji}</div>
                    <div className="absolute bottom-4 left-4 right-4 z-10">
                      <div className="h-1 w-12 mb-2 rounded-full" style={{ background: t.accent }} />
                      <div className="text-white/90 text-sm font-semibold">{t.seed.slidesCount} slides</div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h2 className="font-display font-bold text-lg">{t.title}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium uppercase tracking-wide">{t.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{t.description}</p>
                    <span className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      Ver estrutura e usar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>

          <div className="mt-14 max-w-3xl mx-auto text-center text-sm text-muted-foreground space-y-2">
            <p>Os modelos pré-preenchem a configuração; não são apresentações já geradas. Substitua os campos entre colchetes e acrescente suas fontes e dados na descrição.</p>
            <p>
              Revise textos, referências e gráficos antes de apresentar. O PowerPoint exportado permite edição, mas as animações avançadas ficam estáticas. Veja as orientações para{" "}
              <Link to="/ajuda/gerar-para-aula" className="text-primary underline underline-offset-2">aulas</Link> e para{" "}
              <Link to="/ajuda/gerar-para-negocios" className="text-primary underline underline-offset-2">negócios</Link>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Templates;
