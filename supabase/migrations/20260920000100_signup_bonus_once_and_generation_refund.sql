-- ══════════════════════════════════════════════════════════════
-- 1) Bônus de primeira ativação: uma vez por CONTA, não por assinatura
-- 2) Estorno de créditos quando a geração falha por culpa do sistema
-- ══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) grant_bonus_credits_once
-- ─────────────────────────────────────────────────────────────
-- O webhook decidia "é a primeira ativação?" comparando o
-- cakto_subscription_id anterior com o do evento. Como cancelar/reembolsar
-- limpa esse campo (e uma reassinatura sempre traz um id novo), bastava
-- cancelar e assinar de novo para o bônus ser concedido outra vez.
--
-- A fonte de verdade correta é o histórico do usuário, que já existe e é
-- imutável: `credit_transactions`. Se já houver um lançamento daquele tipo
-- para a conta, o bônus não é concedido de novo — independentemente de
-- quantas assinaturas ela teve.
--
-- O lock em `profiles` serializa duas entregas simultâneas do mesmo webhook
-- (a Cakto reenvia em caso de timeout), evitando que ambas leiam "ainda não
-- recebeu" e creditem duas vezes.
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

  -- Serializa concessões concorrentes para a mesma conta.
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

-- ─────────────────────────────────────────────────────────────
-- 2) refund_generation_credits
-- ─────────────────────────────────────────────────────────────
-- A cobrança acontece ANTES da geração (consume_credits), então qualquer
-- falha depois disso é responsabilidade do sistema — e até agora o crédito
-- ficava retido mesmo quando o usuário não teve nenhuma culpa.
--
-- O estorno devolve os créditos para as MESMAS bolsas de onde saíram: o
-- lançamento original de 'consume' registra em metadata quanto veio de bônus
-- e quanto veio da cota mensal, e o crédito é devolvido nessa proporção. Sem
-- isso, um estorno para o bônus inflaria o saldo permanente de quem pagou com
-- a cota mensal (que expira no fim do ciclo).
--
-- Idempotente por `_reference`: o mesmo id de tentativa nunca é estornado
-- duas vezes, mesmo se a edge function repetir a chamada.
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

  -- Já estornado antes (reentrega/retry): não credita de novo.
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE user_id = _uid
      AND type = 'generation_refund'
      AND metadata->>'reference' = _reference
  ) THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'already_refunded');
  END IF;

  -- Divisão original da cobrança desta tentativa. Casa pelo valor exato para
  -- não pegar o débito de outra geração em paralelo; se nada casar, devolve
  -- tudo ao bônus (a soma estornada é sempre correta — o que poderia variar
  -- é apenas a bolsa de destino).
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
