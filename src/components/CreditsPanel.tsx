import { useEffect, useState } from "react";
import { Coins, TrendingDown, Gift, CalendarClock, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import { isMaxPlan, PLAN_LABELS } from "@/lib/cakto";

interface Tx {
  id: string;
  type: string;
  amount: number;
  balance_bonus_after: number;
  balance_monthly_after: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  consume: "Geração de apresentação",
  monthly_reset: "Renovação mensal do plano",
  monthly_grant: "Créditos mensais do plano",
  bonus_grant: "Créditos bônus",
  single_purchase: "Compra avulsa",
  signup_bonus: "Bônus de ativação",
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

/**
 * Extrato de créditos do usuário: saldo disponível (mensal + bônus),
 * cota do plano e histórico de consumo/concessões.
 * A ordem de consumo é: cota mensal primeiro, bônus permanente por último.
 */
export const CreditsPanel = () => {
  const { user } = useAuth();
  const ent = useEntitlement();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, type, amount, balance_bonus_after, balance_monthly_after, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (active) { setTxs((data as unknown as Tx[]) ?? []); setLoading(false); }
    })();
    return () => { active = false; };
  }, [user]);

  const spent30d = txs
    .filter((t) => t.amount < 0 && Date.now() - new Date(t.created_at).getTime() < 30 * 864e5)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const unlimited = isMaxPlan(ent.plan);
  const usedPct = ent.monthly_allowance > 0
    ? Math.min(100, Math.round(((ent.monthly_allowance - ent.credits_monthly) / ent.monthly_allowance) * 100))
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" /> Meus créditos
            </h3>
            <span className="text-xs text-muted-foreground">
              Plano: <span className="font-medium text-foreground">{PLAN_LABELS[ent.plan] ?? ent.plan}</span>
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Disponível agora</div>
              <div className="text-2xl font-bold text-primary">
                {unlimited ? "Ilimitado" : fmt(ent.credits_available)}
              </div>
              {!unlimited && <div className="text-[11px] text-muted-foreground">créditos</div>}
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Cota mensal
              </div>
              <div className="text-2xl font-bold">{fmt(ent.credits_monthly)}</div>
              <div className="text-[11px] text-muted-foreground">
                {ent.monthly_allowance > 0 ? `de ${fmt(ent.monthly_allowance)} por mês` : "sem cota mensal"}
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Gift className="h-3 w-3" /> Bônus permanente
              </div>
              <div className="text-2xl font-bold">{fmt(ent.credits_bonus)}</div>
              <div className="text-[11px] text-muted-foreground">consumido por último</div>
            </div>
          </div>

          {ent.monthly_allowance > 0 && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-primary transition-all" style={{ width: `${usedPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {usedPct}% da cota deste mês utilizada. A cota renova automaticamente todo mês
                {ent.subscription_renews_at && (
                  <> — assinatura ativa até {new Date(ent.subscription_renews_at).toLocaleDateString("pt-BR")}</>
                )}.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
            <span className="flex items-center gap-1 pt-3">
              <TrendingDown className="h-3 w-3" /> Consumidos nos últimos 30 dias:{" "}
              <span className="font-semibold text-foreground">{fmt(spent30d)}</span>
            </span>
            <span className="flex items-center gap-1 pt-3">
              <CalendarClock className="h-3 w-3" /> Ordem de consumo: cota mensal → bônus
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-display font-bold mb-3">Extrato</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação de créditos ainda.</p>
          ) : (
            <div className="divide-y divide-border">
              {txs.map((t) => {
                const meta = (t.metadata ?? {}) as { from_bonus?: number; from_monthly?: number };
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{TYPE_LABELS[t.type] ?? t.type}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                        {t.amount < 0 && (meta.from_monthly || meta.from_bonus) ? (
                          <> · mensal {fmt(meta.from_monthly ?? 0)} · bônus {fmt(meta.from_bonus ?? 0)}</>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-semibold ${t.amount < 0 ? "text-destructive" : "text-primary"}`}>
                        {t.amount > 0 ? "+" : ""}{fmt(t.amount)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        saldo {fmt(t.balance_monthly_after + t.balance_bonus_after)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
