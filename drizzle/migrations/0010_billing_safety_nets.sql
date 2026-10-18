-- Redes de segurança da cobrança (auditoria de 17/10/2026).
--
-- 1) Gatilhos de proteção: o critério deixa de ser auth.role() e passa a ser
--    o papel que executa o UPDATE (current_user). Antes, o pg_cron e o
--    record_access (sem JWT de service_role) eram barrados pelo próprio
--    gatilho: refund_stale_generations abortava inteira e nunca devolvia
--    créditos, e record_access desfazia o registro de acesso (Marco Civil).
--    Agora só o cliente (PostgREST como anon/authenticated) é barrado;
--    funções SECURITY DEFINER, pg_cron e service_role escrevem.
-- 2) record_access: manutenção isolada; uma falha nela não desfaz mais o
--    registro de acesso.
-- 3) refund_generation_shortfall: estorno da diferença quando a geração
--    entrega menos slides do que os cobrados.
-- 4) Cotas atômicas: reserva antes da chamada de IA e devolução em falha
--    (chat de edição, regeneração de falas, ativos da apresentação).
-- 5) presentations: o cliente não insere mais apresentações (a geração grava
--    no servidor) nem altera include_speeches (falas são recurso pago).
-- Idempotente.

-- ─────────────── 1) Gatilhos de proteção ───────────────
CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
       OR NEW.subscription_period_start IS DISTINCT FROM OLD.subscription_period_start
       OR NEW.subscription_renews_at IS DISTINCT FROM OLD.subscription_renews_at
       OR NEW.credits_bonus IS DISTINCT FROM OLD.credits_bonus
       OR NEW.credits_monthly IS DISTINCT FROM OLD.credits_monthly
       OR NEW.credits_cycle_anchor IS DISTINCT FROM OLD.credits_cycle_anchor
       OR NEW.cakto_customer_id IS DISTINCT FROM OLD.cakto_customer_id
       OR NEW.cakto_subscription_id IS DISTINCT FROM OLD.cakto_subscription_id
    THEN
      RAISE EXCEPTION 'Campos de faturamento não podem ser alterados diretamente pelo usuário.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_billing_columns ON public.profiles;
CREATE TRIGGER trg_protect_billing_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_billing_columns();

-- Contadores de IA e falas pagas: só o servidor altera.
CREATE OR REPLACE FUNCTION public.protect_ai_edit_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (NEW.ai_edit_messages IS DISTINCT FROM OLD.ai_edit_messages
          OR NEW.ai_edit_complex IS DISTINCT FROM OLD.ai_edit_complex
          OR NEW.speech_regen_count IS DISTINCT FROM OLD.speech_regen_count
          OR NEW.include_speeches IS DISTINCT FROM OLD.include_speeches) THEN
    RAISE EXCEPTION 'Contadores de uso de IA não podem ser alterados pelo cliente.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_ai_edit_usage ON public.presentations;
CREATE TRIGGER trg_protect_ai_edit_usage BEFORE UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.protect_ai_edit_usage();

