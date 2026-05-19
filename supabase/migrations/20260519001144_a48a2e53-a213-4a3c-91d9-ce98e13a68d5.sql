
-- profiles: novos campos de assinatura
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_renews_at timestamptz,
  ADD COLUMN IF NOT EXISTS cakto_customer_id text,
  ADD COLUMN IF NOT EXISTS cakto_subscription_id text,
  ADD COLUMN IF NOT EXISTS single_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email text;

-- generation_logs
CREATE TABLE IF NOT EXISTS public.generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  presentation_id uuid,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  model text,
  mode text,
  slides_count integer NOT NULL DEFAULT 0,
  images_pexels integer NOT NULL DEFAULT 0,
  images_ai integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  actual_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_generation_logs_user_created ON public.generation_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_logs_created ON public.generation_logs(created_at DESC);

ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_owner_select" ON public.generation_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "logs_owner_insert" ON public.generation_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- payment_events (webhook audit)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'cakto',
  event_type text,
  cakto_id text,
  user_email text,
  user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON public.payment_events(created_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_events_admin_select" ON public.payment_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'admin'));

-- Função: pode gerar?
CREATE OR REPLACE FUNCTION public.can_user_generate(_uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _profile public.profiles%ROWTYPE;
  _is_dev boolean;
  _count int;
BEGIN
  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  _is_dev := public.has_role(_uid, 'developer'::app_role) OR public.has_role(_uid, 'admin'::app_role);
  IF _is_dev THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'dev', 'plan', 'dev');
  END IF;
  IF _profile.plan = 'single' AND COALESCE(_profile.single_credits, 0) > 0 THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'single', 'credits', _profile.single_credits);
  END IF;
  IF _profile.plan IN ('mensal','anual') THEN
    -- limite oculto: 20 gerações por mês calendário
    SELECT COUNT(*) INTO _count FROM public.generation_logs
      WHERE user_id = _uid AND status = 'success'
        AND created_at >= date_trunc('month', now());
    IF _count < 20 THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'used', _count, 'plan', _profile.plan);
    ELSE
      RETURN jsonb_build_object('allowed', false, 'reason', 'system_error', 'used', _count, 'plan', _profile.plan);
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed', false, 'reason', 'no_plan', 'plan', COALESCE(_profile.plan, 'free'));
END; $$;

-- Consome crédito (single) — chamado pelo edge function após sucesso
CREATE OR REPLACE FUNCTION public.consume_single_credit(_uid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _updated int;
BEGIN
  UPDATE public.profiles
    SET single_credits = single_credits - 1
    WHERE id = _uid AND plan = 'single' AND single_credits > 0;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END; $$;
