import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { PLAN_MONTHLY_CREDITS, isProPlan, isMaxPlan } from "@/lib/cakto";

export interface Entitlement {
  allowed: boolean;
  reason:
    | "dev" | "single" | "subscription"
    | "no_plan" | "system_error" | "insufficient_credits"
    | "subscription_canceled" | "subscription_expired" | "loading";
  plan:
    | "free" | "single"
    | "mensal" | "trimestral" | "anual"
    | "max_mensal" | "max_trimestral" | "max_anual"
    | "dev";
  /** Créditos permanentes (comprados/bônus) — consumidos primeiro. */
  credits_bonus: number;
  /** Créditos mensais renováveis do plano. */
  credits_monthly: number;
  /** Soma disponível agora. */
  credits_available: number;
  /** Cota mensal do plano (0 para avulso/free). */
  monthly_allowance: number;
  subscription_renews_at: string | null;
  subscription_status: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/** `true` quando o bloqueio se resolve reativando/renovando a assinatura. */
export const needsRenewal = (reason: Entitlement["reason"]): boolean =>
  reason === "subscription_canceled" || reason === "subscription_expired";

/** Mensagem amigável por `ent.reason`. */
export const reasonMessage = (reason: Entitlement["reason"]): string => {
  switch (reason) {
    case "insufficient_credits":
      return "Seus créditos acabaram. A cota mensal renova no início do próximo mês — ou adquira uma geração avulsa.";
    case "system_error":
      return "Erro interno do sistema (E_GEN_503). Tente novamente em alguns minutos.";
    case "subscription_canceled":
      return "Sua assinatura foi cancelada. Reative um plano para voltar a gerar apresentações — todas as suas apresentações continuam salvas na sua conta.";
    case "subscription_expired":
      return "Sua assinatura expirou e as gerações estão pausadas. Renove o plano para voltar a gerar — suas apresentações continuam salvas.";
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
    const bonus = (profile as any)?.credits_bonus ?? 0;
    const allowance = PLAN_MONTHLY_CREDITS[plan] ?? 0;
    // Reset preguiçoso: o banco só persiste a redefinição no próximo débito,
    // então a UI calcula o saldo mensal efetivo do mês corrente (UTC), igual
    // ao que can_user_generate devolve.
    const anchor = (profile as any)?.credits_cycle_anchor as string | null;
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
      .toISOString().slice(0, 10);
    const monthly = allowance > 0 && (!anchor || anchor < monthStart)
      ? allowance
      : ((profile as any)?.credits_monthly ?? 0);
    const available = bonus + monthly;

    const subStatus = (profile as any)?.subscription_status ?? null;
    const renewsAt = (profile as any)?.subscription_renews_at ?? null;
    const isSubPlan = isProPlan(plan) || isMaxPlan(plan);
    const canceled = subStatus === "canceled";
    const expired = isSubPlan && (
      (renewsAt ? new Date(renewsAt).getTime() < Date.now() : false)
      || (subStatus != null && !["active", "trialing"].includes(subStatus) && !canceled)
    );

    let allowed = false;
    let reason: Entitlement["reason"] = "no_plan";
    if (isDeveloper) { allowed = true; reason = "dev"; }
    else if (canceled && isSubPlan) {
      // Cancelamento: bloqueia imediatamente e mostra "como renovar".
      allowed = false; reason = "subscription_canceled";
    }
    else if (expired) { allowed = false; reason = "subscription_expired"; }
    else if (plan === "single" && available > 0) { allowed = true; reason = "single"; }
    else if ((isProPlan(plan) || isMaxPlan(plan)) && available > 0) { allowed = true; reason = "subscription"; }
    else if (isProPlan(plan) || plan === "single") { allowed = false; reason = "insufficient_credits"; }
    else if (isMaxPlan(plan)) { allowed = false; reason = "system_error"; }


    setState({
      allowed, reason,
      plan: isDeveloper ? "dev" : plan,
      credits_bonus: bonus,
      credits_monthly: monthly,
      credits_available: available,
      monthly_allowance: allowance,
      subscription_renews_at: (profile as any)?.subscription_renews_at ?? null,
      subscription_status: subStatus,
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
