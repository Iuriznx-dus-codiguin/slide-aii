-- Estorno automático de gerações interrompidas e fila de alertas operacionais.
--
-- 1) Toda geração cobrada vira uma TENTATIVA (generation_attempts) criada na
--    mesma transação do débito (charge_generation). A edge function marca o
--    desfecho (succeeded / failed). Se a função cair ou estourar o tempo, a
--    tentativa fica "running" e refund_stale_generations devolve os créditos
--    depois de 10 minutos (o limite de execução de uma edge function é bem
--    menor, então não há geração viva com essa idade).
-- 2) ops_alerts: fila de alertas para a equipe. Edge functions e rotinas SQL
--    inserem; as edge functions enviam por e-mail aos administradores e
--    marcam notified_at. dedupe_key evita repetir o mesmo alerta.
-- Idempotente.

-- ─────────────── Tentativas de geração ───────────────
CREATE TABLE IF NOT EXISTS public.generation_attempts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL CHECK (credits > 0),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS generation_attempts_running_idx
  ON public.generation_attempts (created_at) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS generation_attempts_user_idx
  ON public.generation_attempts (user_id, created_at DESC);
ALTER TABLE public.generation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generation_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.generation_attempts TO service_role;

-- Busca do log de sucesso por tentativa (usada só na varredura).
CREATE INDEX IF NOT EXISTS generation_logs_attempt_ref_idx
  ON public.generation_logs ((metadata->>'attempt_ref')) WHERE status = 'success';

-- ─────────────── Débito com referência ───────────────
-- Mesmo corpo de consume_credits (0003), com metadados extras no lançamento.
-- consume_credits continua existindo com a assinatura antiga.
CREATE OR REPLACE FUNCTION public.consume_credits_with_metadata(_uid uuid, _credits_cost integer, _extra jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
          COALESCE(_extra, '{}'::jsonb) || jsonb_build_object('from_bonus', _from_bonus, 'from_monthly', _from_monthly));

  RETURN jsonb_build_object('ok', true, 'charged', _credits_cost,
    'balance_bonus', _p.credits_bonus, 'balance_monthly', _p.credits_monthly);
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_credits(_uid uuid, _credits_cost integer)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.consume_credits_with_metadata(_uid, _credits_cost, '{}'::jsonb);
$function$;

-- Débito + tentativa na mesma transação: não existe cobrança sem tentativa.
CREATE OR REPLACE FUNCTION public.charge_generation(_uid uuid, _credits integer, _attempt uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _r jsonb;
BEGIN
  _r := public.consume_credits_with_metadata(
    _uid, _credits, jsonb_build_object('reference', _attempt::text, 'kind', 'generation'));
  IF COALESCE((_r->>'ok')::boolean, false) AND COALESCE((_r->>'charged')::integer, 0) > 0 THEN
    INSERT INTO public.generation_attempts(id, user_id, credits) VALUES (_attempt, _uid, _credits);
  END IF;
  RETURN _r;
END;
$function$;

-- ─────────────── Estorno: usa o débito da própria tentativa ───────────────
CREATE OR REPLACE FUNCTION public.refund_generation_credits(_uid uuid, _credits integer, _reference text, _reason text DEFAULT 'generation_failed'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p public.profiles%ROWTYPE;
  _last jsonb;
  _from_bonus integer;
  _from_monthly integer;
BEGIN
  IF _credits IS NULL OR _credits <= 0 THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'noop');
  END IF;

  SELECT * INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'no_profile');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE user_id = _uid
      AND type = 'generation_refund'
      AND metadata->>'reference' = _reference
  ) THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'already_refunded');
  END IF;

  -- O débito desta tentativa diz de onde os créditos saíram. Débitos antigos
  -- (sem referência) usam o último débito de mesmo valor, como antes.
  SELECT metadata INTO _last
  FROM public.credit_transactions
  WHERE user_id = _uid AND type = 'consume' AND metadata->>'reference' = _reference
  LIMIT 1;
  IF _last IS NULL THEN
    SELECT metadata INTO _last
    FROM public.credit_transactions
    WHERE user_id = _uid AND type = 'consume' AND amount = -_credits
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  _from_bonus := LEAST(COALESCE((_last->>'from_bonus')::integer, _credits), _credits);
  _from_monthly := _credits - _from_bonus;

  UPDATE public.profiles
    SET credits_bonus = COALESCE(credits_bonus, 0) + _from_bonus,
        credits_monthly = COALESCE(credits_monthly, 0) + _from_monthly
    WHERE id = _uid
    RETURNING credits_bonus, credits_monthly INTO _p.credits_bonus, _p.credits_monthly;

  INSERT INTO public.credit_transactions(
    user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata
  )
  VALUES (
    _uid, 'generation_refund', _credits, _p.credits_bonus, _p.credits_monthly,
    jsonb_build_object(
      'reference', _reference,
      'reason', _reason,
      'to_bonus', _from_bonus,
      'to_monthly', _from_monthly
    )
  );

  UPDATE public.generation_attempts
     SET status = 'refunded', finished_at = COALESCE(finished_at, now())
   WHERE id::text = _reference AND user_id = _uid;

  RETURN jsonb_build_object(
    'refunded', true, 'amount', _credits,
    'balance_bonus', _p.credits_bonus, 'balance_monthly', _p.credits_monthly
  );
