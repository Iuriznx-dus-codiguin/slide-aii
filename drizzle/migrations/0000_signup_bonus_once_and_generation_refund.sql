CREATE OR REPLACE FUNCTION public.grant_bonus_credits_once(
  _uid uuid,
  _amount integer,
  _type text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _already boolean;
  _balance integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'noop');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_profile');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE user_id = _uid AND type = _type
  ) INTO _already;

  IF _already THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END IF;

  _balance := public.grant_bonus_credits(_uid, _amount, _type);
  RETURN jsonb_build_object('granted', true, 'amount', _amount, 'balance_bonus', _balance);
END; $$;

REVOKE EXECUTE ON FUNCTION public.grant_bonus_credits_once(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_bonus_credits_once(uuid, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_generation_credits(
  _uid uuid,
  _credits integer,
  _reference text,
  _reason text DEFAULT 'generation_failed'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

  SELECT metadata INTO _last
  FROM public.credit_transactions
  WHERE user_id = _uid AND type = 'consume' AND amount = -_credits
  ORDER BY created_at DESC
  LIMIT 1;

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

  RETURN jsonb_build_object(
    'refunded', true, 'amount', _credits,
    'balance_bonus', _p.credits_bonus, 'balance_monthly', _p.credits_monthly
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.refund_generation_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_credits(uuid, integer, text, text) TO service_role;