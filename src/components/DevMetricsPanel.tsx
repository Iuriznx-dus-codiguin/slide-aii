import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, Image as ImageIcon, Zap, Timer, TrendingUp, Layers } from "lucide-react";

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

// Motor de cenas (v2): generate-presentation grava em metadata a versão do
// motor, a latência por etapa, tokens (output_per_slide), comandos visuais,
// fallbacks e imagens pedidas × exibidas. O painel compara os dois motores
// lado a lado com os mesmos números.
const engineOf = (l: GenLog): 1 | 2 => (Number(l.metadata?.engine_version) === 2 ? 2 : 1);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

interface EngineStats {
  engine: 1 | 2;
  count: number;
  costUsd: number;
  durationMs: number;
  outputPerSlide: number;
  textOnlyShare: number | null;
  imagesRequested: number;
  imagesDisplayed: number | null;
  fallbacks: number;
}

const statsFor = (logs: GenLog[], engine: 1 | 2): EngineStats => {
  const ls = logs.filter((l) => engineOf(l) === engine);
  const shares = ls.map((l) => num(l.metadata?.text_only_share)).filter((v): v is number => v !== null);
  const displayed = ls.map((l) => num(l.metadata?.images?.displayed)).filter((v): v is number => v !== null);
  return {
    engine,
    count: ls.length,
    costUsd: avg(ls.map((l) => Number(l.actual_cost_usd || 0))),
    durationMs: avg(ls.map((l) => l.duration_ms || 0)),
    outputPerSlide: avg(ls.map((l) => num(l.metadata?.tokens?.output_per_slide)).filter((v): v is number => v !== null)),
    textOnlyShare: shares.length ? avg(shares) : null,
    imagesRequested: ls.reduce((s, l) => s + (l.images_pexels || 0) + (l.images_ai || 0), 0),
    imagesDisplayed: displayed.length ? displayed.reduce((a, b) => a + b, 0) : null,
    fallbacks: ls.reduce((s, l) => s + (Array.isArray(l.metadata?.fallbacks) ? l.metadata.fallbacks.length : 0), 0),
  };
};

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
  const engines = [statsFor(successLogs, 1), statsFor(successLogs, 2)];
  const hasV2 = engines[1].count > 0;
  const [openId, setOpenId] = useState<string | null>(null);

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

        {hasV2 && (
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3 w-3" /> Comparação por motor (médias por geração)
            </div>
            <table className="mt-2 w-full text-[11px] font-mono">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="font-normal">motor</th><th className="font-normal">n</th><th className="font-normal">custo</th>
                  <th className="font-normal">tempo</th><th className="font-normal">out/slide</th><th className="font-normal">só texto</th>
                  <th className="font-normal">img pedidas/exibidas</th><th className="font-normal">fallbacks</th>
                </tr>
              </thead>
              <tbody>
                {engines.map((e) => (
                  <tr key={e.engine} className="tabular-nums">
                    <td>v{e.engine}</td>
                    <td>{e.count}</td>
                    <td>${e.costUsd.toFixed(3)}</td>
                    <td>{(e.durationMs / 1000).toFixed(1)}s</td>
                    <td>{e.outputPerSlide ? Math.round(e.outputPerSlide) : "—"}</td>
                    <td>{e.textOnlyShare === null ? "—" : `${Math.round(e.textOnlyShare * 100)}%`}</td>
                    <td>{e.imagesRequested}/{e.imagesDisplayed ?? "—"}</td>
                    <td>{e.engine === 2 ? e.fallbacks : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
            <div key={l.id} className="rounded-md bg-muted/30 border border-border/50">
            <button
              type="button"
              onClick={() => setOpenId((cur) => (cur === l.id ? null : l.id))}
              className="w-full flex items-center justify-between gap-2 text-xs font-mono p-2 text-left"
            >
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
                <span>v{engineOf(l)}</span>
              </div>
            </button>
            {openId === l.id && l.status === "success" && <LogDetail log={l} />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/** Detalhe de uma geração: latência por etapa, tokens, comandos e fallbacks. */
const LogDetail = ({ log }: { log: GenLog }) => {
  const m = log.metadata ?? {};
  const st = m.stages ?? {};
  const stageRows: [string, unknown][] = [
    ["direção", st.direction_ms],
    ["diretor", st.director?.latency_ms],
    ["roteiro", st.story?.latency_ms],
    ["plano", st.plan_ms],
    ["conteúdo", st.content?.latency_ms],
    ["resolução", st.resolve_ms],
    ["gravação", st.persist?.latency_ms],
  ];
  // commands: um por slide (null = slide só de texto). Agregado por comando.
  const commandList: unknown[] = Array.isArray(m.commands) ? m.commands : [];
  const counts: Record<string, number> = {};
  for (const c of commandList) if (typeof c === "string") counts[c] = (counts[c] ?? 0) + 1;
  const commands = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const fallbacks: string[] = (Array.isArray(m.fallbacks) ? m.fallbacks : [])
    .map((f: { index?: number; chain?: string[] }) => `S${(f.index ?? 0) + 1} ${(f.chain ?? []).join("→")}`);
  return (
    <div className="border-t border-border/50 p-2 space-y-1.5 text-[11px] font-mono text-muted-foreground">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {stageRows.filter(([, v]) => typeof v === "number").map(([k, v]) => (
          <span key={k}>{k} {((v as number) / 1000).toFixed(1)}s</span>
        ))}
        {st.director?.source === "fallback" && <span className="text-destructive">diretor: fallback</span>}
        {st.story?.source === "fallback" && <span className="text-destructive">roteiro: fallback</span>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {m.tokens && <span>tokens {m.tokens.input ?? 0} in / {m.tokens.output ?? 0} out</span>}
        {m.tokens?.output_per_slide ? <span>{m.tokens.output_per_slide} out/slide</span> : null}
        {Array.isArray(st.content?.calls) && <span>{st.content.calls.length} chamada(s) de conteúdo{st.content.retry ? " + retry" : ""}</span>}
        {num(st.content?.filled_from_outline) ? <span>{st.content.filled_from_outline} do roteiro</span> : null}
        {m.images && <span>imagens {(m.images.requested?.pexels ?? 0) + (m.images.requested?.ai ?? 0)} pedidas / {m.images.displayed ?? "—"} exibidas</span>}
        {num(m.text_only_share) !== null && <span>só texto {Math.round(m.text_only_share * 100)}% (seq. máx {m.max_text_run ?? "—"})</span>}
        {st.persist?.quota && <span>cota: {st.persist.quota}</span>}
      </div>
      {commands.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {commands.map(([c, n]) => (
            <span key={c} className="rounded border border-border px-1.5 py-0.5">{c} ×{n}</span>
          ))}
        </div>
      )}
      {fallbacks.length > 0 && <div className="text-amber-600 dark:text-amber-400">fallbacks: {fallbacks.join(" · ")}</div>}
    </div>
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
