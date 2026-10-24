-- Tabela de planos de 10/2026 (src/lib/cakto.ts, supabase/functions/_shared/plans.ts
-- e supabase/functions/cakto-webhook/lib.ts):
--   • PRO: 1.700 créditos por ciclo mensal (10 apresentações de 10 slides com falas);
--   • MAX: teto de uso justo de 8.500 por ciclo mensal (5x o PRO).
-- Assinaturas deixam de ter bônus de ativação: isso muda só o webhook
-- (grant_bonus_credits_once continua no banco para o histórico).
--
-- O teste src/test/plansParity.test.ts confere estes valores com os do código.
-- Idempotente.

CREATE OR REPLACE FUNCTION public.plan_monthly_credits(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _plan IN ('mensal','trimestral','anual') THEN 1700
    WHEN _plan IN ('max_mensal','max_trimestral','max_anual') THEN 8500
    ELSE 0
  END
$$;

-- Ainda não há assinantes pagantes na troca de tabela: contas internas ou de
-- teste com cota acima do novo teto passam ao valor novo, com registro no
-- extrato. Numa segunda execução nenhuma linha passa do teto.
WITH over_quota AS (
  SELECT id, credits_monthly AS monthly_before, public.plan_monthly_credits(plan) AS quota
    FROM public.profiles
   WHERE public.plan_monthly_credits(plan) > 0
     AND COALESCE(credits_monthly, 0) > public.plan_monthly_credits(plan)
     FOR UPDATE
), adjusted AS (
  UPDATE public.profiles p
     SET credits_monthly = o.quota
    FROM over_quota o
   WHERE p.id = o.id
  RETURNING p.id, p.credits_bonus, p.credits_monthly, o.monthly_before
)
INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
SELECT id, 'plan_quota_adjustment', credits_monthly - monthly_before, COALESCE(credits_bonus, 0), credits_monthly,
       jsonb_build_object('reason', 'plan_pricing_2026_10', 'monthly_before', monthly_before)
  FROM adjusted;
