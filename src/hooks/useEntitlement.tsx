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
    | "subscription_canceled" | "loading";
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

/** Mensagem amigável por `ent.reason`. */
export const reasonMessage = (reason: Entitlement["reason"]): string => {
  switch (reason) {
    case "monthly_limit_reached":
      return "Você atingiu o limite deste mês. O limite renova no início do próximo período.";
    case "system_error":
      return "Erro interno do sistema (E_GEN_503). Tente novamente em alguns minutos.";
    case "subscription_canceled":
      return "Sua assinatura foi cancelada. Reative um plano para voltar a gerar apresentações — todas as suas apresentações continuam salvas na sua conta.";
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
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    const plan = (profile?.plan ?? "free") as Entitlement["plan"];
    const single = (profile as any)?.single_credits ?? 0;
    const used = count ?? 0;
    const limit = PLAN_MONTHLY_LIMITS[plan] ?? 20;

    let allowed = false;
    let reason: Entitlement["reason"] = "no_plan";
    if (isDeveloper) { allowed = true; reason = "dev"; }
    else if (plan === "single" && single > 0) { allowed = true; reason = "single"; }
    else if (isProPlan(plan) && used < limit) { allowed = true; reason = "subscription"; }
    else if (isMaxPlan(plan) && used < limit) { allowed = true; reason = "subscription"; }
    else if (isProPlan(plan)) { allowed = false; reason = "monthly_limit_reached"; }
    // Para MAX, quando o teto oculto (100) é atingido, retornamos "system_error"
    // (mensagem genérica) para não revelar que existe um limite — assinantes
    // legítimos raramente encostam nesse número.
    else if (isMaxPlan(plan)) { allowed = false; reason = "system_error"; }

    setState({
      allowed, reason,
      plan: isDeveloper ? "dev" : plan,
      single_credits: single,
      used_this_month: used,
      monthly_limit: limit,
      subscription_renews_at: (profile as any)?.subscription_renews_at ?? null,
      subscription_status: (profile as any)?.subscription_status ?? null,
      loading: false,
    });
  }, [user, isDeveloper]);

  useEffect(() => { compute(); }, [compute]);

  return { ...state, refresh: compute };
};