-- ─────────────── 2) record_access com manutenção isolada ───────────────
CREATE OR REPLACE FUNCTION public.record_access(_event text DEFAULT 'session'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _info jsonb;
  _ip text;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;
  _info := public.request_client_info();
  _ip := _info->>'ip';
  IF NOT EXISTS (
    SELECT 1 FROM public.access_logs
     WHERE user_id = _uid
       AND ip IS NOT DISTINCT FROM _ip
       AND created_at > now() - interval '30 minutes'
  ) THEN
    INSERT INTO public.access_logs(user_id, ip, user_agent, event)
    VALUES (_uid, _ip, _info->>'user_agent', left(COALESCE(NULLIF(trim(_event), ''), 'session'), 40));
  END IF;
  -- Manutenção oportunista: cada bloco tem o próprio savepoint, então uma
  -- falha aqui não desfaz o registro de acesso acima.
  BEGIN
    PERFORM public.run_data_retention_if_due();
  EXCEPTION WHEN others THEN
    RAISE WARNING 'run_data_retention_if_due falhou: %', SQLERRM;
  END;
  BEGIN
    PERFORM public.refund_stale_generations_if_due();
  EXCEPTION WHEN others THEN
    RAISE WARNING 'refund_stale_generations_if_due falhou: %', SQLERRM;
  END;
END;
$function$;

-- ─────────────── 3) Estorno da diferença de slides ───────────────
-- A geração cobra pelo número de slides pedido. Quando a IA entrega menos, a
-- edge function devolve a diferença. Idempotente por tentativa; divide entre
-- bônus e cota mensal na proporção do débito; reduz a tentativa para que a
-- varredura nunca estorne o valor cheio depois.
CREATE OR REPLACE FUNCTION public.refund_generation_shortfall(_uid uuid, _credits integer, _reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p public.profiles%ROWTYPE;
  _debit public.credit_transactions%ROWTYPE;
  _charged integer;
  _amount integer;
  _from_bonus integer;
  _to_bonus integer;
  _to_monthly integer;
BEGIN
  IF _credits IS NULL OR _credits <= 0 OR _reference IS NULL THEN
    RETURN jsonb_build_object('refunded', false, 'credits', 0, 'reason', 'noop');
  END IF;

  SELECT * INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'credits', 0, 'reason', 'no_profile');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
     WHERE user_id = _uid
       AND type IN ('generation_shortfall_refund', 'generation_refund')
       AND metadata->>'reference' = _reference
  ) THEN
    RETURN jsonb_build_object('refunded', false, 'credits', 0, 'reason', 'already_refunded');
  END IF;

  SELECT * INTO _debit FROM public.credit_transactions
   WHERE user_id = _uid AND type = 'consume' AND metadata->>'reference' = _reference
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'credits', 0, 'reason', 'no_debit');
  END IF;

  _charged := -_debit.amount;
  -- A tentativa precisa manter ao menos 1 crédito (CHECK credits > 0).
  _amount := LEAST(_credits, _charged - 1);
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('refunded', false, 'credits', 0, 'reason', 'nothing_to_refund');
  END IF;

  _from_bonus := LEAST(GREATEST(COALESCE((_debit.metadata->>'from_bonus')::integer, 0), 0), _charged);
  _to_bonus := LEAST(_from_bonus, floor(_amount::numeric * _from_bonus / _charged)::integer);
  _to_monthly := _amount - _to_bonus;

  UPDATE public.profiles
     SET credits_bonus = COALESCE(credits_bonus, 0) + _to_bonus,
         credits_monthly = COALESCE(credits_monthly, 0) + _to_monthly
   WHERE id = _uid
  RETURNING credits_bonus, credits_monthly INTO _p.credits_bonus, _p.credits_monthly;

  INSERT INTO public.credit_transactions(
    user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata
  )
  VALUES (
    _uid, 'generation_shortfall_refund', _amount, _p.credits_bonus, _p.credits_monthly,
    jsonb_build_object('reference', _reference, 'to_bonus', _to_bonus, 'to_monthly', _to_monthly)
  );

  UPDATE public.generation_attempts
     SET credits = credits - _amount
   WHERE id::text = _reference AND user_id = _uid AND credits > _amount;

  RETURN jsonb_build_object('refunded', true, 'credits', _amount,
    'balance_bonus', _p.credits_bonus, 'balance_monthly', _p.credits_monthly);
END;
$function$;

