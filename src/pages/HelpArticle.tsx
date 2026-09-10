import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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

interface Article {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  content_md: string;
  keywords: string[] | null;
  updated_at: string;
}

interface RelatedError {
  code: string;
  title: string;
  user_description: string | null;
  severity: string;
}

const HelpArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [errors, setErrors] = useState<RelatedError[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("help_articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (!data) { setLoading(false); return; }
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
          .limit(5);
        setRelated((rel as Article[]) ?? []);
      }
      setLoading(false);
    })();
  }, [slug]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const summary = article ? stripMd(article.content_md).slice(0, 155) : "";

  return (
    <div className="min-h-screen bg-background">
      {article && (
        <Seo
          title={`${article.title} — Central de Ajuda SlideAI`}
          description={summary}
          path={`/ajuda/${article.slug}`}
          type="article"
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: summary,
            articleSection: article.category ?? undefined,
            dateModified: article.updated_at,
            inLanguage: "pt-BR",
            mainEntityOfPage: `https://slideai.com.br/ajuda/${article.slug}`,
            author: { "@type": "Organization", name: "SlideAI" },
            publisher: { "@type": "Organization", name: "SlideAI" },
          }}
        />
      )}
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={34} />
          </Link>
          <Link to="/ajuda">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Central de Ajuda</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-4xl">
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
            <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
              <Link to="/ajuda" className="hover:text-foreground">Central de Ajuda</Link>
              <ChevronRight className="h-3 w-3" />
              {article.category && (
                <>
                  <span>{article.category}</span>
                  <ChevronRight className="h-3 w-3" />
                </>
              )}
              <span className="text-foreground truncate">{article.title}</span>
            </nav>

            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                {article.category && <Badge variant="secondary" className="mb-3">{article.category}</Badge>}
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{article.title}</h1>
                <p className="text-xs text-muted-foreground mt-2">
                  Atualizado em {new Date(article.updated_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Compartilhar"}
              </Button>
            </div>

            {/* Corpo do artigo */}
            <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-primary prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content_md}</ReactMarkdown>
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
                  onClick={() => { setFeedback("up"); toast.success("Obrigado pelo feedback!"); }}
                  disabled={feedback !== null}
                >👍 Sim</Button>
                <Button
                  variant={feedback === "down" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setFeedback("down"); navigate("/suporte/nova"); }}
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

function stripMd(md: string): string {
  return md.replace(/[#*_`>\-]/g, "").replace(/\s+/g, " ").trim();
}

export default HelpArticle;
