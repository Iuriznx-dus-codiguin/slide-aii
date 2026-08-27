-- ══════════════════════════════════════════════════════════════
-- Sistema de créditos (substitui contagem de gerações)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles RENAME COLUMN single_credits TO credits_bonus;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_monthly integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_cycle_anchor date;

ALTER TABLE public.generation_logs
  ADD COLUMN IF NOT EXISTS credits_charged integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount integer NOT NULL,
  balance_bonus_after integer NOT NULL,
  balance_monthly_after integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credit transactions"
  ON public.credit_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Cota mensal por plano
CREATE OR REPLACE FUNCTION public.plan_monthly_credits(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _plan IN ('mensal','trimestral','anual') THEN 3200
    WHEN _plan IN ('max_mensal','max_trimestral','max_anual') THEN 16000
    ELSE 0
  END
$$;

-- Reset preguiçoso (persiste). Só chamado de dentro de quem debita/credita.
CREATE OR REPLACE FUNCTION public.ensure_monthly_credits(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _p public.profiles%ROWTYPE;
  _month date := date_trunc('month', now())::date;
  _alloc integer;
BEGIN
  SELECT * INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  _alloc := public.plan_monthly_credits(_p.plan);
  IF _alloc > 0 AND (_p.credits_cycle_anchor IS NULL OR _p.credits_cycle_anchor < _month) THEN
    UPDATE public.profiles
      SET credits_monthly = _alloc, credits_cycle_anchor = _month
      WHERE id = _uid;
    INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after)
    VALUES (_uid, 'monthly_reset', _alloc, COALESCE(_p.credits_bonus,0), _alloc);
  END IF;
END; $$;

-- Concessão de bônus permanente (compra avulsa / primeira ativação)
CREATE OR REPLACE FUNCTION public.grant_bonus_credits(_uid uuid, _amount integer, _type text DEFAULT 'bonus_grant')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _b integer; _m integer;
BEGIN
  UPDATE public.profiles
    SET credits_bonus = COALESCE(credits_bonus,0) + _amount
    WHERE id = _uid
    RETURNING credits_bonus, credits_monthly INTO _b, _m;
  IF _b IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after)
  VALUES (_uid, _type, _amount, _b, COALESCE(_m,0));
  RETURN _b;
END; $$;

-- Redefinição explícita da cota mensal (ativação/renovação de assinatura)
CREATE OR REPLACE FUNCTION public.set_monthly_credits(_uid uuid, _amount integer, _type text DEFAULT 'monthly_grant')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _b integer; _m integer;
BEGIN
  UPDATE public.profiles
    SET credits_monthly = _amount, credits_cycle_anchor = date_trunc('month', now())::date
    WHERE id = _uid
    RETURNING credits_bonus, credits_monthly INTO _b, _m;
  IF _m IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after)
  VALUES (_uid, _type, _amount, COALESCE(_b,0), _m);
  RETURN _m;
END; $$;

-- Débito atômico: bônus primeiro, depois mensal. Nunca revertido.
CREATE OR REPLACE FUNCTION public.consume_credits(_uid uuid, _credits_cost integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _p public.profiles%ROWTYPE;
  _from_bonus integer; _from_monthly integer;
BEGIN
  IF _credits_cost IS NULL OR _credits_cost <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'charged', 0);
  END IF;
  PERFORM public.ensure_monthly_credits(_uid);
  SELECT * INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_profile'); END IF;

  IF COALESCE(_p.credits_bonus,0) + COALESCE(_p.credits_monthly,0) < _credits_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_credits',
      'available', COALESCE(_p.credits_bonus,0) + COALESCE(_p.credits_monthly,0), 'required', _credits_cost);
  END IF;

  _from_bonus := LEAST(COALESCE(_p.credits_bonus,0), _credits_cost);
  _from_monthly := _credits_cost - _from_bonus;

  UPDATE public.profiles
    SET credits_bonus = COALESCE(credits_bonus,0) - _from_bonus,
        credits_monthly = COALESCE(credits_monthly,0) - _from_monthly
    WHERE id = _uid
    RETURNING credits_bonus, credits_monthly INTO _p.credits_bonus, _p.credits_monthly;

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
  VALUES (_uid, 'consume', -_credits_cost, _p.credits_bonus, _p.credits_monthly,
          jsonb_build_object('from_bonus', _from_bonus, 'from_monthly', _from_monthly));

  RETURN jsonb_build_object('ok', true, 'charged', _credits_cost,
    'balance_bonus', _p.credits_bonus, 'balance_monthly', _p.credits_monthly);