REVOKE ALL ON FUNCTION public.refund_generation_shortfall(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_shortfall(uuid, integer, text) TO service_role;

-- ─────────────── 4) Cotas atômicas ───────────────
-- Chat de edição: reserva antes da chamada de IA (o teto é conferido na
-- mesma instrução), devolução quando a edição falha ou não muda nada.
CREATE OR REPLACE FUNCTION public.reserve_ai_edit(
  _presentation_id uuid, _uid uuid, _messages integer, _complex integer,
  _max_messages integer, _max_complex integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _m integer;
  _c integer;
BEGIN
  UPDATE public.presentations
     SET ai_edit_messages = ai_edit_messages + GREATEST(COALESCE(_messages, 0), 0),
         ai_edit_complex = ai_edit_complex + GREATEST(COALESCE(_complex, 0), 0)
   WHERE id = _presentation_id AND user_id = _uid
     AND ai_edit_messages + GREATEST(COALESCE(_messages, 0), 0) <= _max_messages
     AND ai_edit_complex + GREATEST(COALESCE(_complex, 0), 0) <= _max_complex
  RETURNING ai_edit_messages, ai_edit_complex INTO _m, _c;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'messages', _m, 'complex_edits', _c);
  END IF;

  SELECT ai_edit_messages, ai_edit_complex INTO _m, _c
    FROM public.presentations WHERE id = _presentation_id AND user_id = _uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found', 'messages', 0, 'complex_edits', 0);
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'quota', 'messages', _m, 'complex_edits', _c);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ai_edit(_presentation_id uuid, _uid uuid, _messages integer, _complex integer)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.presentations
     SET ai_edit_messages = GREATEST(ai_edit_messages - GREATEST(COALESCE(_messages, 0), 0), 0),
         ai_edit_complex = GREATEST(ai_edit_complex - GREATEST(COALESCE(_complex, 0), 0), 0)
   WHERE id = _presentation_id AND user_id = _uid
  RETURNING jsonb_build_object('messages', ai_edit_messages, 'complex_edits', ai_edit_complex);
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_edit(uuid, uuid, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_edit(uuid, uuid, integer, integer, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.release_ai_edit(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_ai_edit(uuid, uuid, integer, integer) TO service_role;

-- Regeneração de falas: mesma ideia, com o teto por apresentação.
CREATE OR REPLACE FUNCTION public.reserve_speech_regen(_presentation_id uuid, _uid uuid, _max integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _used integer;
BEGIN
  UPDATE public.presentations
     SET speech_regen_count = COALESCE(speech_regen_count, 0) + 1
   WHERE id = _presentation_id AND user_id = _uid
     AND COALESCE(speech_regen_count, 0) < _max
  RETURNING speech_regen_count INTO _used;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'used', _used);
  END IF;

  SELECT COALESCE(speech_regen_count, 0) INTO _used
    FROM public.presentations WHERE id = _presentation_id AND user_id = _uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found', 'used', 0);
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'quota', 'used', _used);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_speech_regen(_presentation_id uuid, _uid uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.presentations
     SET speech_regen_count = GREATEST(COALESCE(speech_regen_count, 0) - 1, 0)
   WHERE id = _presentation_id AND user_id = _uid
  RETURNING jsonb_build_object('used', speech_regen_count);
$$;

REVOKE ALL ON FUNCTION public.reserve_speech_regen(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_speech_regen(uuid, uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.release_speech_regen(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_speech_regen(uuid, uuid) TO service_role;

-- Ativos da apresentação: devolve uma unidade quando a geração falha.
CREATE OR REPLACE FUNCTION public.release_presentation_asset(_presentation_id uuid, _uid uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kind = 'ai' THEN
    UPDATE public.presentation_asset_quotas
       SET ai_consumed = GREATEST(ai_consumed - 1, 0)
     WHERE presentation_id = _presentation_id AND user_id = _uid AND ai_consumed > 0;
  ELSIF _kind = 'photo' THEN
    UPDATE public.presentation_asset_quotas
       SET photo_consumed = GREATEST(photo_consumed - 1, 0)
     WHERE presentation_id = _presentation_id AND user_id = _uid AND photo_consumed > 0;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;
  RETURN jsonb_build_object('ok', FOUND);
END;
$$;

REVOKE ALL ON FUNCTION public.release_presentation_asset(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_presentation_asset(uuid, uuid, text) TO service_role;

-- ─────────────── 5) Apresentações: sem INSERT do cliente ───────────────
-- A geração grava a apresentação no servidor (service_role). Uma linha criada
-- pelo cliente servia só para renovar cotas por apresentação à vontade.
DROP POLICY IF EXISTS "presentations_owner_all" ON public.presentations;
DROP POLICY IF EXISTS "presentations_owner_select" ON public.presentations;
DROP POLICY IF EXISTS "presentations_owner_update" ON public.presentations;
DROP POLICY IF EXISTS "presentations_owner_delete" ON public.presentations;
CREATE POLICY "presentations_owner_select" ON public.presentations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "presentations_owner_update" ON public.presentations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presentations_owner_delete" ON public.presentations
  FOR DELETE USING (auth.uid() = user_id);
