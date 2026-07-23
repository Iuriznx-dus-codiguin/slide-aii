
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
BEGIN
  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  _is_dev := public.has_role(_uid, 'developer'::app_role) OR public.has_role(_uid, 'admin'::app_role);
  IF _is_dev THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'dev', 'plan', 'dev');
  END IF;

  -- Cancelamento profissional: bloqueia imediatamente e sinaliza o motivo.
  IF _profile.subscription_status = 'canceled'
     AND _profile.plan IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_canceled', 'plan', _profile.plan);
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
      -- Teto oculto: retorna erro genérico para não expor o número.
      RETURN jsonb_build_object('allowed', false, 'reason', 'system_error', 'plan', _profile.plan);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'no_plan', 'plan', COALESCE(_profile.plan, 'free'));
END; $function$;
