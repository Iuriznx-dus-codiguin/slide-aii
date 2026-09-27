import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { decideEntitlement, nextMonthlyReset, type EntitlementReason } from "@/lib/entitlement";

export interface Entitlement {
  allowed: boolean;
  reason: EntitlementReason;
  plan:
    | "free" | "single"
    | "mensal" | "trimestral" | "anual"
    | "max_mensal" | "max_trimestral" | "max_anual"
    | "dev";
  /** Créditos permanentes (avulsos + bônus de ativação) — nunca expiram. */
  credits_bonus: number;
  /** Cota mensal utilizável agora (0 quando a assinatura não está vigente). */
  credits_monthly: number;
  /** Soma disponível agora. */
  credits_available: number;
  /** Cota mensal do plano (0 para avulso/free). */
  monthly_allowance: number;
  /** Assinatura PRO/MAX dentro do período pago (ativa ou cancelada até o fim). */
  subscription_current: boolean;
  /** Plano MAX vigente (uso ilimitado dentro da Política de Uso Justo). */
  unlimited: boolean;
  /** Assinatura cancelada que segue ativa até esta data (ISO). */
  access_until: string | null;
  /** Data (dd/mm/aaaa) da próxima renovação da cota mensal. */
  next_monthly_reset: string | null;
  subscription_renews_at: string | null;
  subscription_status: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/** `true` quando o bloqueio se resolve reativando/renovando a assinatura. */
export const needsRenewal = (reason: Entitlement["reason"]): boolean =>
  reason === "subscription_canceled" || reason === "subscription_expired";

/** Mensagem amigável por `ent.reason`. `resetDate` completa o aviso de uso justo. */
export const reasonMessage = (reason: Entitlement["reason"], resetDate?: string | null): string => {
  switch (reason) {
    case "insufficient_credits":
      return "Seus créditos acabaram. A cota mensal renova um mês depois da última renovação — ou adquira uma geração avulsa.";
    case "fair_use_limit":
      return `Você atingiu o limite da Política de Uso Justo do plano MAX neste ciclo (16.000 créditos). A cota renova ${resetDate ? `em ${resetDate}` : "um mês depois da última renovação"} — até lá, você pode usar créditos avulsos.`;
    case "system_error":
      return "Não foi possível verificar seu saldo agora. Tente novamente em alguns minutos.";
    case "subscription_canceled":
      return "Sua assinatura foi cancelada e o período pago terminou. Reative um plano ou use créditos avulsos para voltar a gerar — suas apresentações continuam salvas.";
    case "subscription_expired":
      return "Sua assinatura venceu e as gerações estão pausadas. Renove o plano ou use créditos avulsos para voltar a gerar — suas apresentações continuam salvas.";
    case "no_plan":
      return "Escolha um plano para gerar apresentações.";
    default:
      return "";
  }
};


export const useEntitlement = (): Entitlement => {
  const { user } = useAuth();
  const { isDeveloper } = useDeveloperRole();
  const [state, setState] = useState<Omit<Entitlement, "refresh">>({
    allowed: false, reason: "loading", plan: "free",
    credits_bonus: 0, credits_monthly: 0, credits_available: 0, monthly_allowance: 0,
    subscription_current: false, unlimited: false, access_until: null, next_monthly_reset: null,
    subscription_renews_at: null, subscription_status: null, loading: true,
  });

  const compute = useCallback(async () => {
    if (!user) {
      setState((s) => ({ ...s, loading: false, allowed: false, reason: "no_plan" }));
      return;
    }
    const { data: profile } = await supabase.from("profiles")
      .select("plan, credits_bonus, credits_monthly, credits_cycle_anchor, subscription_renews_at, subscription_status")
      .eq("id", user.id).maybeSingle();

    const plan = (profile?.plan ?? "free") as Entitlement["plan"];
    // Mesma regra do banco (can_user_generate). Custo 1 = "tem algum saldo
    // para gerar"; o custo exato da configuração é checado no formulário e,
    // de novo, no servidor antes de cobrar.
    const d = decideEntitlement(profile, { cost: 1, isDeveloper });

    setState({
      allowed: d.allowed,
      reason: d.reason,
      plan: isDeveloper ? "dev" : plan,
      credits_bonus: d.credits_bonus,
      credits_monthly: d.credits_monthly,
      credits_available: d.credits_available,
      monthly_allowance: d.monthly_allowance,
      subscription_current: d.subscription_current,
      unlimited: d.unlimited,
      access_until: d.access_until,
      next_monthly_reset: nextMonthlyReset(profile?.credits_cycle_anchor ?? null),
      subscription_renews_at: profile?.subscription_renews_at ?? null,
      subscription_status: profile?.subscription_status ?? null,
      loading: false,
    });
  }, [user, isDeveloper]);

  useEffect(() => { compute(); }, [compute]);

// Tempo real: quando o webhook da Cakto credita/atualiza o plano, o saldo
  // muda na tela sem refresh nem polling.
  const computeRef = useRef(compute);
  useEffect(() => { computeRef.current = compute; }, [compute]);

  useEffect(() => {
    if (!user) return;
    // Tópico único por montagem: reaproveitar o mesmo nome faz o Supabase
    // devolver um canal já inscrito e lançar "cannot add callbacks after subscribe".
    const topic = `entitlement:${user.id}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => { computeRef.current(); },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "credit_transactions", filter: `user_id=eq.${user.id}` },
        () => { computeRef.current(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Também recalcula ao voltar para a aba (após pagar em outra janela).
  useEffect(() => {
    const onFocus = () => { compute(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [compute]);

  return { ...state, refresh: compute };
};