END; $function$;

-- ─────────────── Alertas operacionais ───────────────
CREATE TABLE IF NOT EXISTS public.ops_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);
CREATE INDEX IF NOT EXISTS ops_alerts_pending_idx ON public.ops_alerts (created_at) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS ops_alerts_created_idx ON public.ops_alerts (created_at DESC);
ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_alerts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ops_alerts TO service_role;
DROP POLICY IF EXISTS ops_alerts_staff_read ON public.ops_alerts;
CREATE POLICY ops_alerts_staff_read ON public.ops_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
GRANT SELECT ON public.ops_alerts TO authenticated;

-- ─────────────── Varredura de tentativas interrompidas ───────────────
CREATE OR REPLACE FUNCTION public.refund_stale_generations(_older_than interval DEFAULT interval '10 minutes')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _a public.generation_attempts%ROWTYPE;
  _r jsonb;
  _ok boolean;
  _refunded integer := 0;
  _credits integer := 0;
  _failed integer := 0;
  _recovered integer := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('slideai:stale-generations')) THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  FOR _a IN
    SELECT * FROM public.generation_attempts
     WHERE status = 'running' AND created_at < now() - _older_than
     ORDER BY created_at
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  LOOP
    -- A função pode ter caído depois de registrar o sucesso.
    IF EXISTS (
      SELECT 1 FROM public.generation_logs
       WHERE status = 'success' AND metadata->>'attempt_ref' = _a.id::text
    ) THEN
      UPDATE public.generation_attempts SET status = 'succeeded', finished_at = now() WHERE id = _a.id;
      _recovered := _recovered + 1;
      CONTINUE;
    END IF;

    _r := public.refund_generation_credits(_a.user_id, _a.credits, _a.id::text, 'stale_timeout');
    _ok := COALESCE((_r->>'refunded')::boolean, false) OR COALESCE(_r->>'reason' = 'already_refunded', false);
    UPDATE public.generation_attempts
       SET status = CASE WHEN _ok THEN 'refunded' ELSE 'failed' END, finished_at = now()
     WHERE id = _a.id;

    IF COALESCE((_r->>'refunded')::boolean, false) THEN
      _refunded := _refunded + 1;
      _credits := _credits + _a.credits;
    ELSIF NOT _ok THEN
      _failed := _failed + 1;
    END IF;

    -- Aparece no painel de métricas como as demais falhas.
    INSERT INTO public.generation_logs(user_id, status, reason, credits_charged, metadata)
    VALUES (_a.user_id, 'error', 'stale_timeout', CASE WHEN _ok THEN 0 ELSE _a.credits END,
      jsonb_build_object(
        'failure_code', 'stale_timeout',
        'attempt_ref', _a.id,
        'started_at', _a.created_at,
        'credits_refunded', CASE WHEN COALESCE((_r->>'refunded')::boolean, false) THEN _a.credits ELSE 0 END,
        'refund_failed', NOT _ok,
        'refund_result', _r));
  END LOOP;

  IF _refunded + _failed > 0 THEN
    INSERT INTO public.ops_alerts(kind, severity, title, details, dedupe_key)
    VALUES (
      'generation_stale',
      CASE WHEN _failed > 0 THEN 'critical' ELSE 'warning' END,
      CASE WHEN _refunded + _failed = 1 THEN '1 geração interrompida sem resposta'
           ELSE format('%s gerações interrompidas sem resposta', _refunded + _failed) END,
      jsonb_build_object('estornadas', _refunded, 'creditos_devolvidos', _credits, 'estorno_com_falha', _failed,
                         'sem_resposta_ha_mais_de', _older_than::text),
      'generation_stale:' || gen_random_uuid()
    );
  END IF;

  RETURN jsonb_build_object('refunded', _refunded, 'credits', _credits, 'refund_failed', _failed, 'recovered', _recovered);
