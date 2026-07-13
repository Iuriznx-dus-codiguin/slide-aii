-- 1) Trigger de proteção de campos de faturamento
CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
       OR NEW.subscription_period_start IS DISTINCT FROM OLD.subscription_period_start
       OR NEW.subscription_renews_at IS DISTINCT FROM OLD.subscription_renews_at
       OR NEW.single_credits IS DISTINCT FROM OLD.single_credits
       OR NEW.cakto_customer_id IS DISTINCT FROM OLD.cakto_customer_id
       OR NEW.cakto_subscription_id IS DISTINCT FROM OLD.cakto_subscription_id
    THEN
      RAISE EXCEPTION 'Campos de faturamento não podem ser alterados diretamente pelo usuário.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_billing_columns ON public.profiles;
CREATE TRIGGER trg_protect_billing_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_billing_columns();

-- 2) Leitura administrativa de profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

-- 3) Remove INSERT do client em generation_logs
DROP POLICY IF EXISTS "logs_owner_insert" ON public.generation_logs;

-- 4) Idempotência de payment_events
DROP INDEX IF EXISTS idx_payment_events_cakto_id_unique;
CREATE UNIQUE INDEX idx_payment_events_cakto_id_unique
  ON public.payment_events (cakto_id)
  WHERE cakto_id IS NOT NULL;

-- 5) Concessão atômica de crédito avulso
CREATE OR REPLACE FUNCTION public.grant_single_credit(_uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
BEGIN
  UPDATE public.profiles
    SET single_credits = COALESCE(single_credits, 0) + 1
    WHERE id = _uid
    RETURNING single_credits INTO _new_balance;
  RETURN _new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_single_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_single_credit(uuid) TO service_role;

-- 6) Incremento atômico do contador cosmético
CREATE OR REPLACE FUNCTION public.increment_own_generations_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_count integer;
BEGIN
  UPDATE public.profiles
    SET generations_count = COALESCE(generations_count, 0) + 1
    WHERE id = auth.uid()
    RETURNING generations_count INTO _new_count;
  RETURN _new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_own_generations_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_own_generations_count() TO authenticated;

-- 7) Rate limit reutilizável
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  rl_key text NOT NULL,
  fn_name text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (rl_key, fn_name, window_start)
);
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(_key text, _fn text, _max_per_hour integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window timestamptz := date_trunc('hour', now());
  _count integer;
BEGIN
  INSERT INTO public.edge_rate_limits (rl_key, fn_name, window_start, request_count)
  VALUES (_key, _fn, _window, 1)
  ON CONFLICT (rl_key, fn_name, window_start)
  DO UPDATE SET request_count = public.edge_rate_limits.request_count + 1
  RETURNING request_count INTO _count;

  IF random() < 0.01 THEN
    DELETE FROM public.edge_rate_limits WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN _count <= _max_per_hour;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer) TO service_role;