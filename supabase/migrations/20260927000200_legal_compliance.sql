-- Conformidade legal: Termos de Uso, LGPD e Marco Civil da Internet.
--
-- 1. Acesso por período pago (CDC — a oferta publicada vincula):
--    • assinatura cancelada continua valendo até o fim do período pago
--      (antes bloqueava na hora, contra o que o site promete);
--    • o bônus é permanente: continua utilizável depois que a assinatura
--      termina (antes ficava preso até uma nova compra);
--    • MAX que atinge o teto do uso justo recebe `fair_use_limit`, e não mais
--      um `system_error` que virava "erro interno" na tela.
-- 2. Registro de aceite dos Termos e da Política (prova da contratação).
-- 3. Registros de acesso — IP, data e hora — guardados por 6 meses
--    (Marco Civil da Internet, art. 15).
-- 4. Eliminação automática por prazo de retenção (LGPD, arts. 15 e 16),
--    conforme a tabela da Política de Privacidade.
--
-- Idempotente: pode ser aplicada de novo sem efeito colateral.

-- ─────────────────────────────── 1. Acesso ───────────────────────────────

-- Assinatura que ainda dá direito à cota do plano. Espelho em TypeScript:
-- isSubscriptionCurrent (src/lib/entitlement.ts).
CREATE OR REPLACE FUNCTION public.subscription_is_current(_plan text, _status text, _renews_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(_plan, '') IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual')
     AND (
       (COALESCE(_status, 'active') IN ('active','trialing') AND (_renews_at IS NULL OR _renews_at > now()))
       OR (_status = 'canceled' AND _renews_at IS NOT NULL AND _renews_at > now())
     );
$$;

-- Espelho em TypeScript: decideEntitlement (src/lib/entitlement.ts).
CREATE OR REPLACE FUNCTION public.can_user_generate(_uid uuid, _credits_cost integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _profile public.profiles%ROWTYPE;
  _is_dev boolean;
  _is_sub boolean;
  _current boolean;
  _cost integer := GREATEST(COALESCE(_credits_cost, 0), 0);
  _bonus integer;
  _monthly integer;
  _available integer;
BEGIN
  -- Clientes só consultam a própria conta; o service_role informa o _uid.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'no_plan', 'plan', 'free');
    END IF;
    _uid := auth.uid();
  END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  _is_dev := public.has_role(_uid, 'developer'::app_role) OR public.has_role(_uid, 'admin'::app_role);
  IF _is_dev THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'dev', 'plan', 'dev');
  END IF;

  _is_sub := COALESCE(_profile.plan IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual'), false);
  _current := public.subscription_is_current(_profile.plan, _profile.subscription_status, _profile.subscription_renews_at);
  _bonus := GREATEST(COALESCE(_profile.credits_bonus, 0), 0);

  -- Assinatura vigente, inclusive cancelada dentro do período já pago.
  IF _is_sub AND _current THEN
    IF _profile.credits_cycle_anchor IS NULL OR _profile.credits_cycle_anchor + interval '1 month' <= now() THEN
      _monthly := public.plan_monthly_credits(_profile.plan);
    ELSE
      _monthly := GREATEST(COALESCE(_profile.credits_monthly, 0), 0);
    END IF;
    _available := _bonus + _monthly;

    IF _available >= _cost THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'plan', _profile.plan,
        'credits', _available, 'credits_bonus', _bonus, 'credits_monthly', _monthly,
        'access_until', CASE WHEN _profile.subscription_status = 'canceled' THEN _profile.subscription_renews_at END);
    END IF;
    IF _profile.plan IN ('max_mensal','max_trimestral','max_anual') THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'fair_use_limit', 'plan', _profile.plan,
        'credits', _available, 'required', _cost,
        'resets_at', _profile.credits_cycle_anchor + interval '1 month');
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits', 'plan', _profile.plan,
      'credits', _available, 'required', _cost);
  END IF;

  IF _profile.plan = 'single' THEN
    _monthly := GREATEST(COALESCE(_profile.credits_monthly, 0), 0);
    _available := _bonus + _monthly;
    IF _available >= _cost THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'single', 'plan', 'single',
        'credits', _available, 'credits_bonus', _bonus, 'credits_monthly', _monthly);
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits', 'plan', 'single',
      'credits', _available, 'required', _cost);
  END IF;

  -- Sem assinatura vigente: o bônus é permanente e continua valendo.
  IF _bonus > 0 AND _bonus >= _cost THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'bonus_only', 'plan', COALESCE(_profile.plan, 'free'),
      'credits', _bonus, 'credits_bonus', _bonus, 'credits_monthly', 0);
  END IF;

  IF _is_sub THEN
    IF _profile.subscription_status = 'canceled' THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_canceled', 'plan', _profile.plan,
        'credits', _bonus, 'required', _cost);
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_expired', 'plan', _profile.plan,
      'expired_at', _profile.subscription_renews_at, 'credits', _bonus, 'required', _cost);
  END IF;

  IF _bonus > 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits', 'plan', COALESCE(_profile.plan, 'free'),
      'credits', _bonus, 'required', _cost);
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'no_plan', 'plan', COALESCE(_profile.plan, 'free'),
    'credits', _bonus);
