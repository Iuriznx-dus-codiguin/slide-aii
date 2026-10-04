-- Avisos por e-mail de ciclo de vida (docs/produto/plano-de-avisos-por-email.md).
--
-- billing_profiles   forma de pagamento, renovação automática, próxima cobrança
--                    e alerta de cobrança de cada conta (gravados pelo webhook).
-- pending_charges    Pix e boleto gerados e ainda não pagos.
-- email_preferences  descadastro dos e-mails de relacionamento (token único).
-- email_schedule     fila de envios agendados. O planejador
--                    (plan_lifecycle_emails) insere; a edge function
--                    email-dispatcher reavalia a situação e envia.
-- Idempotente. Tabelas só do servidor, exceto via as RPCs de preferências.

-- ─────────────── Cobrança por conta ───────────────
CREATE TABLE IF NOT EXISTS public.billing_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method text,
  auto_renew boolean NOT NULL DEFAULT false,
  card_brand text,
  card_last4 text CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
  next_payment_date timestamptz,
  billing_alert text CHECK (billing_alert IS NULL OR billing_alert IN ('renewal_refused', 'late')),
  billing_alert_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.billing_profiles TO service_role;

CREATE TABLE IF NOT EXISTS public.pending_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pix', 'boleto')),
  order_id text,
  subscription_id text,
  pay_url text,
  pix_code text,
  amount numeric,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
-- Sem filtro (o upsert do webhook usa ON CONFLICT); NULLs não colidem entre si.
CREATE UNIQUE INDEX IF NOT EXISTS pending_charges_order_kind_idx ON public.pending_charges (order_id, kind);
CREATE INDEX IF NOT EXISTS pending_charges_open_idx ON public.pending_charges (user_id) WHERE resolved_at IS NULL;
ALTER TABLE public.pending_charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_charges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pending_charges TO service_role;

-- ─────────────── Preferências ───────────────
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_emails boolean NOT NULL DEFAULT true,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  unsubscribed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_preferences FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_preferences TO service_role;

