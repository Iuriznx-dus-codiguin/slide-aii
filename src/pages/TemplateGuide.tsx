// Guia de um template (/templates/<id>): estrutura slide a slide, dicas, erros
// comuns e FAQ, com o botão que abre o gerador já preenchido. Página pública e
// pré-renderizada no build (scripts/prerender.ts).
import { Link, useParams } from "react-router-dom";
import { ArrowRight, BarChart3, ChevronRight, Image as ImageIcon, Layers, Lightbulb, TriangleAlert, Wand2 } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/lib/templates";
import { TEMPLATE_GUIDES_UPDATED, templateGuide } from "@/lib/templateGuides";
import { ORGANIZATION_ID, breadcrumbJsonLd, absoluteUrl, LOGO_URL, SITE_NAME } from "@/lib/seo";
import NotFound from "./NotFound";

const HOW_TO_STEPS = [
  "Clique em Usar este template: o formulário abre com título, descrição, tipo e número de slides preenchidos.",
  "Troque os campos entre colchetes e acrescente na descrição os seus dados, fontes e o que não pode faltar.",
  "Confira o custo em créditos e gere. A apresentação fica pronta em cerca de um minuto.",
  "Revise no editor: ajuste textos, imagens e gráficos, ou peça mudanças ao assistente de edição.",
  "Apresente pelo link público ou exporte em PowerPoint (.pptx) ou PDF.",
];

