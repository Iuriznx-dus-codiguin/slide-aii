import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { EntitlementContext, type Entitlement, type EntitlementState } from "@/hooks/useEntitlement";
import { decideEntitlement, nextMonthlyReset } from "@/lib/entitlement";

const INITIAL_STATE: EntitlementState = {
  allowed: false, reason: "loading", plan: "free",
  credits_bonus: 0, credits_monthly: 0, credits_available: 0, monthly_allowance: 0,
  subscription_current: false, unlimited: false, access_until: null, next_monthly_reset: null,
  subscription_renews_at: null, subscription_status: null, loading: true,
};

/**
 * Um único estado de acesso para o app inteiro: antes cada componente que
 * usava o hook abria o próprio canal Realtime e repetia as consultas (até
 * quatro de cada na tela de geração).
 */
export const EntitlementProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isDeveloper } = useDeveloperRole();
  const [state, setState] = useState<EntitlementState>(INITIAL_STATE);

  const compute = useCallback(async (): Promise<EntitlementState> => {
    if (!user) {
      const next: EntitlementState = { ...INITIAL_STATE, loading: false, reason: "no_plan" };
      setState(next);
      return next;
    }
    const { data: profile } = await supabase.from("profiles")
      .select("plan, credits_bonus, credits_monthly, credits_cycle_anchor, subscription_renews_at, subscription_status")
      .eq("id", user.id).maybeSingle();

    const plan = (profile?.plan ?? "free") as Entitlement["plan"];
    // Mesma regra do banco (can_user_generate). Custo 1 = "tem algum saldo
    // para gerar"; o custo exato da configuração é checado no formulário e,
    // de novo, no servidor antes de cobrar.
    const d = decideEntitlement(profile, { cost: 1, isDeveloper });

    const next: EntitlementState = {
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
    };
    setState(next);
    return next;
  }, [user, isDeveloper]);

  // Enquanto a sessão carrega, fica em "loading" (sem piscar "escolha um plano").
  useEffect(() => { if (!authLoading) compute(); }, [compute, authLoading]);

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
    const onFocus = () => { if (document.visibilityState !== "hidden") computeRef.current(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return (
    <EntitlementContext.Provider value={{ ...state, refresh: compute } satisfies Entitlement}>
      {children}
    </EntitlementContext.Provider>
  );
};