END;
$function$;

-- Agenda leve: roda no máximo a cada 5 minutos quando chamada.
CREATE OR REPLACE FUNCTION public.refund_stale_generations_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _last timestamptz;
  _result jsonb;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('slideai:stale-generations-due')) THEN
    RETURN;
  END IF;
  SELECT last_run_at INTO _last FROM public.maintenance_runs WHERE task = 'stale_generations';
  IF _last IS NOT NULL AND _last > now() - interval '5 minutes' THEN
    RETURN;
  END IF;
  -- Sem nada pendente, não grava execução (evita escrita a cada acesso).
  IF NOT EXISTS (
    SELECT 1 FROM public.generation_attempts
     WHERE status = 'running' AND created_at < now() - interval '10 minutes'
  ) THEN
    RETURN;
  END IF;
  _result := public.refund_stale_generations();
  INSERT INTO public.maintenance_runs(task, last_run_at, last_result)
  VALUES ('stale_generations', now(), _result)
  ON CONFLICT (task) DO UPDATE SET last_run_at = EXCLUDED.last_run_at, last_result = EXCLUDED.last_result;
END;
$function$;

-- record_access (0003) passa a disparar também a varredura: quem teve a
-- geração interrompida recebe os créditos de volta ao voltar ao app.
CREATE OR REPLACE FUNCTION public.record_access(_event text DEFAULT 'session'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  PERFORM public.refund_stale_generations_if_due();
END;
$function$;

-- Retenção: alertas por 12 meses, tentativas por 12 meses.
CREATE OR REPLACE FUNCTION public.purge_ops_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _alerts integer;
  _attempts integer;
BEGIN
  DELETE FROM public.ops_alerts WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _alerts = ROW_COUNT;
  DELETE FROM public.generation_attempts WHERE created_at < now() - interval '12 months' AND status <> 'running';
  GET DIAGNOSTICS _attempts = ROW_COUNT;
  RETURN jsonb_build_object('ops_alerts', _alerts, 'generation_attempts', _attempts);
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_data_retention_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  _result := public.purge_expired_data() || public.purge_ops_data();
  INSERT INTO public.maintenance_runs(task, last_run_at, last_result)
  VALUES ('data_retention', now(), _result)
  ON CONFLICT (task) DO UPDATE SET last_run_at = EXCLUDED.last_run_at, last_result = EXCLUDED.last_result;
END;
$function$;

-- ─────────────── Permissões ───────────────
REVOKE ALL ON FUNCTION public.consume_credits_with_metadata(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits_with_metadata(uuid, integer, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.charge_generation(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_generation(uuid, integer, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.refund_generation_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_credits(uuid, integer, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.refund_stale_generations(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_stale_generations(interval) TO service_role;
REVOKE ALL ON FUNCTION public.refund_stale_generations_if_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_stale_generations_if_due() TO service_role;
REVOKE ALL ON FUNCTION public.purge_ops_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_ops_data() TO service_role;
-- record_access e run_data_retention_if_due mantêm as permissões da 0003
-- (CREATE OR REPLACE não altera grants).

-- ─────────────── Agendamento (quando o pg_cron estiver disponível) ───────────────
-- Garante a devolução mesmo sem ninguém usando o app. Sem pg_cron, a
-- varredura continua rodando por record_access.
DO $do$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'slideai-stale-generations';
  PERFORM cron.schedule('slideai-stale-generations', '*/5 * * * *', 'SELECT public.refund_stale_generations()');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_cron indisponível (%); a varredura segue via record_access.', SQLERRM;
END
$do$;
