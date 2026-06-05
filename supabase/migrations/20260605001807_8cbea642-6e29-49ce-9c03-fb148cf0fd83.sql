-- Block 12: dynamic_theme on presentations
ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS dynamic_theme jsonb;

-- Block 9: can_user_generate returns monthly_limit_reached instead of system_error
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
  IF _profile.plan = 'single' AND COALESCE(_profile.single_credits, 0) > 0 THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'single', 'credits', _profile.single_credits);
  END IF;
  IF _profile.plan IN ('mensal','anual') THEN
    SELECT COUNT(*) INTO _count FROM public.generation_logs
      WHERE user_id = _uid AND status = 'success'
        AND created_at >= date_trunc('month', now());
    IF _count < 20 THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'used', _count, 'plan', _profile.plan);
    ELSE
      RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit_reached', 'used', _count, 'plan', _profile.plan);
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed', false, 'reason', 'no_plan', 'plan', COALESCE(_profile.plan, 'free'));
END; $function$;