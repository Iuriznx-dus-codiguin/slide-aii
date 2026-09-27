# Correções da revisão — o que aplicar fora do repositório

O código destas correções está no PR da branch `claude/cool-archimedes-fay1ug`
(relatório em `docs/revisao/2026-09-26-revisao-geral.md`). Três coisas não se
aplicam por commit:

1. **O segredo do webhook da Cakto.** É configuração, sem código. Este é o
   passo mais importante, porque sem ele nenhuma compra real libera créditos.
2. **A migração do banco.**
3. **O deploy das cinco edge functions alteradas.**

## 1. Segredo do webhook da Cakto (você mesmo, antes do prompt)

Desde 07/08, a Cakto envia um segredo diferente do `CAKTO_WEBHOOK_SECRET` do
servidor. Foram 39 recusas registradas em `security_events`, e o último
"enviar teste de todos os eventos" foi recusado inteiro.

1. No painel da Cakto, abra o webhook do SlideAI e copie o valor do campo
   **segredo/token**.
2. No Lovable (Cloud → Secrets), cole esse mesmo valor em
   `CAKTO_WEBHOOK_SECRET`. O campo aceita mais de um valor separado por
   vírgula, então dá para manter o antigo durante a troca.
3. No painel da Cakto, use **Enviar teste** e confirme que o evento aparece em
   `payment_events` (etapa 4 do prompt abaixo).
4. Antes de abrir as vendas, faça uma **compra real** de ponta a ponta com uma
   conta de teste e depois o reembolso dela.

## 2. Prompt para o Lovable (depois do merge do PR na `main`)

Cole o bloco inteiro:

```text
Contexto: a main recebeu as correções da revisão geral do SlideAI (commit
"fix: correções da revisão geral…"). O código está pronto e revisado. NÃO
reescreva, refatore nem "corrija" arquivos de código. A tarefa é só aplicar o
que não entra por commit, validar e me reportar. Se alguma etapa falhar, pare
e me mostre o erro exato.

ETAPA 1 — Migração
Aplique a migração drizzle/migrations/0002_platform_review_fixes.sql (é o mesmo
conteúdo de supabase/migrations/20260927000100_platform_review_fixes.sql). Ela
é idempotente. Se precisar executá-la à mão, o SQL é exatamente este:

-- início do SQL
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
--    Corpo idêntico ao anterior além do bloco de guarda e do ciclo mensal (4).
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

  -- Saldo mensal efetivo (reset preguiçoso calculado, não persistido).
  -- Ciclo de 1 mês a partir da ativação (ver ensure_monthly_credits).
  IF _is_sub AND (_profile.credits_cycle_anchor IS NULL OR _profile.credits_cycle_anchor + interval '1 month' <= now()) THEN
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


-- 4) Cota mensal por CICLO DA ASSINATURA, não por mês-calendário.
--    O reset preguiçoso usava o dia 1º de cada mês e o webhook redefinia a
--    cota também na data de renovação: um plano mensal recarregava DUAS vezes
--    por mês (dia 1º e dia da renovação). Agora credits_cycle_anchor é o
--    início do ciclo atual; a cota renova 1 mês depois dele (a ativação e a
--    renovação reancoram no dia do pagamento). Âncoras antigas (dia 1º)
--    continuam válidas: viram ciclos que começam no dia 1º.
CREATE OR REPLACE FUNCTION public.ensure_monthly_credits(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.profiles%ROWTYPE;
  _alloc integer;
  _anchor date;
BEGIN
  SELECT * INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  _alloc := public.plan_monthly_credits(_p.plan);
  IF _alloc <= 0 THEN RETURN; END IF;
  IF _p.credits_cycle_anchor IS NOT NULL AND _p.credits_cycle_anchor + interval '1 month' > now() THEN
    RETURN;
  END IF;
  _anchor := COALESCE(_p.credits_cycle_anchor, current_date);
  WHILE _anchor + interval '1 month' <= now() LOOP
    _anchor := (_anchor + interval '1 month')::date;
  END LOOP;
  UPDATE public.profiles
     SET credits_monthly = _alloc, credits_cycle_anchor = _anchor
   WHERE id = _uid;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
  VALUES (_uid, 'monthly_reset', _alloc, COALESCE(_p.credits_bonus, 0), _alloc,
          jsonb_build_object('cycle_start', _anchor));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_monthly_credits(_uid uuid, _amount integer, _type text DEFAULT 'monthly_grant')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _b integer; _m integer;
BEGIN
  -- Ativação/renovação reancora o ciclo no dia do pagamento.
  UPDATE public.profiles
     SET credits_monthly = _amount, credits_cycle_anchor = current_date
   WHERE id = _uid
   RETURNING credits_bonus, credits_monthly INTO _b, _m;
  IF _m IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after)
  VALUES (_uid, _type, _amount, COALESCE(_b, 0), _m);
  RETURN _m;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_monthly_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_monthly_credits(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.set_monthly_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_monthly_credits(uuid, integer, text) TO service_role;

-- 5) Cota do chat de edição guardada no SERVIDOR.
--    Os contadores (10 mensagens / 3 edições complexas por apresentação)
--    vinham do navegador: enviar 0 dava edições ilimitadas por IA.
ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS ai_edit_messages integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_edit_complex integer NOT NULL DEFAULT 0;

-- O dono pode ler, mas só o servidor altera os contadores.
CREATE OR REPLACE FUNCTION public.protect_ai_edit_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (NEW.ai_edit_messages IS DISTINCT FROM OLD.ai_edit_messages
          OR NEW.ai_edit_complex IS DISTINCT FROM OLD.ai_edit_complex
          OR NEW.speech_regen_count IS DISTINCT FROM OLD.speech_regen_count) THEN
    RAISE EXCEPTION 'Contadores de uso de IA não podem ser alterados pelo cliente.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_ai_edit_usage ON public.presentations;
CREATE TRIGGER trg_protect_ai_edit_usage BEFORE UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.protect_ai_edit_usage();

CREATE OR REPLACE FUNCTION public.add_ai_edit_usage(_presentation_id uuid, _uid uuid, _complex boolean)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.presentations
     SET ai_edit_messages = ai_edit_messages + 1,
         ai_edit_complex = ai_edit_complex + CASE WHEN _complex THEN 1 ELSE 0 END
   WHERE id = _presentation_id AND user_id = _uid
  RETURNING jsonb_build_object('messages', ai_edit_messages, 'complex_edits', ai_edit_complex);
$$;
REVOKE ALL ON FUNCTION public.add_ai_edit_usage(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_ai_edit_usage(uuid, uuid, boolean) TO service_role;
-- fim do SQL

Depois confirme com estas consultas e me mostre o resultado:
  SELECT indexname FROM pg_indexes WHERE tablename = 'payment_events' AND indexname LIKE 'idx_payment_events_%';
     -- deve listar idx_payment_events_event_cakto_unique e NÃO listar idx_payment_events_cakto_id_unique
  SELECT has_function_privilege('authenticated', 'public.revoke_order_credits(uuid,text,integer,boolean,text)', 'EXECUTE');
     -- deve ser false
  SELECT prosrc LIKE '%auth.role() IS DISTINCT FROM%' FROM pg_proc WHERE proname = 'can_user_generate';
     -- deve ser true
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'presentations' AND column_name IN ('ai_edit_messages','ai_edit_complex');
     -- deve listar as duas colunas
  SELECT prosrc LIKE '%interval ''1 month''%' FROM pg_proc WHERE proname = 'ensure_monthly_credits';
     -- deve ser true (cota mensal por ciclo da assinatura)

ETAPA 2 — Tipos
src/integrations/supabase/types.ts já inclui revoke_order_credits, add_ai_edit_usage
e as colunas ai_edit_messages/ai_edit_complex. Se
regenerar, a única diferença esperada é ordem/formatação.

ETAPA 3 — Deploy das edge functions
Faça o deploy destas cinco funções (elas usam módulos de supabase/functions/_shared,
que vão junto no bundle):
  - cakto-webhook
  - generate-presentation
  - fetch-image
  - chat-editor
  - regenerate-speeches
As demais não mudaram (_shared/observability.ts só ganhou um tipo novo).
Não altere verify_jwt nem o config.toml.

ETAPA 4 — Build, testes e verificação
  1. npm run build → sem erro.
  2. npm test (vitest) → as suítes novas src/test/caktoWebhook.test.ts e
     src/test/speakerNotes.test.ts devem passar junto com as existentes.
     (Os dois testes *.e2e.test.ts dependem de variáveis de ambiente, como antes.)
  3. Rode e me mostre:
     SELECT created_at, event_type, processed, left(coalesce(error_message,''),60) AS erro
       FROM public.payment_events ORDER BY created_at DESC LIMIT 5;
     SELECT created_at, event_type, left(detail::text, 120) FROM public.security_events
      WHERE event_type IN ('webhook_invalid_secret','webhook_refund_review') ORDER BY created_at DESC LIMIT 5;

Não mude código para "melhorar" nada que eu não pedi. Se algo divergir do
esperado, descreva o que viu e pare.
```

