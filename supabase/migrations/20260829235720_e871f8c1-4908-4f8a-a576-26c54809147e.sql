CREATE OR REPLACE FUNCTION public.consume_credits(_uid uuid, _credits_cost integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Consome PRIMEIRO a cota mensal (renovável) e só depois o bônus permanente.
  _from_monthly := LEAST(COALESCE(_p.credits_monthly,0), _credits_cost);
  _from_bonus := _credits_cost - _from_monthly;

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
END; $function$;