const TemplateGuide = () => {
  const { id } = useParams<{ id: string }>();
  const template = TEMPLATES.find((t) => t.id === id);
  const guide = templateGuide(id);
  if (!template || !guide) return <NotFound />;

  const path = `/templates/${template.id}`;
  const related = [
    ...TEMPLATES.filter((t) => t.id !== template.id && t.category === template.category),
    ...TEMPLATES.filter((t) => t.id !== template.id && t.category !== template.category),
  ].slice(0, 3);
  const generateUrl = `/gerar?template=${template.id}`;
  const helpGuide = template.category === "Educação"
    ? { to: "/ajuda/gerar-para-aula", label: "Como gerar apresentações para aulas" }
    : { to: "/ajuda/gerar-para-negocios", label: "Como gerar apresentações para negócios" };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo
        title={guide.seoTitle}
        description={guide.metaDescription}
        path={path}
        type="article"
        modifiedTime={TEMPLATE_GUIDES_UPDATED}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.h1,
            description: guide.metaDescription,
            inLanguage: "pt-BR",
            mainEntityOfPage: absoluteUrl(path),
            image: absoluteUrl("/og-image.png"),
            dateModified: TEMPLATE_GUIDES_UPDATED,
            author: { "@type": "Organization", "@id": ORGANIZATION_ID, name: SITE_NAME },
            publisher: { "@type": "Organization", "@id": ORGANIZATION_ID, name: SITE_NAME, logo: { "@type": "ImageObject", url: LOGO_URL } },
            about: template.title,
          },
          {
            "@context": "https://schema.org",
            ...breadcrumbJsonLd([
              { name: "Templates", path: "/templates" },
              { name: template.title, path },
            ]),
          },
        ]}
      />
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mb-6">
            <Link to="/" className="hover:text-foreground">Início</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link to="/templates" className="hover:text-foreground">Templates</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-foreground" aria-current="page">{template.title}</span>
          </nav>

          <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
                Template · {template.category}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">{guide.h1}</h1>
              <div className="mt-5 space-y-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
                {guide.intro.map((p) => <p key={p}>{p}</p>)}
              </div>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button asChild variant="hero" size="lg" className="group">
                  <Link to={generateUrl}>
                    <Wand2 className="h-4 w-4" /> Usar este template
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg"><Link to="/templates">Ver todos os templates</Link></Button>
              </div>
            </div>

            <aside aria-label="Resumo do template" className="rounded-3xl overflow-hidden border border-border bg-card shadow-sm">
              <div className="aspect-video relative flex items-center justify-center overflow-hidden" style={{ background: template.bg }}>
                <div className="absolute -top-1/2 -right-1/3 w-2/3 h-full rounded-full opacity-30 blur-3xl" style={{ background: template.accent }} />
                <div className="text-7xl relative z-10" aria-hidden>{template.emoji}</div>
              </div>
              <dl className="grid grid-cols-2 gap-3 p-4 text-sm">
                <div className="rounded-xl bg-muted/50 px-3 py-2"><dt className="text-muted-foreground flex items-center gap-1"><Layers className="h-3.5 w-3.5" aria-hidden /> Slides</dt><dd className="font-semibold">{template.seed.slidesCount}</dd></div>
                <div className="rounded-xl bg-muted/50 px-3 py-2"><dt className="text-muted-foreground">Tipo</dt><dd className="font-semibold">{template.seed.type}</dd></div>
                <div className="rounded-xl bg-muted/50 px-3 py-2"><dt className="text-muted-foreground flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" aria-hidden /> Gráficos</dt><dd className="font-semibold">{template.seed.includeCharts ? "Sim" : "Não"}</dd></div>
                <div className="rounded-xl bg-muted/50 px-3 py-2"><dt className="text-muted-foreground flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" aria-hidden /> Imagens</dt><dd className="font-semibold">{template.seed.includeImages ? "Sim" : "Não"}</dd></div>
              </dl>
              <p className="px-4 pb-4 text-sm text-muted-foreground"><strong className="text-foreground">Para quem é:</strong> {guide.audience}</p>
            </aside>
          </header>

          <section className="mt-14" aria-labelledby="estrutura">
            <h2 id="estrutura" className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Estrutura slide a slide</h2>
            <p className="mt-2 text-muted-foreground">O que colocar em cada um dos {template.seed.slidesCount} slides deste modelo.</p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {guide.outline.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-sm font-bold text-primary-foreground" aria-hidden>{i + 1}</span>
                  <div>
                    <h3 className="font-display font-bold">Slide {i + 1}: {s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            <section aria-labelledby="dicas" className="rounded-3xl border border-border bg-card p-6">
              <h2 id="dicas" className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" aria-hidden /> Dicas para um bom resultado</h2>
              <ul className="mt-4 space-y-3 text-muted-foreground leading-relaxed list-disc pl-5">
                {guide.tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
            <section aria-labelledby="erros" className="rounded-3xl border border-border bg-card p-6">
              <h2 id="erros" className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2"><TriangleAlert className="h-5 w-5 text-amber-500" aria-hidden /> Erros comuns</h2>
              <ul className="mt-4 space-y-3 text-muted-foreground leading-relaxed list-disc pl-5">
                {guide.mistakes.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </section>
          </div>

          <section className="mt-14" aria-labelledby="como-gerar">
            <h2 id="como-gerar" className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Como gerar esta apresentação com IA</h2>
            <ol className="mt-5 space-y-3 list-decimal pl-5 text-muted-foreground leading-relaxed">
              {HOW_TO_STEPS.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <p className="mt-4 text-sm text-muted-foreground">
              O template só pré-preenche a configuração; o conteúdo é escrito do zero para o seu tema. Veja também{" "}
              <Link to="/ajuda/escrever-bom-prompt" className="text-primary underline underline-offset-2">como escrever um bom tema</Link> e{" "}
              <Link to={helpGuide.to} className="text-primary underline underline-offset-2">{helpGuide.label.toLowerCase()}</Link>.
            </p>
          </section>

          <section className="mt-14" aria-labelledby="perguntas">
            <h2 id="perguntas" className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Perguntas frequentes</h2>
            <div className="mt-5 space-y-4">
              {guide.faq.map((f) => (
                <div key={f.q} className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-display font-semibold text-base">{f.q}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14" aria-labelledby="outros">
            <h2 id="outros" className="font-display text-2xl font-bold tracking-tight">Outros templates</h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((t) => (
                <li key={t.id}>
                  <Link to={`/templates/${t.id}`} className="group block h-full rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-elegant transition-all">
                    <div className="text-3xl" aria-hidden>{t.emoji}</div>
                    <div className="mt-3 font-display font-bold group-hover:text-primary transition-colors">{t.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14 rounded-3xl bg-gradient-hero px-6 py-10 text-center shadow-elegant">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary-foreground">Pronto para criar a sua?</h2>
            <p className="mt-3 text-primary-foreground/85 max-w-xl mx-auto">Use este template e receba os {template.seed.slidesCount} slides editáveis em cerca de um minuto.</p>
            <Button asChild size="lg" className="mt-6 bg-background text-primary hover:bg-background/90">
              <Link to={generateUrl}><Wand2 className="h-4 w-4" /> Usar este template</Link>
            </Button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TemplateGuide;
