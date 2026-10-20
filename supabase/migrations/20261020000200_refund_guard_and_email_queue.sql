-- Trava do estorno e fila de e-mails (auditoria de 17/10/2026, B-4 e B-5).
--
-- 1) refund_generation_credits não estorna tentativa já concluída: entre
--    gravar o deck e responder ao cliente, uma exceção levava ao tratamento
--    de falha, que devolvia os créditos de uma apresentação entregue. E nunca
--    devolve mais do que a tentativa ainda guarda (depois de um estorno da
--    diferença de slides, o valor cheio devolveria essa diferença duas vezes).
-- 2) Fila de e-mails: reserva abandonada 3 vezes ficava em "processing" para
--    sempre. Agora vira "failed" (motivo abandoned_after_retries), e um índice
--    atende a busca das reservas abandonadas.
-- Idempotente.

-- ─────────────── 1) Estorno ───────────────
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
  _attempt_credits integer;
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

  -- Tentativa concluída (deck entregue): não estorna. Uma exceção depois de
  -- gravar o deck caía no tratamento de falha e devolvia os créditos de uma
  -- apresentação entregue. Slides a menos têm estorno próprio
  -- (refund_generation_shortfall, migração 0010).
  IF EXISTS (
    SELECT 1 FROM public.generation_attempts
     WHERE id::text = _reference AND user_id = _uid AND status = 'succeeded'
  ) THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'attempt_succeeded');
  END IF;

  -- Nunca devolve mais do que a tentativa ainda guarda: a diferença de
  -- slides pode já ter voltado por refund_generation_shortfall, que reduz
  -- generation_attempts.credits.
  SELECT credits INTO _attempt_credits
    FROM public.generation_attempts
   WHERE id::text = _reference AND user_id = _uid;
  IF _attempt_credits IS NOT NULL THEN
    _credits := LEAST(_credits, _attempt_credits);
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

REVOKE ALL ON FUNCTION public.refund_generation_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_credits(uuid, integer, text, text) TO service_role;

-- ─────────────── 2) Fila de e-mails ───────────────
CREATE OR REPLACE FUNCTION public.claim_due_emails(_limit integer DEFAULT 40)
RETURNS SETOF public.email_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Abandonada nas 3 tentativas: encerra como falha.
  UPDATE public.email_schedule
     SET status = 'failed', reason = COALESCE(reason, 'abandoned_after_retries'), processed_at = now()
   WHERE status = 'processing' AND claimed_at < now() - interval '30 minutes' AND attempts >= 3;

  RETURN QUERY
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
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_due_emails(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_emails(integer) TO service_role;

CREATE INDEX IF NOT EXISTS email_schedule_processing_idx
  ON public.email_schedule (claimed_at) WHERE status = 'processing';
