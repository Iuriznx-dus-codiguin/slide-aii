CREATE OR REPLACE FUNCTION public.can_user_generate(_uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _profile public.profiles%ROWTYPE;
  _is_dev boolean;
  _count int;
  _is_sub boolean;
BEGIN
  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  _is_dev := public.has_role(_uid, 'developer'::app_role) OR public.has_role(_uid, 'admin'::app_role);
  IF _is_dev THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'dev', 'plan', 'dev');
  END IF;

  _is_sub := _profile.plan IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual');

  -- Cancelamento: bloqueia imediatamente.
  IF _is_sub AND _profile.subscription_status = 'canceled' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_canceled', 'plan', _profile.plan);
  END IF;

  -- Assinatura expirada (período venceu sem renovação).
  IF _is_sub AND _profile.subscription_renews_at IS NOT NULL
     AND _profile.subscription_renews_at < now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_expired', 'plan', _profile.plan,
      'expired_at', _profile.subscription_renews_at);
  END IF;

  IF _is_sub AND _profile.subscription_status IS NOT NULL
     AND _profile.subscription_status NOT IN ('active','trialing') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_expired', 'plan', _profile.plan);
  END IF;

  IF _profile.plan = 'single' AND COALESCE(_profile.single_credits, 0) > 0 THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'single', 'credits', _profile.single_credits);
  END IF;

  IF _profile.plan IN ('mensal','trimestral','anual') THEN
    SELECT COUNT(*) INTO _count FROM public.generation_logs
      WHERE user_id = _uid AND status = 'success'
        AND created_at >= date_trunc('month', now());
    IF _count < 20 THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'used', _count, 'plan', _profile.plan);
    ELSE
      RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit_reached', 'used', _count, 'plan', _profile.plan);
    END IF;
  END IF;

  IF _profile.plan IN ('max_mensal','max_trimestral','max_anual') THEN
    SELECT COUNT(*) INTO _count FROM public.generation_logs
      WHERE user_id = _uid AND status = 'success'
        AND created_at >= date_trunc('month', now());
    IF _count < 100 THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'used', _count, 'plan', _profile.plan);
    ELSE
      RETURN jsonb_build_object('allowed', false, 'reason', 'system_error', 'plan', _profile.plan);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'no_plan', 'plan', COALESCE(_profile.plan, 'free'));
END; $function$;