END; $$;

-- Elegibilidade por saldo (STABLE, não persiste nada)
DROP FUNCTION IF EXISTS public.can_user_generate(uuid);
CREATE OR REPLACE FUNCTION public.can_user_generate(_uid uuid, _credits_cost integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _profile public.profiles%ROWTYPE;
  _is_dev boolean;
  _is_sub boolean;
  _month date := date_trunc('month', now())::date;
  _monthly integer;
  _available integer;
BEGIN
  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  _is_dev := public.has_role(_uid, 'developer'::app_role) OR public.has_role(_uid, 'admin'::app_role);
  IF _is_dev THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'dev', 'plan', 'dev');
  END IF;

  _is_sub := _profile.plan IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual');

  IF _is_sub AND _profile.subscription_status = 'canceled' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_canceled', 'plan', _profile.plan);
  END IF;

  IF _is_sub AND _profile.subscription_renews_at IS NOT NULL
     AND _profile.subscription_renews_at < now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_expired', 'plan', _profile.plan,
      'expired_at', _profile.subscription_renews_at);
  END IF;

  IF _is_sub AND _profile.subscription_status IS NOT NULL
     AND _profile.subscription_status NOT IN ('active','trialing') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_expired', 'plan', _profile.plan);
  END IF;

  -- Saldo mensal efetivo (reset preguiçoso calculado, não persistido)
  IF _is_sub AND (_profile.credits_cycle_anchor IS NULL OR _profile.credits_cycle_anchor < _month) THEN
    _monthly := public.plan_monthly_credits(_profile.plan);
  ELSE
    _monthly := COALESCE(_profile.credits_monthly, 0);
  END IF;
  _available := COALESCE(_profile.credits_bonus, 0) + _monthly;

  IF _profile.plan = 'single' THEN
    IF _available >= COALESCE(_credits_cost, 0) THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'single',
        'credits', _available, 'credits_bonus', COALESCE(_profile.credits_bonus,0), 'credits_monthly', _monthly);
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits', 'plan', _profile.plan,
      'credits', _available, 'required', _credits_cost);
  END IF;

  IF _profile.plan IN ('mensal','trimestral','anual') THEN
    IF _available >= COALESCE(_credits_cost, 0) THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'plan', _profile.plan,
        'credits', _available, 'credits_bonus', COALESCE(_profile.credits_bonus,0), 'credits_monthly', _monthly);
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits', 'plan', _profile.plan,
      'credits', _available, 'required', _credits_cost);
  END IF;

  IF _profile.plan IN ('max_mensal','max_trimestral','max_anual') THEN
    IF _available >= COALESCE(_credits_cost, 0) THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'plan', _profile.plan,
        'credits', _available, 'credits_bonus', COALESCE(_profile.credits_bonus,0), 'credits_monthly', _monthly);
    END IF;
    -- MAX esconde o teto atrás de erro genérico
    RETURN jsonb_build_object('allowed', false, 'reason', 'system_error', 'plan', _profile.plan);
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'no_plan', 'plan', COALESCE(_profile.plan, 'free'),
    'credits', _available);
END; $$;

DROP FUNCTION IF EXISTS public.consume_single_credit(uuid);
DROP FUNCTION IF EXISTS public.grant_single_credit(uuid);

-- Protege as novas colunas de crédito contra escrita direta do usuário
CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
       OR NEW.subscription_period_start IS DISTINCT FROM OLD.subscription_period_start
       OR NEW.subscription_renews_at IS DISTINCT FROM OLD.subscription_renews_at
       OR NEW.credits_bonus IS DISTINCT FROM OLD.credits_bonus
       OR NEW.credits_monthly IS DISTINCT FROM OLD.credits_monthly
       OR NEW.credits_cycle_anchor IS DISTINCT FROM OLD.credits_cycle_anchor
       OR NEW.cakto_customer_id IS DISTINCT FROM OLD.cakto_customer_id
       OR NEW.cakto_subscription_id IS DISTINCT FROM OLD.cakto_subscription_id
    THEN
      RAISE EXCEPTION 'Campos de faturamento não podem ser alterados diretamente pelo usuário.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.ensure_monthly_credits(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_credits(uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_bonus_credits(uuid, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_monthly_credits(uuid, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_user_generate(uuid, integer) FROM anon;