## 3. O que muda para os usuários

- **Reembolsos e chargebacks** passam a ser processados (antes eram descartados
  como duplicata) e desfazem só o que aquele pedido concedeu. Um caso ambíguo
  fica marcado em `payment_events.error_message` como `refund_needs_review:…` e
  em `security_events` (`webhook_refund_review`), para revisão manual.
- **Orçamento de imagem** é decidido no servidor. Usuários comuns ficam no modo
  equilibrado (o padrão de sempre); o teto do Dev Mode só vale para
  desenvolvedores. Imagem por IA fora da cota de uma apresentação exige plano
  ativo.
- **Motor da geração:** só desenvolvedores escolhem (Dev Mode). Para os demais
  vale `ENGINE_V2_ROLLOUT_PERCENT`.
- **Notas do orador:** completadas só quando o usuário escolheu (e pagou) as falas.
- **Cota mensal** renova 1 mês depois da ativação/renovação (antes: dia 1º + dia
  da renovação, duas recargas por mês).
- **Avulso com assinatura vencida** passa a valer; com assinatura cancelada, a
  sobra da cota mensal antiga não volta.
- **Eventos de recusa ou cobrança só gerada** nunca contam como pagamento.
- **Regenerar falas** volta a funcionar (estava quebrado) e só para decks que
  pagaram as falas.
- **Chat de edição:** a cota por apresentação passa a ser contada no servidor.
- **Imagens pendentes** também são resolvidas quando o dono abre a apresentação
  no modo apresentação, não só no Editor.
- **Editor:** abrir o de uma apresentação de outra pessoa redireciona para o
  modo apresentação.
- **Dashboard:** as capas saem com o tema certo e carregam em uma consulta só.
