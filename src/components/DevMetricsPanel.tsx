import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, Image as ImageIcon, Zap, Timer, TrendingUp } from "lucide-react";

interface GenLog {
  id: string;
  status: string;
  reason: string | null;
  model: string | null;
  mode: string | null;
  slides_count: number;
  images_pexels: number;
  images_ai: number;
  estimated_cost_usd: number;
  actual_cost_usd: number;
  duration_ms: number;
  created_at: string;
  user_id: string;
  metadata: any;
}

export const DevMetricsPanel = () => {
  const [logs, setLogs] = useState<GenLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("generation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("dev-metrics")
      .on("postgres_changes", { event: "*", schema: "public", table: "generation_logs" }, () => load())
      .subscribe();
    const id = setInterval(load, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(id); };
  }, []);

  const successLogs = logs.filter((l) => l.status === "success");
  const errorLogs = logs.filter((l) => l.status !== "success");
  // Causas de falha agrupadas: identifica rapidamente se o problema da vez é
  // sobrecarga do provedor, resposta truncada ou erro interno.
  const failureCauses = Object.entries(
    errorLogs.reduce<Record<string, number>>((acc, l) => {
      const code = l.metadata?.failure_code ?? l.reason ?? "desconhecido";
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const creditsRefunded = errorLogs.reduce((s, l) => s + Number(l.metadata?.credits_refunded || 0), 0);
  // Falha em que o estorno não passou: o crédito ficou retido com o usuário
  // sem a geração ter acontecido — exige ação manual.
  const stuckCredits = errorLogs.filter((l) => l.metadata?.refund_failed === true);
  const totalGen = successLogs.length;
  const totalPexels = successLogs.reduce((s, l) => s + (l.images_pexels || 0), 0);
  const totalAi = successLogs.reduce((s, l) => s + (l.images_ai || 0), 0);
  const totalActualUsd = successLogs.reduce((s, l) => s + Number(l.actual_cost_usd || 0), 0);
  const totalEstimatedUsd = successLogs.reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0);
  const avgDuration = successLogs.length
    ? successLogs.reduce((s, l) => s + (l.duration_ms || 0), 0) / successLogs.length
    : 0;
  const pexelsRatio = totalPexels + totalAi > 0 ? (totalPexels / (totalPexels + totalAi)) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Métricas Dev (50 últimas)
        </CardTitle>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">realtime</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Metric icon={<Zap className="h-3.5 w-3.5" />} label="Gerações" value={totalGen.toString()} />
          <Metric icon={<ImageIcon className="h-3.5 w-3.5" />} label="Pexels / IA" value={`${totalPexels} / ${totalAi}`} sub={`${pexelsRatio.toFixed(0)}% Pexels`} />
          <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Custo real" value={`$${totalActualUsd.toFixed(3)}`} sub={`est. $${totalEstimatedUsd.toFixed(3)}`} />
          <Metric icon={<Timer className="h-3.5 w-3.5" />} label="Tempo médio" value={`${(avgDuration / 1000).toFixed(1)}s`} />
        </div>

        {failureCauses.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="h-3 w-3" /> Falhas ({errorLogs.length})
              </span>
              {creditsRefunded > 0 && <span>{creditsRefunded} créditos estornados</span>}
            </div>
            {stuckCredits.length > 0 && (
              <div className="mt-2 rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive">
                {stuckCredits.length} {stuckCredits.length === 1 ? "tentativa ficou" : "tentativas ficaram"} com crédito retido — estorno falhou, requer ação manual
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {failureCauses.map(([code, count]) => (
                <span key={code} className="rounded-full border border-destructive/30 bg-background px-2 py-0.5 text-[11px] font-mono text-destructive">
                  {code} <span className="tabular-nums opacity-70">×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}
          {!loading && logs.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma geração ainda.</div>}
          {logs.slice(0, 20).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-xs font-mono p-2 rounded-md bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${l.status === "success" ? "bg-emerald-500" : "bg-destructive"}`} />
                <span className="truncate text-foreground">{l.metadata?.title ?? "(sem título)"}</span>
                {l.status !== "success" && (
                  <span className="flex-shrink-0 text-destructive">
                    {l.metadata?.failure_code ?? l.reason ?? "erro"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground flex-shrink-0">
                <span>{l.slides_count}sl</span>
                <span>{l.images_pexels}p/{l.images_ai}a</span>
                <span>${Number(l.actual_cost_usd).toFixed(3)}</span>
                <span>{(l.duration_ms / 1000).toFixed(1)}s</span>
                <span className="hidden md:inline">{l.mode}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Metric = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
      <span>{label}</span>{icon}
    </div>
    <div className="font-display text-xl font-bold mt-1">{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
  </div>
);