-- ─────────────── Fila ───────────────
CREATE TABLE IF NOT EXISTS public.email_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template text NOT NULL,
  send_at timestamptz NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed')),
  reason text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_schedule_due_idx ON public.email_schedule (send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS email_schedule_user_idx ON public.email_schedule (user_id, created_at DESC);
ALTER TABLE public.email_schedule ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_schedule FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_schedule TO service_role;

-- ─────────────── Funções de apoio ───────────────
-- Dia local (Brasília) + N dias, na hora indicada.
CREATE OR REPLACE FUNCTION public.sp_local_at(_ts timestamptz, _days integer, _hour integer)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT ((((_ts AT TIME ZONE 'America/Sao_Paulo')::date + _days)::timestamp) + make_interval(hours => _hour))
         AT TIME ZONE 'America/Sao_Paulo';
$function$;

-- Já comprou alguma vez (avulso ou assinatura)?
CREATE OR REPLACE FUNCTION public.user_has_purchased(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.credit_transactions t
     WHERE t.user_id = _uid
       AND t.type IN ('single_purchase', 'subscription_monthly', 'subscription_renewal', 'subscription_signup_bonus')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _uid AND COALESCE(p.plan, 'free') NOT IN ('free', 'dev')
  );
$function$;

-- Conta interna (admin/dev) não recebe e-mails de relacionamento.
CREATE OR REPLACE FUNCTION public.is_internal_account(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role::text IN ('admin', 'developer')
  );
$function$;

-- Token de preferências (cria a linha na primeira vez).
CREATE OR REPLACE FUNCTION public.ensure_email_preferences(_uid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _token uuid;
BEGIN
  INSERT INTO public.email_preferences(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT token INTO _token FROM public.email_preferences WHERE user_id = _uid;
  RETURN _token;
END;
$function$;

-- Página pública de preferências (o token é a credencial).
CREATE OR REPLACE FUNCTION public.get_email_preferences_by_token(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'relationship_emails', e.relationship_emails,
    -- Mostra só o começo do e-mail, para a pessoa reconhecer a conta.
    'email_hint', regexp_replace(COALESCE(p.email, ''), '^(.{2})[^@]*(@.*)$', '\1•••\2')
  )
  FROM public.email_preferences e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.token = _token;
$function$;

CREATE OR REPLACE FUNCTION public.set_email_preferences_by_token(_token uuid, _relationship boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.email_preferences
     SET relationship_emails = _relationship,
         unsubscribed_at = CASE WHEN _relationship THEN NULL ELSE now() END,
         updated_at = now()
   WHERE token = _token;
  RETURN FOUND;
END;
$function$;

-- Preferências da própria conta (Configurações).
CREATE OR REPLACE FUNCTION public.get_my_email_preferences()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  PERFORM public.ensure_email_preferences(_uid);
  RETURN (SELECT jsonb_build_object('relationship_emails', relationship_emails)
            FROM public.email_preferences WHERE user_id = _uid);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_email_preferences(_relationship boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  PERFORM public.ensure_email_preferences(_uid);
  UPDATE public.email_preferences
     SET relationship_emails = _relationship,
         unsubscribed_at = CASE WHEN _relationship THEN NULL ELSE now() END,
         updated_at = now()
   WHERE user_id = _uid;
  RETURN true;
END;
$function$;

-- ─────────────── Planejador ───────────────
-- Insere na fila os envios que dependem de tempo. Idempotente (dedupe_key).
-- Só agenda o que vence numa janela curta (12 h para trás, 1 h para a
-- frente): rodando a cada 10 minutos, nada se perde e nada antigo é
-- disparado de uma vez. A situação é conferida de novo no envio.
-- _now existe para testes; em produção, o padrão.
CREATE OR REPLACE FUNCTION public.plan_lifecycle_emails(_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _lo timestamptz := _now - interval '12 hours';
  _hi timestamptz := _now + interval '1 hour';
  _n integer;
  _total integer := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('slideai:plan-lifecycle-emails')) THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  -- 1) Quem criou conta e não comprou: dias 1, 3, 5, 10, 15 e 30, às 10 h.
  INSERT INTO public.email_schedule(user_id, template, send_at, dedupe_key, data)
  SELECT p.id, 'nurture', public.sp_local_at(p.created_at, d, 10),
         format('nurture_d%s:%s', d, p.id), jsonb_build_object('day', d)
    FROM public.profiles p
   CROSS JOIN unnest(ARRAY[1, 3, 5, 10, 15, 30]) AS d
   WHERE p.created_at > _now - interval '32 days'
     AND public.sp_local_at(p.created_at, d, 10) BETWEEN _lo AND _hi
     AND NOT public.user_has_purchased(p.id)
     AND NOT public.is_internal_account(p.id)
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT; _total := _total + _n;

  -- 2) Renovação: 5, 3 e 1 dia antes, às 9 h. Cancelada no período: 3 e 1.
  INSERT INTO public.email_schedule(user_id, template, send_at, dedupe_key, data)
  SELECT s.id, 'renewal_reminder', public.sp_local_at(s.due, -d, 9),
         format('renewal_d%s:%s:%s', d, s.id, (s.due AT TIME ZONE 'America/Sao_Paulo')::date),
         jsonb_build_object('days', d, 'due', s.due)
    FROM (
      SELECT p.id, p.subscription_status,
             CASE WHEN b.auto_renew AND b.next_payment_date IS NOT NULL THEN b.next_payment_date
                  ELSE p.subscription_renews_at END AS due
        FROM public.profiles p
        LEFT JOIN public.billing_profiles b ON b.user_id = p.id
       WHERE public.subscription_is_current(p.plan, p.subscription_status, p.subscription_renews_at)
    ) s
   CROSS JOIN unnest(ARRAY[5, 3, 1]) AS d
   WHERE s.due IS NOT NULL
     AND NOT (s.subscription_status = 'canceled' AND d = 5)
     AND public.sp_local_at(s.due, -d, 9) BETWEEN _lo AND _hi
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT; _total := _total + _n;

  -- 3) Atraso sem solução: 3 dias depois do aviso, às 10 h.
  INSERT INTO public.email_schedule(user_id, template, send_at, dedupe_key, data)
  SELECT b.user_id, 'subscription_late_followup', public.sp_local_at(b.billing_alert_at, 3, 10),
         format('late_d3:%s:%s', b.user_id, b.billing_alert_at::date), '{}'::jsonb
    FROM public.billing_profiles b
   WHERE b.billing_alert = 'late'
     AND public.sp_local_at(b.billing_alert_at, 3, 10) BETWEEN _lo AND _hi
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT; _total := _total + _n;

  -- 4) Reconquista: 7 e 30 dias depois do fim do acesso, às 10 h.
  INSERT INTO public.email_schedule(user_id, template, send_at, dedupe_key, data)
  SELECT p.id, 'winback', public.sp_local_at(p.subscription_renews_at, d, 10),
         format('winback_d%s:%s:%s', d, p.id, p.subscription_renews_at::date),
         jsonb_build_object('day', d, 'previous_plan', p.plan)
    FROM public.profiles p
   CROSS JOIN unnest(ARRAY[7, 30]) AS d
   WHERE p.plan IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual')
     AND p.subscription_renews_at IS NOT NULL
     AND p.subscription_renews_at < _now
     AND p.subscription_renews_at > _now - interval '32 days'
     AND NOT public.subscription_is_current(p.plan, p.subscription_status, p.subscription_renews_at)
     AND public.sp_local_at(p.subscription_renews_at, d, 10) BETWEEN _lo AND _hi
     AND NOT public.is_internal_account(p.id)
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT; _total := _total + _n;

  -- 5) Primeira apresentação criada.
  INSERT INTO public.email_schedule(user_id, template, send_at, dedupe_key, data)
  SELECT g.user_id, 'first_deck', g.created_at + interval '5 minutes', format('first_deck:%s', g.user_id),
         jsonb_build_object('presentation_id', g.presentation_id, 'title', g.metadata->>'title')
    FROM public.generation_logs g
   WHERE g.status = 'success'
     AND g.created_at > _now - interval '2 days'
     AND g.user_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.generation_logs o
        WHERE o.user_id = g.user_id AND o.status = 'success' AND o.created_at < g.created_at)
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT; _total := _total + _n;

  -- 6) Créditos acabando: depois de uma geração, saldo menor que uma
  --    apresentação de 10 slides (120). MAX não entra (uso justo). Um por semana.
  INSERT INTO public.email_schedule(user_id, template, send_at, dedupe_key, data)
  SELECT p.id, 'credits_low', _now, format('credits_low:%s:%s', p.id, to_char(_now, 'IYYY-IW')),
         jsonb_build_object('balance', s.balance)
    FROM public.profiles p
   CROSS JOIN LATERAL (
     SELECT COALESCE(p.credits_bonus, 0)
          + CASE WHEN public.subscription_is_current(p.plan, p.subscription_status, p.subscription_renews_at)
                 THEN GREATEST(COALESCE(p.credits_monthly, 0), 0) ELSE 0 END AS balance
   ) s
   WHERE COALESCE(p.plan, 'free') NOT IN ('max_mensal', 'max_trimestral', 'max_anual', 'dev')
     AND s.balance < 120
     AND EXISTS (SELECT 1 FROM public.generation_logs g
                  WHERE g.user_id = p.id AND g.status = 'success' AND g.created_at > _now - interval '3 hours')
     AND NOT public.is_internal_account(p.id)
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT; _total := _total + _n;

  -- 7) Geração interrompida e estornada (a pessoa não viu mensagem nenhuma).
  INSERT INTO public.email_schedule(user_id, template, send_at, dedupe_key, data)
  SELECT g.user_id, 'generation_refunded', _now, format('generation_refunded:%s', g.metadata->>'attempt_ref'),
         jsonb_build_object('credits', (g.metadata->>'credits_refunded')::integer)
    FROM public.generation_logs g
   WHERE g.reason = 'stale_timeout'
     AND g.created_at > _now - interval '1 day'
     AND COALESCE((g.metadata->>'credits_refunded')::integer, 0) > 0
     AND g.user_id IS NOT NULL
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT; _total := _total + _n;

  RETURN jsonb_build_object('scheduled', _total);
