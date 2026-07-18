import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, Save, MessageSquare, ArrowUpRight, History, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type OccStatus = "open" | "investigating" | "resolved" | "reopened";
type Sev = "critical" | "high" | "medium" | "low" | "info";
type Occ = {
  id: string; user_id: string | null; error_code: string | null; route: string | null;
  status: OccStatus; created_at: string; resolved_at: string | null;
  context: any; stack_summary: string | null; request_id: string | null; session_id: string | null;
};
type Cat = {
  code: string; title: string; user_description: string; tech_description: string;
  severity: Sev; module: string; ai_can_resolve: boolean; resolution_steps: string[];
  probable_causes: string[]; version?: number;
};
type Conv = {
  id: string; ticket_id: string | null; state: string; rating: number | null;
  resolved_by_ai: boolean | null; subject: string | null; created_at: string; closed_at: string | null;
  user_id: string; related_error_code: string | null; escalation_reason: string | null;
};
type Msg = { id: string; role: string; content: string; code_ref: string | null; created_at: string };
type Article = { id: string; slug: string; title: string; category: string; content_md: string; keywords: string[]; is_published: boolean };
type Hist = { id: string; code: string; field: string; old_value: any; new_value: any; changed_by: string | null; changed_at: string };

const SEVERITIES: Sev[] = ["critical", "high", "medium", "low", "info"];
const MODULES = ["auth", "payments", "generation", "database", "webhook", "integration", "ui", "security", "support"];

