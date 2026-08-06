import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { PLAN_MONTHLY_LIMITS, isProPlan, isMaxPlan } from "@/lib/cakto";

export interface Entitlement {
  allowed: boolean;
  reason:
    | "dev" | "single" | "subscription"
    | "no_plan" | "system_error" | "monthly_limit_reached"
    | "subscription_canceled" | "subscription_expired" | "loading";
  plan:
    | "free" | "single"
    | "mensal" | "trimestral" | "anual"
    | "max_mensal" | "max_trimestral" | "max_anual"
    | "dev";
  single_credits: number;
  used_this_month: number;
  monthly_limit: number;
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
    case "monthly_limit_reached":
      return "Você atingiu o limite deste mês. O limite renova no início do próximo período.";
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
    allowed: false, reason: "loading", plan: "free", single_credits: 0,
    used_this_month: 0, monthly_limit: 20,
    subscription_renews_at: null, subscription_status: null, loading: true,
  });

  const compute = useCallback(async () => {
    if (!user) {
      setState((s) => ({ ...s, loading: false, allowed: false, reason: "no_plan" }));
      return;
    }
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles")
        .select("plan, single_credits, subscription_renews_at, subscription_status")
        .eq("id", user.id).maybeSingle(),
      supabase.from("generation_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("status", "success")
        // UTC de propósito: o servidor (can_user_generate) usa
        // date_trunc('month', now()) em UTC. Calcular o início do mês em
        // horário local fazia a tela mostrar uma cota diferente da aplicada
        // na cobrança nos primeiros/últimos dias do mês.
        .gte("created_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()),
    ]);

    const plan = (profile?.plan ?? "free") as Entitlement["plan"];
    const single = (profile as any)?.single_credits ?? 0;
    const used = count ?? 0;
    const limit = PLAN_MONTHLY_LIMITS[plan] ?? 20;

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
    else if (plan === "single" && single > 0) { allowed = true; reason = "single"; }
    else if (isProPlan(plan) && used < limit) { allowed = true; reason = "subscription"; }
    else if (isMaxPlan(plan) && used < limit) { allowed = true; reason = "subscription"; }
    else if (isProPlan(plan)) { allowed = false; reason = "monthly_limit_reached"; }
    else if (isMaxPlan(plan)) { allowed = false; reason = "system_error"; }


    setState({
      allowed, reason,
      plan: isDeveloper ? "dev" : plan,
      single_credits: single,
      used_this_month: used,
      monthly_limit: limit,
      subscription_renews_at: (profile as any)?.subscription_renews_at ?? null,
      subscription_status: subStatus,
      loading: false,
    });
  }, [user, isDeveloper]);

  useEffect(() => { compute(); }, [compute]);

  return { ...state, refresh: compute };
};