END;
$function$;

-- Envios vencidos para o despachante (reserva, para duas execuções não
-- pegarem a mesma linha).
CREATE OR REPLACE FUNCTION public.claim_due_emails(_limit integer DEFAULT 40)
RETURNS SETOF public.email_schedule
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.email_schedule s
     SET status = 'processing', attempts = s.attempts + 1, claimed_at = now()
   WHERE s.id IN (
     SELECT id FROM public.email_schedule
      WHERE (status = 'pending' AND send_at <= now())
         -- Reserva abandonada (função caiu no meio): tenta de novo, até 3 vezes.
         OR (status = 'processing' AND claimed_at < now() - interval '30 minutes' AND attempts < 3)
      ORDER BY send_at
      LIMIT _limit
      FOR UPDATE SKIP LOCKED)
  RETURNING s.*;
$function$;

-- ─────────────── Segredo do despachante ───────────────
-- Gerado no próprio banco (Vault); a edge function confere por esta RPC.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'email_dispatch_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'email_dispatch_secret',
                                'Autenticação do pg_cron no email-dispatcher');
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Vault indisponível (%): crie o segredo email_dispatch_secret manualmente.', SQLERRM;
END
$do$;

CREATE OR REPLACE FUNCTION public.email_dispatch_secret_ok(_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(length(_secret) >= 32 AND _secret = (
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_dispatch_secret' LIMIT 1), false);
$function$;

-- ─────────────── Retenção ───────────────
CREATE OR REPLACE FUNCTION public.purge_ops_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _alerts integer;
  _attempts integer;
  _schedule integer;
  _charges integer;
  _emails integer;
BEGIN
  DELETE FROM public.ops_alerts WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _alerts = ROW_COUNT;
  DELETE FROM public.generation_attempts WHERE created_at < now() - interval '12 months' AND status <> 'running';
  GET DIAGNOSTICS _attempts = ROW_COUNT;
  DELETE FROM public.email_schedule WHERE created_at < now() - interval '6 months' AND status <> 'pending';
  GET DIAGNOSTICS _schedule = ROW_COUNT;
  DELETE FROM public.pending_charges WHERE created_at < now() - interval '6 months';
  GET DIAGNOSTICS _charges = ROW_COUNT;
  DELETE FROM public.email_log WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _emails = ROW_COUNT;
  RETURN jsonb_build_object('ops_alerts', _alerts, 'generation_attempts', _attempts,
    'email_schedule', _schedule, 'pending_charges', _charges, 'email_log', _emails);
END;
$function$;

-- ─────────────── Permissões ───────────────
REVOKE ALL ON FUNCTION public.sp_local_at(timestamptz, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sp_local_at(timestamptz, integer, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.user_has_purchased(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_purchased(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_internal_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_account(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.ensure_email_preferences(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_email_preferences(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_email_preferences_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_preferences_by_token(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_email_preferences_by_token(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_email_preferences_by_token(uuid, boolean) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_my_email_preferences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_email_preferences() TO authenticated;
REVOKE ALL ON FUNCTION public.set_my_email_preferences(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_email_preferences(boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.plan_lifecycle_emails(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_lifecycle_emails(timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.claim_due_emails(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_emails(integer) TO service_role;
REVOKE ALL ON FUNCTION public.email_dispatch_secret_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_dispatch_secret_ok(text) TO service_role;
REVOKE ALL ON FUNCTION public.purge_ops_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_ops_data() TO service_role;

-- ─────────────── Agendamento: pg_cron chama o despachante a cada 10 min ───────────────
DO $do$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'slideai-email-dispatch';
  PERFORM cron.schedule('slideai-email-dispatch', '*/10 * * * *', $job$
    SELECT net.http_post(
      url := 'https://goistdwnwksaskbffsni.supabase.co/functions/v1/email-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_dispatch_secret' LIMIT 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)
  $job$);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_net/pg_cron indisponível (%): agende o email-dispatcher manualmente.', SQLERRM;
END
$do$;
