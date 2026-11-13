import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, BookOpen, LifeBuoy, Copy, Check, AlertTriangle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Seo } from "@/components/Seo";
import { helpCategoryLabel } from "@/lib/helpCategories";
import { usePrerenderData } from "@/lib/prerender";
import { LOGO_URL, ORGANIZATION_ID, SITE_NAME, absoluteUrl, breadcrumbJsonLd, summarizeMarkdown } from "@/lib/seo";
import creationFormAsset from "@/assets/guide-creation-form.png.asset.json";

export interface Article {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  content_md: string;
  keywords: string[] | null;
  /** Ausente no HTML pré-renderizado quando o build não sabe a data. */
  updated_at?: string | null;
}

/** Dados embutidos no HTML pré-renderizado do artigo (scripts/prerender.ts). */
export interface HelpArticleSeed {
  article: Article;
  related: Article[];
}

interface RelatedError {
  code: string;
  title: string;
  user_description: string | null;
  severity: string;
}

const HelpArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Primeira visita vinda do HTML pré-renderizado: começa com o artigo já na
  // tela e busca a versão publicada em seguida (sem esqueleto piscando).
  const seed = usePrerenderData<HelpArticleSeed>("helpArticle", pathname);
  const [article, setArticle] = useState<Article | null>(seed?.article ?? null);
  const [related, setRelated] = useState<Article[]>(seed?.related ?? []);
  const [errors, setErrors] = useState<RelatedError[]>([]);
  const [loading, setLoading] = useState(!seed);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  // Voto anônimo (um por pessoa, artigo e dia); a equipe vê o resumo no /__dev.
  const recordFeedback = async (helpful: boolean) => {
    if (!article) return;
    await supabase.rpc("record_help_feedback", { _slug: article.slug, _helpful: helpful });
  };

  useEffect(() => {
    if (!slug) return;
    if (!seed) setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      // Falha de rede: mantém o artigo pré-renderizado (se for o desta rota).
      // Resposta vazia: o artigo não está publicado, então "não encontrado".
      if (!data) { if (!(error && seed)) setArticle(null); setLoading(false); return; }
      setArticle(data as Article);

      // Buscar erros que referenciam esse artigo
      const { data: errs } = await supabase
        .from("error_catalog")
        .select("code, title, user_description, severity")
        .contains("related_articles", [slug])
        .limit(6);
      setErrors((errs as RelatedError[]) ?? []);

      // Buscar artigos relacionados (mesma categoria)
      if (data.category) {
        const { data: rel } = await supabase
          .from("help_articles")
          .select("id, slug, title, category, content_md, keywords, updated_at")
          .eq("is_published", true)
          .eq("category", data.category)
          .neq("slug", slug)
          .order("title", { ascending: true })
          .limit(5);
        setRelated((rel as Article[]) ?? []);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o seed só vale para a primeira rota
  }, [slug]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const summary = article ? summarizeMarkdown(article.content_md, 155) : "";
  const articlePath = article ? `/ajuda/${article.slug}` : `/ajuda/${slug ?? ""}`;

  return (
    <div className="min-h-screen bg-background">
      {article && (
        <Seo
          title={`${article.title} | Central de Ajuda SlideAI`}
          description={summary}
          path={articlePath}
          type="article"
          modifiedTime={article.updated_at ?? undefined}
          jsonLd={[
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: article.title,
              description: summary,
              articleSection: article.category ? helpCategoryLabel(article.category) : undefined,
              keywords: article.keywords?.join(", ") || undefined,
              ...(article.updated_at ? { dateModified: article.updated_at } : {}),
              inLanguage: "pt-BR",
              image: absoluteUrl("/og-image.png"),
              mainEntityOfPage: absoluteUrl(articlePath),
              author: { "@type": "Organization", "@id": ORGANIZATION_ID, name: SITE_NAME },
              publisher: { "@type": "Organization", "@id": ORGANIZATION_ID, name: SITE_NAME, logo: { "@type": "ImageObject", url: LOGO_URL } },
            },
            {
              "@context": "https://schema.org",
              ...breadcrumbJsonLd([
                { name: "Central de Ajuda", path: "/ajuda" },
                { name: article.title, path: articlePath },
              ]),
            },
          ]}
        />
      )}
      {!loading && !article && (
        <Seo title="Artigo não encontrado | SlideAI" description="O artigo pode ter sido movido ou removido da Central de Ajuda do SlideAI." path={articlePath} noindex />
      )}
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-30">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="SlideAI, página inicial">
            <BrandLogo size={34} wordmarkClassName="hidden min-[360px]:inline" />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/ajuda"><ArrowLeft className="h-4 w-4" /> Central de Ajuda</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-10 max-w-4xl">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-64" />
          </div>
        ) : !article ? (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold mb-2">Artigo não encontrado</h1>
            <p className="text-muted-foreground mb-6">O artigo pode ter sido movido ou removido.</p>
            <Button onClick={() => navigate("/ajuda")}>Voltar para Central de Ajuda</Button>
          </div>
        ) : (
          <>
            {/* Breadcrumb */}
            <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mb-4">
              <Link to="/ajuda" className="hover:text-foreground">Central de Ajuda</Link>
              <ChevronRight className="h-3 w-3" />
              {article.category && (
                <>
                  <span>{helpCategoryLabel(article.category)}</span>
                  <ChevronRight className="h-3 w-3" />
                </>
              )}
              <span className="text-foreground truncate max-w-full" aria-current="page">{article.title}</span>
            </nav>

            {/* No celular o botão vai para baixo do título (lado a lado, passava 68px da tela em 320). */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-6">
              <div className="min-w-0">
                {article.category && <Badge variant="secondary" className="mb-3">{helpCategoryLabel(article.category)}</Badge>}
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{article.title}</h1>
                {article.updated_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Atualizado em <time dateTime={article.updated_at}>{new Date(article.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={copyLink} className="self-start shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Compartilhar"}
              </Button>
            </div>

            {/* Corpo do artigo */}
            {article.slug === "como-gerar-apresentacao" && (
              <figure className="mb-8">
                <img src={creationFormAsset.url} alt="Formulário real do SlideAI preenchido com o tema Ciclo da água para o 6º ano, descrição da aula e 8 slides" width={684} height={350} loading="lazy" className="w-full h-auto rounded-lg border border-border" />
                <figcaption className="mt-2 text-sm text-muted-foreground">Exemplo de configuração antes de gerar; nenhuma apresentação foi criada para esta ilustração.</figcaption>
              </figure>
            )}
            <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Links internos (/ajuda/…, /termos#…) navegam sem recarregar a página.
                  a: ({ href, children }) =>
                    href && href.startsWith("/")
                      ? <Link to={href}>{children}</Link>
                      : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                }}
              >{article.content_md}</ReactMarkdown>
            </article>

            {/* Erros relacionados */}
            {errors.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Códigos de erro relacionados
                </h2>
                <div className="grid gap-3">
                  {errors.map((e) => (
                    <Card key={e.code} className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-4 flex items-start gap-3">
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-shrink-0">{e.code}</code>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{e.title}</div>
                          {e.user_description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.user_description}</p>
                          )}
                        </div>
                        <Badge variant={e.severity === "critical" ? "destructive" : "secondary"} className="text-[10px] uppercase">
                          {e.severity}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Feedback */}
            <section className="mt-12 border-t border-border pt-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">Este artigo foi útil?</p>
              <div className="flex justify-center gap-2">
                <Button
                  variant={feedback === "up" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setFeedback("up"); void recordFeedback(true); toast.success("Obrigado pelo feedback!"); }}
                  disabled={feedback !== null}
                >👍 Sim</Button>
                <Button
                  variant={feedback === "down" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setFeedback("down"); void recordFeedback(false); navigate("/suporte/nova"); }}
                  disabled={feedback !== null}
                >👎 Não, preciso de ajuda</Button>
              </div>
            </section>

            {/* Relacionados */}
            {related.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-xl font-bold mb-4">Artigos relacionados</h2>
                <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
                  {related.map((a) => (
                    <Link key={a.id} to={`/ajuda/${a.slug}`} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors group">
                      <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium group-hover:text-primary transition-colors">{a.title}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-12 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6 text-center">
              <LifeBuoy className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Ainda com dúvidas?</p>
               <Button size="sm" asChild><Link to="/suporte/nova">Falar com o suporte</Link></Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default HelpArticle;
