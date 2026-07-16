import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

type Occ = { id: string; user_id: string | null; error_code: string | null; route: string | null;
  status: string; created_at: string; context: any; stack_summary: string | null; };
type Cat = { code: string; title: string; user_description: string; tech_description: string;
  severity: string; module: string; ai_can_resolve: boolean; resolution_steps: string[]; };
type Conv = { id: string; ticket_id: string | null; state: string; rating: number | null;
  resolved_by_ai: boolean | null; subject: string | null; created_at: string; };

export default function AdminSupport() {
  const { isDeveloper, loading } = useDeveloperRole();
  const navigate = useNavigate();
  const [occurrences, setOccurrences] = useState<Occ[]>([]);
  const [catalog, setCatalog] = useState<Cat[]>([]);
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Cat | null>(null);

  useEffect(() => {
    document.title = "Suporte — Admin · SlideAI";
    if (!loading && !isDeveloper) navigate("/dashboard");
  }, [loading, isDeveloper, navigate]);

  const load = async () => {
    setRefreshing(true);
    const [{ data: o }, { data: c }, { data: cv }] = await Promise.all([
      supabase.from("error_occurrences").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("error_catalog").select("*").order("code"),
      supabase.from("support_conversations").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setOccurrences((o ?? []) as any);
    setCatalog((c ?? []) as any);
    setConversations((cv ?? []) as any);
    setRefreshing(false);
  };

  useEffect(() => { if (isDeveloper) load(); }, [isDeveloper]);

  const kpis = useMemo(() => {
    const total = conversations.length;
    const byAi = conversations.filter((c) => c.resolved_by_ai === true).length;
    const escalated = conversations.filter((c) => c.state === "escalated").length;
    const avgRating = conversations.filter((c) => c.rating != null)
      .reduce((a, c) => a + (c.rating ?? 0), 0) / Math.max(1, conversations.filter((c) => c.rating != null).length);
    const byCode = occurrences.reduce<Record<string, number>>((acc, o) => {
      const k = o.error_code ?? "SUP-999";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(byCode).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { total, byAi, escalated, avgRating: isFinite(avgRating) ? avgRating.toFixed(2) : "—", top };
  }, [conversations, occurrences]);

  const uncatalogued = occurrences.filter((o) => !o.error_code || o.error_code === "SUP-999");

  const markStatus = async (id: string, status: string) => {
    await supabase.from("error_occurrences").update({
      status, resolved_at: status === "resolved" ? new Date().toISOString() : null,
    }).eq("id", id);
    await load();
  };

  const saveCatalog = async () => {
    if (!editing) return;
    const { error } = await supabase.from("error_catalog").update({
      title: editing.title,
      user_description: editing.user_description,
      tech_description: editing.tech_description,
      severity: editing.severity as any,
      ai_can_resolve: editing.ai_can_resolve,
      resolution_steps: editing.resolution_steps,
      version: (catalog.find((c) => c.code === editing.code)?.version ?? 1) + 1,
    } as any).eq("code", editing.code);
    if (error) { toast.error(error.message); return; }
    toast.success("Catálogo atualizado");
    setEditing(null);
    load();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isDeveloper) return null;

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Suporte — Painel Admin</h1>
          <p className="text-sm text-muted-foreground">Observabilidade, catálogo de erros e conversas.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Conversas" value={String(kpis.total)} />
        <Kpi label="Resolvidas pela IA" value={`${kpis.byAi}/${kpis.total}`} />
        <Kpi label="Escaladas" value={String(kpis.escalated)} />
        <Kpi label="Satisfação média" value={kpis.avgRating} />
      </div>

      <Tabs defaultValue="occ">
        <TabsList>
          <TabsTrigger value="occ">Ocorrências</TabsTrigger>
          <TabsTrigger value="cat">Catálogo</TabsTrigger>
          <TabsTrigger value="uncat">Não catalogados ({uncatalogued.length})</TabsTrigger>
          <TabsTrigger value="conv">Conversas</TabsTrigger>
          <TabsTrigger value="kpi">KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="occ" className="space-y-2">
          {occurrences.map((o) => (
            <div key={o.id} className="border rounded-xl p-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{o.error_code ?? "não catalogado"}</Badge>
                  <span className="text-muted-foreground">{new Date(o.created_at).toLocaleString()}</span>
                  <span className="text-muted-foreground">{o.route}</span>
                  <Badge>{o.status}</Badge>
                </div>
                <p className="text-xs mt-1 truncate text-muted-foreground">{JSON.stringify(o.context).slice(0, 200)}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => markStatus(o.id, "investigating")}>Invest.</Button>
                <Button size="sm" onClick={() => markStatus(o.id, "resolved")}>Resolver</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="cat" className="space-y-2">
          {catalog.map((c) => (
            <div key={c.code} className="border rounded-xl p-3">
              {editing?.code === c.code ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Badge>{c.code}</Badge>
                    <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                  </div>
                  <Textarea value={editing.user_description} onChange={(e) => setEditing({ ...editing, user_description: e.target.value })} placeholder="Descrição para o usuário" />
                  <Textarea value={editing.tech_description} onChange={(e) => setEditing({ ...editing, tech_description: e.target.value })} placeholder="Descrição técnica" />
                  <Textarea
                    value={editing.resolution_steps.join("\n")}
                    onChange={(e) => setEditing({ ...editing, resolution_steps: e.target.value.split("\n").filter(Boolean) })}
                    placeholder="Passos (um por linha)"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveCatalog}><Save className="h-4 w-4" /> Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge>{c.code}</Badge>
                      <Badge variant="outline">{c.severity}</Badge>
                      <Badge variant="secondary">{c.module}</Badge>
                      {!c.ai_can_resolve && <Badge variant="destructive">escalação</Badge>}
                    </div>
                    <p className="font-medium mt-1">{c.title}</p>
                    <p className="text-sm text-muted-foreground">{c.user_description}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Editar</Button>
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="uncat" className="space-y-2">
          {uncatalogued.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item pendente.</p>}
          {uncatalogued.map((o) => (
            <div key={o.id} className="border rounded-xl p-3">
              <div className="text-sm">{new Date(o.created_at).toLocaleString()} · {o.route}</div>
              <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(o.context, null, 2)}</pre>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="conv" className="space-y-2">
          {conversations.map((c) => (
            <div key={c.id} className="border rounded-xl p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge>{c.ticket_id ?? c.id.slice(0, 8)}</Badge>
                <Badge variant="outline">{c.state}</Badge>
                {c.rating && <span>★ {c.rating}</span>}
                <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1">{c.subject}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="kpi">
          <div className="border rounded-xl p-4">
            <h3 className="font-medium mb-2">Top-10 códigos de erro</h3>
            <ul className="space-y-1 text-sm">
              {kpis.top.map(([code, n]) => (
                <li key={code} className="flex justify-between"><span className="font-mono">{code}</span><span>{n}</span></li>
              ))}
              {kpis.top.length === 0 && <li className="text-muted-foreground">Sem dados ainda.</li>}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <div className="border rounded-xl p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-2xl font-display font-bold mt-1">{value}</p>
  </div>
);