END; $function$;

-- Cota nova só para assinatura vigente. A cancelada continua recebendo a cota
-- mensal até o fim do período pago (inclusive nos planos trimestral e anual).
CREATE OR REPLACE FUNCTION public.ensure_monthly_credits(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.profiles%ROWTYPE;
  _alloc integer;
  _anchor date;
BEGIN
  SELECT * INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  _alloc := public.plan_monthly_credits(_p.plan);
  IF _alloc <= 0 THEN RETURN; END IF;
  IF NOT public.subscription_is_current(_p.plan, _p.subscription_status, _p.subscription_renews_at) THEN
    RETURN;
  END IF;
  IF _p.credits_cycle_anchor IS NOT NULL AND _p.credits_cycle_anchor + interval '1 month' > now() THEN
    RETURN;
  END IF;
  _anchor := COALESCE(_p.credits_cycle_anchor, current_date);
  WHILE _anchor + interval '1 month' <= now() LOOP
    _anchor := (_anchor + interval '1 month')::date;
  END LOOP;
  UPDATE public.profiles
     SET credits_monthly = _alloc, credits_cycle_anchor = _anchor
   WHERE id = _uid;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
  VALUES (_uid, 'monthly_reset', _alloc, COALESCE(_p.credits_bonus, 0), _alloc,
          jsonb_build_object('cycle_start', _anchor));
END;
$$;

-- Débito: cota mensal primeiro, bônus por último. Com a assinatura
-- encerrada, a sobra da cota mensal não vale mais — só o bônus.
CREATE OR REPLACE FUNCTION public.consume_credits(_uid uuid, _credits_cost integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.profiles%ROWTYPE;
  _usable_monthly integer;
  _from_bonus integer;
  _from_monthly integer;
BEGIN
  IF _credits_cost IS NULL OR _credits_cost <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'charged', 0);
  END IF;
  PERFORM public.ensure_monthly_credits(_uid);
  SELECT * INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_profile'); END IF;

  IF _p.plan IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual')
     AND NOT public.subscription_is_current(_p.plan, _p.subscription_status, _p.subscription_renews_at) THEN
    _usable_monthly := 0;
  ELSE
    _usable_monthly := GREATEST(COALESCE(_p.credits_monthly, 0), 0);
  END IF;

  IF COALESCE(_p.credits_bonus, 0) + _usable_monthly < _credits_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_credits',
      'available', COALESCE(_p.credits_bonus, 0) + _usable_monthly, 'required', _credits_cost);
  END IF;

  _from_monthly := LEAST(_usable_monthly, _credits_cost);
  _from_bonus := _credits_cost - _from_monthly;

  UPDATE public.profiles
    SET credits_bonus = GREATEST(COALESCE(credits_bonus, 0) - _from_bonus, 0),
        credits_monthly = GREATEST(COALESCE(credits_monthly, 0) - _from_monthly, 0)
    WHERE id = _uid
    RETURNING credits_bonus, credits_monthly INTO _p.credits_bonus, _p.credits_monthly;

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
  VALUES (_uid, 'consume', -_credits_cost, _p.credits_bonus, _p.credits_monthly,
          jsonb_build_object('from_bonus', _from_bonus, 'from_monthly', _from_monthly));

  RETURN jsonb_build_object('ok', true, 'charged', _credits_cost,
    'balance_bonus', _p.credits_bonus, 'balance_monthly', _p.credits_monthly);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_monthly_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_monthly_credits(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.can_user_generate(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_user_generate(uuid, integer) TO authenticated, service_role;

-- ──────────────────────── Dados da requisição (IP) ────────────────────────

-- IP e navegador de quem chama a API. No Supabase, `cf-connecting-ip` é o
-- cabeçalho confiável; os demais ficam como reserva.
CREATE OR REPLACE FUNCTION public.request_client_info()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _h json;
  _ip text;
BEGIN
  BEGIN
    _h := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    _h := NULL;
  END;
  IF _h IS NULL THEN
    RETURN jsonb_build_object('ip', NULL, 'user_agent', NULL);
  END IF;
  _ip := COALESCE(
    NULLIF(trim(_h->>'cf-connecting-ip'), ''),
    NULLIF(trim(_h->>'x-real-ip'), ''),
    NULLIF(trim(split_part(COALESCE(_h->>'x-forwarded-for', ''), ',', 1)), '')
  );
  RETURN jsonb_build_object('ip', left(_ip, 64), 'user_agent', left(_h->>'user-agent', 400));
END;
$$;

-- ─────────────────────── 2. Aceite dos Termos ───────────────────────

-- Sem chave estrangeira para auth.users: o registro precisa sobreviver à
-- exclusão da conta pelo prazo da Política de Privacidade (até 5 anos).
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  source text NOT NULL DEFAULT 'gate',
  ip text,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON public.legal_acceptances (user_id, accepted_at DESC);
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_acceptances_select_own ON public.legal_acceptances;
CREATE POLICY legal_acceptances_select_own ON public.legal_acceptances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.legal_acceptances FROM anon, authenticated;

-- Registra o aceite com data, hora, IP e navegador vindos do servidor (o
-- cliente não consegue forjar o horário nem o IP). Idempotente por versão.
CREATE OR REPLACE FUNCTION public.accept_legal_terms(_terms_version text, _privacy_version text, _source text DEFAULT 'gate')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _info jsonb;
  _row public.legal_acceptances%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(trim(_terms_version), '') = '' OR COALESCE(trim(_privacy_version), '') = '' THEN
    RAISE EXCEPTION 'Informe as versões aceitas.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _row FROM public.legal_acceptances
   WHERE user_id = _uid AND terms_version = _terms_version AND privacy_version = _privacy_version
   ORDER BY accepted_at DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'accepted_at', _row.accepted_at);
  END IF;

  _info := public.request_client_info();
  INSERT INTO public.legal_acceptances(user_id, terms_version, privacy_version, source, ip, user_agent)
  VALUES (
    _uid,
    left(_terms_version, 40),
    left(_privacy_version, 40),
    CASE WHEN _source IN ('signup', 'gate', 'checkout') THEN _source ELSE 'gate' END,
    _info->>'ip',
    _info->>'user_agent'
  )
  RETURNING * INTO _row;
  RETURN jsonb_build_object('ok', true, 'already', false, 'accepted_at', _row.accepted_at);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_legal_terms(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_legal_terms(text, text, text) TO authenticated, service_role;

-- ──────────────── 3. Registros de acesso (Marco Civil) ────────────────

CREATE TABLE IF NOT EXISTS public.access_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  ip text,
  user_agent text,
  event text NOT NULL DEFAULT 'session',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_created ON public.access_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.access_logs (created_at);
-- Sigilo: sem políticas de RLS, ninguém lê pela API; só o service_role e as
-- funções abaixo. Entregue apenas mediante ordem judicial (Marco Civil, art. 15, § 3º)
-- ou ao próprio titular que pedir acesso (LGPD, art. 18).
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_logs FROM anon, authenticated;

-- ────────────────────── 4. Retenção automática ──────────────────────

CREATE TABLE IF NOT EXISTS public.maintenance_runs (
  task text PRIMARY KEY,
  last_run_at timestamptz NOT NULL,
  last_result jsonb
);
ALTER TABLE public.maintenance_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maintenance_runs FROM anon, authenticated;

-- Prazos da Política de Privacidade, seção 7. Altere os dois juntos.
CREATE OR REPLACE FUNCTION public.purge_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _access integer;
  _views integer;
  _security integer;
  _errors integer;
  _generation integer;
  _rate integer;
  _payments integer;
  _acceptances integer;
BEGIN
  DELETE FROM public.access_logs WHERE created_at < now() - interval '6 months';
  GET DIAGNOSTICS _access = ROW_COUNT;
  -- O contador de visualizações fica em presentations.view_count.
  DELETE FROM public.slide_views WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _views = ROW_COUNT;
  DELETE FROM public.security_events WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _security = ROW_COUNT;
  DELETE FROM public.error_occurrences WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _errors = ROW_COUNT;
  DELETE FROM public.generation_logs WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _generation = ROW_COUNT;
  DELETE FROM public.edge_rate_limits WHERE window_start < now() - interval '2 days';
  GET DIAGNOSTICS _rate = ROW_COUNT;
  DELETE FROM public.payment_events WHERE created_at < now() - interval '5 years';
  GET DIAGNOSTICS _payments = ROW_COUNT;
  DELETE FROM public.legal_acceptances la
   WHERE la.accepted_at < now() - interval '5 years'
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = la.user_id);
  GET DIAGNOSTICS _acceptances = ROW_COUNT;

  RETURN jsonb_build_object(
    'access_logs', _access, 'slide_views', _views, 'security_events', _security,
    'error_occurrences', _errors, 'generation_logs', _generation, 'edge_rate_limits', _rate,
    'payment_events', _payments, 'legal_acceptances', _acceptances
  );
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_data() TO service_role;

-- No máximo uma vez por dia e nunca em paralelo. Roda a reboque do registro
-- de acesso (não depende de pg_cron); se um agendador for configurado, basta
-- chamá-la diariamente.
CREATE OR REPLACE FUNCTION public.run_data_retention_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _last timestamptz;
  _result jsonb;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('slideai:data-retention')) THEN
    RETURN;
  END IF;
  SELECT last_run_at INTO _last FROM public.maintenance_runs WHERE task = 'data_retention';
  IF _last IS NOT NULL AND _last > now() - interval '1 day' THEN
    RETURN;
  END IF;
  _result := public.purge_expired_data();
  INSERT INTO public.maintenance_runs(task, last_run_at, last_result)
  VALUES ('data_retention', now(), _result)
  ON CONFLICT (task) DO UPDATE SET last_run_at = EXCLUDED.last_run_at, last_result = EXCLUDED.last_result;
END;
$$;
REVOKE ALL ON FUNCTION public.run_data_retention_if_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_data_retention_if_due() TO service_role;

-- Registro de acesso do usuário logado: um por conta, IP e meia hora.
CREATE OR REPLACE FUNCTION public.record_access(_event text DEFAULT 'session')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _info jsonb;
  _ip text;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;
  _info := public.request_client_info();
  _ip := _info->>'ip';
  IF NOT EXISTS (
    SELECT 1 FROM public.access_logs
     WHERE user_id = _uid
       AND ip IS NOT DISTINCT FROM _ip
       AND created_at > now() - interval '30 minutes'
  ) THEN
    INSERT INTO public.access_logs(user_id, ip, user_agent, event)
    VALUES (_uid, _ip, _info->>'user_agent', left(COALESCE(NULLIF(trim(_event), ''), 'session'), 40));
  END IF;
  PERFORM public.run_data_retention_if_due();
END;
$$;
REVOKE ALL ON FUNCTION public.record_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_access(text) TO authenticated, service_role;
