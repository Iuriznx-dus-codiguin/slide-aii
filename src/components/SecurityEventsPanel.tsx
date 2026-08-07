// Trilha de abuso — leitura de `security_events` (rate limit, 401/403,
// webhook inválido, upload rejeitado). Só admin/developer enxerga: a RLS da
// tabela já bloqueia qualquer outro usuário, este componente é apenas a
// superfície de leitura no painel Dev.
//
// O `request_id` é a chave de correlação: o mesmo id aparece no header
// `x-request-id` da resposta da edge function e nos logs estruturados dela,
// então dá para partir de uma linha aqui e achar a requisição inteira.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw } from "lucide-react";

interface SecurityEvent {
  id: string;
  request_id: string | null;
  event_type: string;
  severity: string;
  fn_name: string | null;
  status_code: number | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const LABEL: Record<string, string> = {
  rate_limited: "Rate limit",
  daily_limit: "Limite diário",
  unauthorized: "401 não autenticado",
  forbidden: "403 sem permissão",
  webhook_invalid_secret: "Webhook: segredo inválido",
  webhook_error: "Webhook: erro",
  upload_rejected: "Upload rejeitado",
  invalid_input: "Entrada inválida",
};

const severityVariant = (s: string): "destructive" | "secondary" | "outline" =>
  s === "critical" ? "destructive" : s === "warning" ? "secondary" : "outline";

export const SecurityEventsPanel = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("security_events" as any)
      .select("id, request_id, event_type, severity, fn_name, status_code, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    setEvents((data as unknown as SecurityEvent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Realtime não é necessário aqui: incidentes são raros e um refresh
    // periódico leve evita manter mais um canal aberto no navegador.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const critical = events.filter((e) => e.severity === "critical").length;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          Eventos de segurança
          {critical > 0 && <Badge variant="destructive">{critical} crítico(s)</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando…" : "Nenhuma tentativa de abuso registrada."}
          </p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="rounded-md border border-border/60 p-2.5 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={severityVariant(e.severity)}>{LABEL[e.event_type] ?? e.event_type}</Badge>
                  <span className="text-muted-foreground text-xs">{e.fn_name}</span>
                  {e.status_code && <span className="font-mono text-xs">{e.status_code}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {e.request_id && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
                    request_id: {e.request_id}
                  </p>
                )}
                {e.detail && Object.keys(e.detail).length > 0 && (
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground break-all">
                    {JSON.stringify(e.detail)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SecurityEventsPanel;
