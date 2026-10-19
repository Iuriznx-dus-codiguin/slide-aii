import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Terminal, Users, FileStack, TrendingUp, Activity, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { estimateGenerationCost, modeFromBudget, modeLabel } from "@/lib/devSettings";
import { useDevSettings } from "@/hooks/useDevSettings";
import SecurityEventsPanel from "@/components/SecurityEventsPanel";
import { DevMetricsPanel } from "@/components/DevMetricsPanel";
import { HelpFeedbackPanel } from "@/components/HelpFeedbackPanel";

interface Metrics {
  totalPresentations: number;
  totalSlides: number;
  totalUsers: number;
  activeUsers7d: number;
  paidUsers: number;
  avgSlidesPerUser: number;
  slidesLast24h: number;
  presentationsLast24h: number;
  topUsers: { full_name: string | null; gen: number }[];
  recentPresentations: { title: string; created_at: string; slides_count: number }[];
}

const DevDashboard = () => {
  const { isDeveloper, loading: roleLoading } = useDeveloperRole();
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const settings = useDevSettings();
  const derivedMode = modeFromBudget(settings.maxBudgetUsd);
  const sampleEstimate = estimateGenerationCost(10, true, derivedMode);

  useEffect(() => { document.title = "Dev Dashboard — SlideAI"; }, []);

  useEffect(() => {
    if (!isDeveloper) return;
    const load = async () => {
      const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      // Totais de conteúdo por função da equipe: as tabelas só mostram ao
      // usuário as próprias apresentações, então a contagem direta saía errada.
      const [content, usersTotal, profiles, topGen] = await Promise.all([
        supabase.rpc("staff_content_stats"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("plan, generations_count, updated_at"),
        supabase.from("profiles").select("full_name, generations_count").order("generations_count", { ascending: false }).limit(5),
      ]);
      const stats = (content.data ?? {}) as {
        presentations_total?: number; presentations_24h?: number; slides_total?: number; slides_24h?: number;
        recent?: { title: string; created_at: string; slides_count: number }[];
      };

      const profileRows = (profiles.data ?? []) as any[];
      const paidUsers = profileRows.filter((p) => p.plan && p.plan !== "free").length;
      const activeUsers7d = profileRows.filter((p) => p.updated_at && p.updated_at >= since7d).length;
      const totalGen = profileRows.reduce((a, p) => a + (p.generations_count ?? 0), 0);
      const avgSlidesPerUser = profileRows.length ? totalGen / profileRows.length : 0;

      setM({
        totalPresentations: stats.presentations_total ?? 0,
        totalSlides: stats.slides_total ?? 0,
        totalUsers: usersTotal.count ?? 0,
        activeUsers7d, paidUsers, avgSlidesPerUser,
        slidesLast24h: stats.slides_24h ?? 0,
        presentationsLast24h: stats.presentations_24h ?? 0,
        topUsers: (topGen.data ?? []).map((u: any) => ({ full_name: u.full_name, gen: u.generations_count ?? 0 })),
        recentPresentations: stats.recent ?? [],
      });
      setLoading(false);
    };
    load();
    const id = setInterval(() => { load(); setTick((t) => t + 1); }, 15000);

    // Realtime: novos slides incrementam o feed
    const channel = supabase.channel("dev-slides")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "slides" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "presentations" }, () => load())
      .subscribe();

    return () => { clearInterval(id); supabase.removeChannel(channel); };
  }, [isDeveloper]);

  if (roleLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isDeveloper) return <Navigate to="/" replace />;


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span className="font-display font-bold">Dev Dashboard</span>
            <span className="text-xs text-muted-foreground">atualizado a cada 15s · realtime</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading || !m ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Apresentações" value={m.totalPresentations} icon={<FileStack className="h-4 w-4" />} sub={`+${m.presentationsLast24h} em 24h`} />
              <Stat label="Slides totais" value={m.totalSlides} icon={<Activity className="h-4 w-4" />} sub={`+${m.slidesLast24h} em 24h`} />
              <Stat label="Usuários" value={m.totalUsers} icon={<Users className="h-4 w-4" />} sub={`${m.activeUsers7d} ativos / 7d`} />
              <Stat label="Assinantes pagos" value={m.paidUsers} icon={<TrendingUp className="h-4 w-4" />} sub={`média ${m.avgSlidesPerUser.toFixed(1)} ger/usuário`} />
            </section>

            <section className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Configuração atual de geração</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row k="Teto por geração" v={`$${settings.maxBudgetUsd.toFixed(2)}`} />
                  <Row k="Modo derivado" v={modeLabel(derivedMode)} />
                  <Row k="Bypass paywall" v={settings.bypassPaywall ? "sim" : "não"} />
                  <div className="pt-3 border-t border-border space-y-1 font-mono text-xs">
                    <Row k="Estimativa 10 slides" v={`$${sampleEstimate.totalUsd.toFixed(3)} · ${Math.round(sampleEstimate.seconds)}s`} />
                    <Row k="Pexels / IA imagens" v={`${sampleEstimate.imagesPexels} / ${sampleEstimate.imagesAi}`} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Top criadores</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="text-right">Gerações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.topUsers.length === 0 && (
                        <TableRow><TableCell colSpan={2} className="text-muted-foreground text-sm">Sem dados</TableCell></TableRow>
                      )}
                      {m.topUsers.map((u, i) => (
                        <TableRow key={i}>
                          <TableCell>{u.full_name ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono">{u.gen}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>

            <section>
              <DevMetricsPanel />
            </section>

            <section>
              <SecurityEventsPanel />
            </section>

            <section>
              <HelpFeedbackPanel />
            </section>


            <section>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Feed em tempo real — últimas apresentações</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead className="text-right">Slides</TableHead>
                        <TableHead className="text-right">Quando</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.recentPresentations.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{p.title}</TableCell>
                          <TableCell className="text-right font-mono">{p.slides_count}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

const Stat = ({ label, value, icon, sub }: { label: string; value: number | string; icon: React.ReactNode; sub?: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider">
        <span>{label}</span>{icon}
      </div>
      <div className="font-display text-3xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </CardContent>
  </Card>
);

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
);

export default DevDashboard;
