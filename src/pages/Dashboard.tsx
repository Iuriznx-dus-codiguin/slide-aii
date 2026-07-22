import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Sparkles, Eye, Trash2, ExternalLink, Search, LogOut, Loader2, FileText, Pencil } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SlideRenderer } from "@/components/SlideRenderer";
import { AccountPanel } from "@/components/AccountPanel";

interface Pres {
  id: string; title: string; slug: string; slides_count: number; view_count: number;
  created_at: string; theme: string; font_style: string;
  cover?: { slide_type: string; layout_template: string; content: any } | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [list, setList] = useState<Pres[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, views: 0 });

  useEffect(() => { document.title = "Dashboard — SlideAI"; }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("presentations")
      .select("id,title,slug,slides_count,view_count,created_at,theme,font_style")
      .eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false });
    const items = (data as any[]) ?? [];

    // Buscar a capa (primeiro slide) de cada apresentação em paralelo
    const withCovers = await Promise.all(items.map(async (p) => {
      const { data: cov } = await supabase.from("slides")
        .select("slide_type,layout_template,content")
        .eq("presentation_id", p.id).order("position").limit(1).maybeSingle();
      return { ...p, cover: cov ?? null };
    }));

    setList(withCovers as Pres[]);
    setStats({ total: withCovers.length, views: withCovers.reduce((s, p) => s + (p.view_count || 0), 0) });
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm("Mover esta apresentação para a lixeira?")) return;
    await supabase.from("presentations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    toast.success("Movido para a lixeira");
    load();
  };

  const filtered = list.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/">
            <BrandLogo size={32} />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/ajuda"><Button variant="ghost" size="sm">Ajuda</Button></Link>
            <Link to="/perfil"><Button variant="ghost" size="sm">Perfil</Button></Link>
            <Link to="/settings"><Button variant="ghost" size="sm">Configurações</Button></Link>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="mb-8"><AccountPanel /></div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Minhas apresentações</h1>
            <p className="text-muted-foreground mt-1">{stats.total} apresentações · {stats.views} visualizações totais</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
            </div>
            <Button variant="hero" onClick={() => navigate("/gerar")}>
              <Plus className="h-4 w-4" /> Nova apresentação
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-primary/10 items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Nenhuma apresentação ainda</h2>
            <p className="text-muted-foreground mb-6">Crie sua primeira apresentação com IA em segundos.</p>
            <Button variant="hero" onClick={() => navigate("/gerar")}>
              <Sparkles className="h-4 w-4" /> Criar primeira apresentação
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p, i) => {
              const dyn = p.cover?.content?.dynamic_theme ?? null;
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-elegant transition-all">
                  <Link to={`/slides/${p.slug}`} className="block aspect-video relative overflow-hidden bg-black">
                    {p.cover ? (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Render real cover slide scaled down (1920x1080 → card width) */}
                        <div
                          className="origin-top-left"
                          style={{
                            width: 1920,
                            height: 1080,
                            transform: "scale(var(--cover-scale))",
                            // CSS var lets us recompute on resize via container query if needed; default 0.21 fits ~400px wide cards
                            ['--cover-scale' as any]: '0.21',
                          }}
                        >
                          <SlideRenderer
                            slide={p.cover as any}
                            themeId={p.theme}
                            fontId={p.font_style || "modern-sans"}
                            dynamicTheme={dyn}
                            noAnimate
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-card">
                        <div className="absolute inset-0 bg-gradient-primary opacity-20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles className="h-12 w-12 text-primary opacity-40" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <div className="p-4">
                    <h2 className="font-semibold truncate text-base">{p.title}</h2>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{p.slides_count} slides</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {p.view_count}</span>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      <Link to={`/slides/${p.slug}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full"><ExternalLink className="h-3 w-3" /> Ver</Button>
                      </Link>
                      <Link to={`/editor/${p.slug}`} aria-label={`Editar ${p.title}`}>
                        <Button variant="ghost" size="sm" title="Editar" aria-label={`Editar ${p.title}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar apresentação</span>
                        </Button>
                      </Link>
                      <ExportMenu presentationId={p.id} title={p.title} themeId={p.theme} slug={p.slug} variant="ghost" size="icon" label={`Exportar ${p.title}`} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.id)}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Excluir ${p.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir apresentação</span>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
