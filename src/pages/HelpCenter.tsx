import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowLeft, BookOpen, LifeBuoy, ChevronRight, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/BrandLogo";

interface Article {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  content_md: string;
  keywords: string[] | null;
  updated_at: string;
}

const HelpCenter = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    document.title = "Central de Ajuda — SlideAI";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Central de Ajuda do SlideAI — tutoriais, guias e respostas para tirar o máximo da plataforma.");
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("help_articles")
        .select("id, slug, title, category, content_md, keywords, updated_at")
        .eq("is_published", true)
        .order("category", { ascending: true })
        .order("title", { ascending: true });
      setArticles((data as Article[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => a.category && set.add(a.category));
    return Array.from(set).sort();
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (!q) return true;
      const hay = `${a.title} ${a.content_md} ${(a.keywords ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [articles, search, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>();
    filtered.forEach((a) => {
      const key = a.category ?? "Outros";
      map.set(key, [...(map.get(key) ?? []), a]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const featured = articles.slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={34} />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero de busca */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto px-6 py-16 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <BookOpen className="h-3.5 w-3.5" /> Central de Ajuda
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Como podemos ajudar?
          </h1>
          <p className="text-muted-foreground mb-8">
            Guias, tutoriais e respostas para você aproveitar o SlideAI ao máximo.
          </p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busque por 'como gerar', 'pagamento', 'exportar PDF'…"
              className="pl-12 h-14 text-base rounded-xl shadow-sm"
            />
          </div>
        </div>
      </section>

      <main className="container mx-auto px-6 py-10 max-w-6xl">
        {/* Filtros por categoria */}
        {!loading && categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setCategory("all")}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                category === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
              }`}
            >Todos ({articles.length})</button>
            {categories.map((c) => {
              const count = articles.filter((a) => a.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    category === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                  }`}
                >{c} ({count})</button>
              );
            })}
          </div>
        )}

        {/* Destaques quando sem busca/filtro */}
        {!loading && !search && category === "all" && featured.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-xl font-bold mb-4">Populares</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((a) => (
                <Link key={a.id} to={`/ajuda/${a.slug}`}>
                  <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <HelpCircle className="h-5 w-5 text-primary" />
                        {a.category && <Badge variant="secondary" className="text-[10px]">{a.category}</Badge>}
                      </div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{a.title}</h3>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {stripMd(a.content_md).slice(0, 140)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Loader */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        )}

        {/* Lista agrupada */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <LifeBuoy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">Nenhum artigo encontrado para "{search}".</p>
            <p className="text-sm text-muted-foreground">
              Tente outros termos ou <Link to="/suporte/nova" className="text-primary underline">fale com o suporte</Link>.
            </p>
          </div>
        )}

        {!loading && grouped.map(([cat, items]) => (
          <section key={cat} className="mb-10">
            <h2 className="font-display text-lg font-bold mb-3 text-muted-foreground uppercase tracking-wider text-xs">
              {cat}
            </h2>
            <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
              {items.map((a) => (
                <Link key={a.id} to={`/ajuda/${a.slug}`} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors group">
                  <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium group-hover:text-primary transition-colors">{a.title}</div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {stripMd(a.content_md).slice(0, 160)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* CTA de suporte */}
        <section className="mt-12 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-8 text-center">
          <LifeBuoy className="h-8 w-8 text-primary mx-auto mb-3" />
          <h3 className="font-display text-xl font-bold mb-2">Não encontrou o que procurava?</h3>
          <p className="text-sm text-muted-foreground mb-4">Nosso assistente inteligente pode diagnosticar seu problema em segundos.</p>
          <Button asChild variant="hero"><Link to="/suporte/nova">Falar com o suporte</Link></Button>
        </section>
      </main>
    </div>
  );
};

function stripMd(md: string): string {
  return md.replace(/[#*_`>\-]/g, "").replace(/\s+/g, " ").trim();
}

export default HelpCenter;
