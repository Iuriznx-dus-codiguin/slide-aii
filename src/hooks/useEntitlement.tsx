import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";

export interface Entitlement {
  allowed: boolean;
  reason: "dev" | "single" | "subscription" | "no_plan" | "system_error" | "loading";
  plan: "free" | "single" | "mensal" | "anual" | "dev";
  single_credits: number;
  used_this_month: number;
  monthly_limit: number;
  subscription_renews_at: string | null;
  subscription_status: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const MONTHLY_LIMIT = 20;

export const useEntitlement = (): Entitlement => {
  const { user } = useAuth();
  const { isDeveloper } = useDeveloperRole();
  const [state, setState] = useState<Omit<Entitlement, "refresh">>({
    allowed: false, reason: "loading", plan: "free", single_credits: 0,
    used_this_month: 0, monthly_limit: MONTHLY_LIMIT,
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

    let allowed = false;
    let reason: Entitlement["reason"] = "no_plan";
    if (isDeveloper) { allowed = true; reason = "dev"; }
    else if (plan === "single" && single > 0) { allowed = true; reason = "single"; }
    else if ((plan === "mensal" || plan === "anual") && used < MONTHLY_LIMIT) { allowed = true; reason = "subscription"; }
    else if (plan === "mensal" || plan === "anual") { allowed = false; reason = "system_error"; }

    setState({
      allowed, reason,
      plan: isDeveloper ? "dev" : plan,
      single_credits: single,
      used_this_month: used,
      monthly_limit: MONTHLY_LIMIT,
      subscription_renews_at: (profile as any)?.subscription_renews_at ?? null,
      subscription_status: (profile as any)?.subscription_status ?? null,
      loading: false,
    });
  }, [user, isDeveloper]);

  useEffect(() => { compute(); }, [compute]);

  return { ...state, refresh: compute };
};