export default function AdminSupport() {
  const { isDeveloper, loading } = useDeveloperRole();
  const navigate = useNavigate();
  const [occurrences, setOccurrences] = useState<Occ[]>([]);
  const [catalog, setCatalog] = useState<Cat[]>([]);
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [promoting, setPromoting] = useState<{ occ: Occ; draft: Partial<Cat> } | null>(null);
  const [convDetail, setConvDetail] = useState<{ conv: Conv; msgs: Msg[] } | null>(null);
  const [historyFor, setHistoryFor] = useState<{ code: string; rows: Hist[] } | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [filters, setFilters] = useState<{ code: string; status: string; severity: string }>({ code: "", status: "", severity: "" });

  useEffect(() => {
    document.title = "Suporte — Admin · SlideAI";
    if (!loading && !isDeveloper) navigate("/dashboard");
  }, [loading, isDeveloper, navigate]);

  const load = async () => {
    setRefreshing(true);
    const [{ data: o }, { data: c }, { data: cv }, { data: a }] = await Promise.all([
      supabase.from("error_occurrences").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("error_catalog").select("*").order("code"),
      supabase.from("support_conversations").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("help_articles").select("*").order("category").order("title"),
    ]);
    setOccurrences((o ?? []) as any);
    setCatalog((c ?? []) as any);
    setConversations((cv ?? []) as any);
    setArticles((a ?? []) as any);
    setRefreshing(false);
  };

  useEffect(() => { if (isDeveloper) load(); }, [isDeveloper]);

  const filteredOcc = useMemo(() => occurrences.filter((o) =>
    (!filters.code || (o.error_code ?? "").toLowerCase().includes(filters.code.toLowerCase())) &&
    (!filters.status || o.status === filters.status) &&
    (!filters.severity || catalog.find((c) => c.code === o.error_code)?.severity === filters.severity)
  ), [occurrences, filters, catalog]);

  const kpis = useMemo(() => {
    const total = conversations.length;
    const byAi = conversations.filter((c) => c.resolved_by_ai === true).length;
    const escalated = conversations.filter((c) => c.state === "escalated").length;
    const rated = conversations.filter((c) => c.rating != null);
    const avgRating = rated.length ? (rated.reduce((a, c) => a + (c.rating ?? 0), 0) / rated.length) : NaN;
    const closed = conversations.filter((c) => c.closed_at);
    const avgResolutionMin = closed.length
      ? closed.reduce((a, c) => a + (new Date(c.closed_at!).getTime() - new Date(c.created_at).getTime()), 0) / closed.length / 60000
      : NaN;
    const byCode = occurrences.reduce<Record<string, number>>((acc, o) => {
      const k = o.error_code ?? "SUP-999";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(byCode).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const openOcc = occurrences.filter((o) => o.status === "open" || o.status === "reopened").length;
    return {
      total, byAi, escalated,
      avgRating: isFinite(avgRating) ? avgRating.toFixed(2) : "—",
      avgResolution: isFinite(avgResolutionMin) ? `${avgResolutionMin.toFixed(0)} min` : "—",
      aiRate: total > 0 ? `${Math.round((byAi / total) * 100)}%` : "—",
      escalationRate: total > 0 ? `${Math.round((escalated / total) * 100)}%` : "—",
      openOcc, top,
    };
  }, [conversations, occurrences]);

  const uncatalogued = occurrences.filter((o) => !o.error_code || o.error_code === "SUP-999");

  const markStatus = async (id: string, status: OccStatus) => {
    const { error } = await supabase.from("error_occurrences").update({
      status, resolved_at: status === "resolved" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const saveCatalog = async () => {
    if (!editing) return;
    const { error } = await supabase.from("error_catalog").update({
      title: editing.title,
      user_description: editing.user_description,
      tech_description: editing.tech_description,
      severity: editing.severity as any,
      module: editing.module,
      ai_can_resolve: editing.ai_can_resolve,
      resolution_steps: editing.resolution_steps,
      probable_causes: editing.probable_causes,
    } as any).eq("code", editing.code);
    if (error) { toast.error(error.message); return; }
    toast.success("Catálogo atualizado");
    setEditing(null);
    load();
  };

  const openConversation = async (conv: Conv) => {
    const { data } = await supabase.from("support_messages")
      .select("*").eq("conversation_id", conv.id).order("created_at");
    setConvDetail({ conv, msgs: (data ?? []) as any });
  };

  const openHistory = async (code: string) => {
    const { data } = await supabase.from("error_catalog_history")
      .select("*").eq("code", code).order("changed_at", { ascending: false }).limit(50);
    setHistoryFor({ code, rows: (data ?? []) as any });
  };

  const promoteToCatalog = async () => {
    if (!promoting) return;
    const d = promoting.draft;
    if (!d.code || !d.title) { toast.error("Código e título obrigatórios"); return; }
    const { error } = await supabase.from("error_catalog").insert({
      code: d.code, title: d.title,
      user_description: d.user_description ?? "",
      tech_description: d.tech_description ?? "",
      severity: (d.severity ?? "medium") as any,
      module: d.module ?? "support",
      ai_can_resolve: d.ai_can_resolve ?? true,
      resolution_steps: d.resolution_steps ?? [],
      probable_causes: d.probable_causes ?? [],
    } as any);
    if (error) { toast.error(error.message); return; }
    await supabase.from("error_occurrences").update({ error_code: d.code }).eq("id", promoting.occ.id);
    toast.success(`${d.code} adicionado ao catálogo`);
    setPromoting(null);
    load();
  };

  const saveArticle = async () => {
    if (!editingArticle) return;
    const a = editingArticle;
    if (!a.slug || !a.title) { toast.error("Slug e título obrigatórios"); return; }
    const payload = {
      slug: a.slug, title: a.title, category: a.category, content_md: a.content_md,
      keywords: a.keywords, is_published: a.is_published,
    };
    const { error } = a.id
      ? await supabase.from("help_articles").update(payload).eq("id", a.id)
      : await supabase.from("help_articles").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Artigo salvo");
    setEditingArticle(null);
    load();
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Excluir este artigo?")) return;
    const { error } = await supabase.from("help_articles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isDeveloper) return null;

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Suporte — Painel Admin</h1>
          <p className="text-sm text-muted-foreground">Observabilidade, catálogo de erros, conversas e base de conhecimento.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi label="Conversas" value={String(kpis.total)} />
        <Kpi label="% IA" value={kpis.aiRate} hint={`${kpis.byAi}/${kpis.total}`} />
        <Kpi label="% Escalação" value={kpis.escalationRate} hint={String(kpis.escalated)} />
        <Kpi label="Satisfação" value={kpis.avgRating} hint="★ média" />
        <Kpi label="Tempo médio" value={kpis.avgResolution} hint="até resolver" />
        <Kpi label="Ocorrências abertas" value={String(kpis.openOcc)} />
        <Kpi label="Não catalogados" value={String(uncatalogued.length)} />
      </div>

      <Tabs defaultValue="occ">
        <TabsList>
          <TabsTrigger value="occ">Ocorrências ({filteredOcc.length})</TabsTrigger>
          <TabsTrigger value="cat">Catálogo ({catalog.length})</TabsTrigger>
          <TabsTrigger value="uncat">Não catalogados ({uncatalogued.length})</TabsTrigger>
          <TabsTrigger value="conv">Conversas ({conversations.length})</TabsTrigger>
          <TabsTrigger value="help">Ajuda ({articles.length})</TabsTrigger>
          <TabsTrigger value="kpi">KPIs</TabsTrigger>
        </TabsList>

        {/* OCORRÊNCIAS */}
        <TabsContent value="occ" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center border rounded-xl p-2">
            <Input placeholder="Filtrar por código…" className="max-w-[200px]"
              value={filters.code} onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))} />
            <Select value={filters.status || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? "" : v }))}>
              <SelectTrigger className="max-w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {["open", "investigating", "resolved", "reopened"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.severity || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, severity: v === "all" ? "" : v }))}>
              <SelectTrigger className="max-w-[180px]"><SelectValue placeholder="Severidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas severidades</SelectItem>
                {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filters.code || filters.status || filters.severity) && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({ code: "", status: "", severity: "" })}>Limpar</Button>
            )}
          </div>
          {filteredOcc.map((o) => {
            const cat = catalog.find((c) => c.code === o.error_code);
            return (
              <div key={o.id} className="border rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <Badge variant="outline">{o.error_code ?? "não catalogado"}</Badge>
                    {cat && <Badge variant="secondary">{cat.severity}</Badge>}
                    <Badge>{o.status}</Badge>
                    <span className="text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</span>
                    <span className="text-muted-foreground text-xs">{o.route}</span>
                    {o.request_id && <span className="text-muted-foreground text-xs font-mono">req:{o.request_id.slice(0, 8)}</span>}
                  </div>
                  {cat && <p className="text-sm mt-1">{cat.title}</p>}
                  <p className="text-xs mt-1 truncate text-muted-foreground font-mono">{JSON.stringify(o.context).slice(0, 240)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => markStatus(o.id, "investigating")}>Invest.</Button>
                  <Button size="sm" onClick={() => markStatus(o.id, "resolved")}>Resolver</Button>
                </div>
              </div>
            );
          })}
          {filteredOcc.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ocorrência com estes filtros.</p>}
        </TabsContent>

        {/* CATÁLOGO */}
        <TabsContent value="cat" className="space-y-2">
          {catalog.map((c) => (
            <div key={c.code} className="border rounded-xl p-3">
              {editing?.code === c.code ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Badge>{c.code}</Badge>
                    <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Título" />
                    <Select value={editing.severity} onValueChange={(v) => setEditing({ ...editing, severity: v as Sev })}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={editing.module} onValueChange={(v) => setEditing({ ...editing, module: v })}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-sm shrink-0">
                      <Switch checked={editing.ai_can_resolve} onCheckedChange={(v) => setEditing({ ...editing, ai_can_resolve: v })} />
                      IA resolve
                    </label>
                  </div>
                  <Textarea value={editing.user_description} onChange={(e) => setEditing({ ...editing, user_description: e.target.value })} placeholder="Descrição para o usuário" />
                  <Textarea value={editing.tech_description} onChange={(e) => setEditing({ ...editing, tech_description: e.target.value })} placeholder="Descrição técnica" />
                  <Textarea
                    value={editing.resolution_steps.join("\n")}
                    onChange={(e) => setEditing({ ...editing, resolution_steps: e.target.value.split("\n").filter(Boolean) })}
                    placeholder="Passos de resolução (um por linha)"
                  />
                  <Textarea
                    value={(editing.probable_causes ?? []).join("\n")}
                    onChange={(e) => setEditing({ ...editing, probable_causes: e.target.value.split("\n").filter(Boolean) })}
                    placeholder="Causas prováveis (uma por linha)"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveCatalog}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge>{c.code}</Badge>
                      <Badge variant="outline">{c.severity}</Badge>
                      <Badge variant="secondary">{c.module}</Badge>
                      {!c.ai_can_resolve && <Badge variant="destructive">escalação</Badge>}
                      {c.version && <span className="text-xs text-muted-foreground">v{c.version}</span>}
                    </div>
                    <p className="font-medium mt-1">{c.title}</p>
                    <p className="text-sm text-muted-foreground">{c.user_description}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openHistory(c.code)}><History className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Editar</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* NÃO CATALOGADOS */}
        <TabsContent value="uncat" className="space-y-2">
          {uncatalogued.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item pendente.</p>}
          {uncatalogued.map((o) => (
            <div key={o.id} className="border rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm flex items-center gap-2">
                    <span>{new Date(o.created_at).toLocaleString()}</span>
                    <Badge variant="outline">{o.route}</Badge>
                    {o.request_id && <span className="text-xs font-mono text-muted-foreground">req:{o.request_id.slice(0, 8)}</span>}
                  </div>
                  <pre className="text-xs mt-2 bg-muted p-2 rounded overflow-x-auto max-h-40">{JSON.stringify(o.context, null, 2)}</pre>
                </div>
                <Button size="sm" onClick={() => setPromoting({ occ: o, draft: { code: "", severity: "medium", module: "support", ai_can_resolve: true } })}>
                  <ArrowUpRight className="h-4 w-4 mr-1" /> Promover
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* CONVERSAS */}
        <TabsContent value="conv" className="space-y-2">
          {conversations.map((c) => (
            <div key={c.id} className="border rounded-xl p-3 text-sm flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge>{c.ticket_id ?? c.id.slice(0, 8)}</Badge>
                  <Badge variant={c.state === "escalated" ? "destructive" : c.state === "resolved" ? "default" : "outline"}>{c.state}</Badge>
                  {c.related_error_code && <Badge variant="secondary">{c.related_error_code}</Badge>}
                  {c.rating && <span>★ {c.rating}</span>}
                  {c.resolved_by_ai && <span className="text-xs text-muted-foreground">via IA</span>}
                  <span className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 truncate">{c.subject}</p>
                {c.escalation_reason && <p className="text-xs text-destructive mt-1">Escalação: {c.escalation_reason}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => openConversation(c)}>
                <MessageSquare className="h-4 w-4 mr-1" /> Abrir
              </Button>
            </div>
          ))}
        </TabsContent>

        {/* AJUDA */}
        <TabsContent value="help" className="space-y-2">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditingArticle({ id: "", slug: "", title: "", category: "geral", content_md: "", keywords: [], is_published: true })}>
              <Plus className="h-4 w-4 mr-1" /> Novo artigo
            </Button>
          </div>
          {articles.map((a) => (
            <div key={a.id} className="border rounded-xl p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{a.category}</Badge>
                  {!a.is_published && <Badge variant="secondary">rascunho</Badge>}
                  <span className="font-mono text-xs text-muted-foreground">{a.slug}</span>
                </div>
                <p className="font-medium mt-1">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.keywords.join(", ")}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditingArticle(a)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteArticle(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {articles.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum artigo. Crie o primeiro.</p>}
        </TabsContent>

        {/* KPIs */}
        <TabsContent value="kpi" className="space-y-4">
          <div className="border rounded-xl p-4">
            <h3 className="font-medium mb-3">Top-10 códigos de erro</h3>
            <ul className="space-y-1 text-sm">
              {kpis.top.map(([code, n]) => {
                const cat = catalog.find((c) => c.code === code);
                const max = kpis.top[0]?.[1] ?? 1;
                return (
                  <li key={code} className="flex items-center gap-3">
                    <span className="font-mono w-24">{code}</span>
                    <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                    <span className="text-muted-foreground w-16 text-right">{n} {cat ? `· ${cat.severity}` : ""}</span>
                  </li>
                );
              })}
              {kpis.top.length === 0 && <li className="text-muted-foreground">Sem dados ainda.</li>}
            </ul>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-xl p-4">
              <h3 className="font-medium mb-2">Resolução</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Resolvidas pela IA</span><span>{kpis.byAi} ({kpis.aiRate})</span></div>
                <div className="flex justify-between"><span>Escaladas p/ humano</span><span>{kpis.escalated} ({kpis.escalationRate})</span></div>
                <div className="flex justify-between"><span>Tempo médio de resolução</span><span>{kpis.avgResolution}</span></div>
                <div className="flex justify-between"><span>Satisfação média</span><span>{kpis.avgRating}</span></div>
              </div>
            </div>
            <div className="border rounded-xl p-4">
              <h3 className="font-medium mb-2">Ocorrências</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Abertas / reabertas</span><span>{kpis.openOcc}</span></div>
                <div className="flex justify-between"><span>Não catalogadas</span><span>{uncatalogued.length}</span></div>
                <div className="flex justify-between"><span>Total registradas</span><span>{occurrences.length}</span></div>
                <div className="flex justify-between"><span>Códigos únicos no catálogo</span><span>{catalog.length}</span></div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: detalhe de conversa */}
      <Dialog open={!!convDetail} onOpenChange={(v) => !v && setConvDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{convDetail?.conv.ticket_id ?? convDetail?.conv.id.slice(0, 8)} · {convDetail?.conv.state}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {convDetail?.msgs.map((m) => (
              <div key={m.id} className={`rounded-lg p-3 text-sm ${
                m.role === "user" ? "bg-primary/10" : m.role === "assistant" ? "bg-muted" : "bg-yellow-500/10 text-xs italic"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                  {m.code_ref && <Badge variant="secondary" className="text-[10px]">{m.code_ref}</Badge>}
                  <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {convDetail?.msgs.length === 0 && <p className="text-sm text-muted-foreground">Sem mensagens.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: histórico do catálogo */}
      <Dialog open={!!historyFor} onOpenChange={(v) => !v && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico · {historyFor?.code}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {historyFor?.rows.map((h) => (
              <div key={h.id} className="border rounded-lg p-2 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{h.field}</Badge>
                  <span className="text-muted-foreground">{new Date(h.changed_at).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-muted-foreground mb-1">Anterior</p><pre className="bg-muted p-1 rounded overflow-x-auto">{JSON.stringify(h.old_value, null, 2)}</pre></div>
                  <div><p className="text-muted-foreground mb-1">Novo</p><pre className="bg-muted p-1 rounded overflow-x-auto">{JSON.stringify(h.new_value, null, 2)}</pre></div>
                </div>
              </div>
            ))}
            {historyFor?.rows.length === 0 && <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: promover ao catálogo */}
      <Dialog open={!!promoting} onOpenChange={(v) => !v && setPromoting(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Promover ao catálogo</DialogTitle></DialogHeader>
          {promoting && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Código (ex: GEN-010)" value={promoting.draft.code ?? ""}
                  onChange={(e) => setPromoting({ ...promoting, draft: { ...promoting.draft, code: e.target.value.toUpperCase() } })} />
                <Select value={promoting.draft.severity ?? "medium"} onValueChange={(v) => setPromoting({ ...promoting, draft: { ...promoting.draft, severity: v as Sev } })}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={promoting.draft.module ?? "support"} onValueChange={(v) => setPromoting({ ...promoting, draft: { ...promoting.draft, module: v } })}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input placeholder="Título" value={promoting.draft.title ?? ""}
                onChange={(e) => setPromoting({ ...promoting, draft: { ...promoting.draft, title: e.target.value } })} />
              <Textarea placeholder="Descrição para o usuário" value={promoting.draft.user_description ?? ""}
                onChange={(e) => setPromoting({ ...promoting, draft: { ...promoting.draft, user_description: e.target.value } })} />
              <Textarea placeholder="Descrição técnica" value={promoting.draft.tech_description ?? ""}
                onChange={(e) => setPromoting({ ...promoting, draft: { ...promoting.draft, tech_description: e.target.value } })} />
              <Textarea placeholder="Passos (um por linha)"
                onChange={(e) => setPromoting({ ...promoting, draft: { ...promoting.draft, resolution_steps: e.target.value.split("\n").filter(Boolean) } })} />
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={promoting.draft.ai_can_resolve ?? true}
                  onCheckedChange={(v) => setPromoting({ ...promoting, draft: { ...promoting.draft, ai_can_resolve: v } })} />
                IA pode resolver este erro
              </label>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setPromoting(null)}>Cancelar</Button>
                <Button onClick={promoteToCatalog}><Save className="h-4 w-4 mr-1" /> Criar e vincular</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: editar artigo */}
      <Dialog open={!!editingArticle} onOpenChange={(v) => !v && setEditingArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingArticle?.id ? "Editar" : "Novo"} artigo de ajuda</DialogTitle></DialogHeader>
          {editingArticle && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="slug-do-artigo" value={editingArticle.slug}
                  onChange={(e) => setEditingArticle({ ...editingArticle, slug: e.target.value })} />
                <Input placeholder="Categoria" value={editingArticle.category}
                  onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })} />
                <label className="flex items-center gap-2 text-sm shrink-0">
                  <Switch checked={editingArticle.is_published}
                    onCheckedChange={(v) => setEditingArticle({ ...editingArticle, is_published: v })} />
                  Publicado
                </label>
              </div>
              <Input placeholder="Título" value={editingArticle.title}
                onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })} />
              <Input placeholder="Palavras-chave (vírgula)" value={editingArticle.keywords.join(", ")}
                onChange={(e) => setEditingArticle({ ...editingArticle, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })} />
              <Textarea rows={10} placeholder="Conteúdo (markdown)" value={editingArticle.content_md}
                onChange={(e) => setEditingArticle({ ...editingArticle, content_md: e.target.value })} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingArticle(null)}>Cancelar</Button>
                <Button onClick={saveArticle}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Kpi = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="border rounded-xl p-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-xl font-display font-bold mt-1">{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);
