-- Correções da revisão geral (docs/revisao/2026-09-26-revisao-geral.md).
--
-- 1) Idempotência do webhook da Cakto por (evento, pedido).
--    A chave era só `cakto_id` (= data.id, o id do PEDIDO). O reembolso e o
--    chargeback de um pedido chegam com o mesmo data.id da compra aprovada e
--    eram descartados como "entrega duplicada" — o estorno nunca acontecia.
--    Reentregas do MESMO evento continuam barradas.
DROP INDEX IF EXISTS public.idx_payment_events_cakto_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_event_cakto_unique
  ON public.payment_events (event_type, cakto_id)
  WHERE cakto_id IS NOT NULL;

-- 2) Estorno restrito ao pedido reembolsado.
--    revoke_credits (mantida, sem uso pelo webhook) zerava bônus + cota
--    mensal de qualquer reembolso. Esta função retira no máximo o que o
--    pedido concedeu, nunca deixa saldo negativo e é idempotente por pedido:
--    refund + chargeback do mesmo pedido estornam uma vez só.
CREATE OR REPLACE FUNCTION public.revoke_order_credits(
  _uid uuid,
  _order_id text,
  _revoke_bonus integer,
  _zero_monthly boolean,
  _type text DEFAULT 'refund_revoke'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.profiles%ROWTYPE;
  _bonus_cut integer;
  _monthly_cut integer;
BEGIN
  SELECT * INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
  END IF;

  IF _order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_transactions
     WHERE user_id = _uid AND type = _type AND metadata->>'order_id' = _order_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'revoked', 0, 'reason', 'already_revoked');
  END IF;

  _bonus_cut := LEAST(GREATEST(COALESCE(_revoke_bonus, 0), 0), COALESCE(_p.credits_bonus, 0));
  _monthly_cut := CASE WHEN _zero_monthly THEN COALESCE(_p.credits_monthly, 0) ELSE 0 END;

  UPDATE public.profiles
     SET credits_bonus = COALESCE(credits_bonus, 0) - _bonus_cut,
         credits_monthly = COALESCE(credits_monthly, 0) - _monthly_cut,
         credits_cycle_anchor = CASE WHEN _zero_monthly THEN NULL ELSE credits_cycle_anchor END
   WHERE id = _uid;

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
  VALUES (
    _uid, _type, -(_bonus_cut + _monthly_cut),
    COALESCE(_p.credits_bonus, 0) - _bonus_cut,
    COALESCE(_p.credits_monthly, 0) - _monthly_cut,
    jsonb_build_object('order_id', _order_id, 'revoked_bonus', _bonus_cut, 'revoked_monthly', _monthly_cut)
  );

  RETURN jsonb_build_object('ok', true, 'revoked', _bonus_cut + _monthly_cut,
    'revoked_bonus', _bonus_cut, 'revoked_monthly', _monthly_cut);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_order_credits(uuid, text, integer, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_order_credits(uuid, text, integer, boolean, text) TO service_role;

-- 3) can_user_generate não expõe mais dados de outros usuários.
--    É executável por `authenticated` e aceitava qualquer _uid: somada a
--    get_profile_for_viewer (que devolve o id a partir do username público),
--    qualquer pessoa logada lia plano, saldo e vencimento de outra. Agora,
--    fora do service_role (edge functions), _uid é sempre o próprio usuário.
--    Corpo idêntico ao anterior além do bloco de guarda.
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
  _month date := date_trunc('month', now())::date;
  _monthly integer;
  _available integer;
BEGIN
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

  _is_sub := _profile.plan IN ('mensal','trimestral','anual','max_mensal','max_trimestral','max_anual');

  IF _is_sub AND _profile.subscription_status = 'canceled' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_canceled', 'plan', _profile.plan);
  END IF;

  IF _is_sub AND _profile.subscription_renews_at IS NOT NULL
     AND _profile.subscription_renews_at < now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_expired', 'plan', _profile.plan,
      'expired_at', _profile.subscription_renews_at);
  END IF;

  IF _is_sub AND _profile.subscription_status IS NOT NULL
     AND _profile.subscription_status NOT IN ('active','trialing') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_expired', 'plan', _profile.plan);
  END IF;

  -- Saldo mensal efetivo (reset preguiçoso calculado, não persistido)
  IF _is_sub AND (_profile.credits_cycle_anchor IS NULL OR _profile.credits_cycle_anchor < _month) THEN
    _monthly := public.plan_monthly_credits(_profile.plan);
  ELSE
    _monthly := COALESCE(_profile.credits_monthly, 0);
  END IF;
  _available := COALESCE(_profile.credits_bonus, 0) + _monthly;

  IF _profile.plan = 'single' THEN
    IF _available >= COALESCE(_credits_cost, 0) THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'single',
        'credits', _available, 'credits_bonus', COALESCE(_profile.credits_bonus,0), 'credits_monthly', _monthly);
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits', 'plan', _profile.plan,
      'credits', _available, 'required', _credits_cost);
  END IF;

  IF _profile.plan IN ('mensal','trimestral','anual') THEN
    IF _available >= COALESCE(_credits_cost, 0) THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'plan', _profile.plan,
        'credits', _available, 'credits_bonus', COALESCE(_profile.credits_bonus,0), 'credits_monthly', _monthly);
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_credits', 'plan', _profile.plan,
      'credits', _available, 'required', _credits_cost);
  END IF;

  IF _profile.plan IN ('max_mensal','max_trimestral','max_anual') THEN
    IF _available >= COALESCE(_credits_cost, 0) THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'subscription', 'plan', _profile.plan,
        'credits', _available, 'credits_bonus', COALESCE(_profile.credits_bonus,0), 'credits_monthly', _monthly);
    END IF;
    -- MAX esconde o teto atrás de erro genérico
    RETURN jsonb_build_object('allowed', false, 'reason', 'system_error', 'plan', _profile.plan);
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'no_plan', 'plan', COALESCE(_profile.plan, 'free'),
    'credits', _available);
END; $function$;
