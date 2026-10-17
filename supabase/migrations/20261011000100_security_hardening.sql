-- Auditoria de segurança de 11/10/2026 (docs/revisao/2026-10-11-auditoria-de-seguranca.md).
--
-- 1. Gatilhos de proteção passam a decidir por `current_user`, não por
--    `auth.role()`. Escritas diretas da API rodam como `anon`/`authenticated`;
--    funções SECURITY DEFINER do próprio banco rodam como o dono (postgres).
--    Com `auth.role()`, o pg_cron (sem JWT) e o record_access (JWT do usuário)
--    eram barrados ao estornar gerações interrompidas, e o estorno automático
--    nunca acontecia — junto com ele, o registro de acesso do Marco Civil.
-- 2. profiles: e-mail (destinatário de todos os e-mails da plataforma e chave
--    do webhook de pagamento) e contadores deixam de ser graváveis pelo
--    cliente; o e-mail acompanha o de auth.users.
-- 3. presentations: campos decididos pelo servidor (falas pagas, contadores
--    de IA, visualizações) não são mais graváveis pelo cliente, nem no INSERT.
-- 4. Apresentações nascem PRIVADAS (Termos, seção 12) e deixam de ser
--    listáveis pela API: a leitura pública passa a exigir o slug exato
--    (get_shared_presentation). A visualização é registrada por RPC com limite.
-- 5. Suporte: conversas só pelo servidor; o usuário só escreve mensagens
--    como "user" e só altera a nota (rating) do próprio atendimento.
-- 6. Reserva atômica das cotas por apresentação (falas e chat de edição) e
--    crédito avulso idempotente por pedido.
-- 7. Storage: avatares deixam de ser listáveis por qualquer pessoa; limites de
--    tamanho e tipo nos buckets.
-- 8. Revisão adversarial (seção 6 do relatório): créditos ligados ao pedido
--    que os concedeu (cota mensal idempotente, bônus de ativação estornado só
--    pelo pedido que o deu, nada de crédito depois do estorno), estorno de
--    geração limitado ao ciclo, varredura que respeita estornos manuais,
--    pedidos de acesso ao portfólio só para quem os aceita, e has_role fora
--    do alcance de anônimos. Linhas antigas que já passavam dos novos
--    limites são corrigidas antes das restrições.
--
-- Idempotente: pode ser aplicada de novo sem efeito colateral.

-- ─────────────── 1 e 2. profiles ───────────────

CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Só escritas diretas da API (PostgREST) são de cliente. SECURITY INVOKER de
  -- propósito: dentro de uma função SECURITY DEFINER, current_user seria o dono.
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
       OR NEW.subscription_period_start IS DISTINCT FROM OLD.subscription_period_start
       OR NEW.subscription_renews_at IS DISTINCT FROM OLD.subscription_renews_at
       OR NEW.credits_bonus IS DISTINCT FROM OLD.credits_bonus
       OR NEW.credits_monthly IS DISTINCT FROM OLD.credits_monthly
       OR NEW.credits_cycle_anchor IS DISTINCT FROM OLD.credits_cycle_anchor
       OR NEW.cakto_customer_id IS DISTINCT FROM OLD.cakto_customer_id
       OR NEW.cakto_subscription_id IS DISTINCT FROM OLD.cakto_subscription_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.generations_count IS DISTINCT FROM OLD.generations_count
       OR NEW.total_views IS DISTINCT FROM OLD.total_views
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

-- O perfil é criado só por handle_new_user (SECURITY DEFINER). Um INSERT do
-- cliente escaparia do gatilho acima (que é de UPDATE) com plano e créditos
-- quaisquer; nenhuma tela insere perfis.
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
REVOKE INSERT ON public.profiles FROM anon, authenticated;

-- profiles.email acompanha o e-mail da conta (troca confirmada no Auth).
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = lower(NEW.email) WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Desfaz e-mails trocados pelo cliente antes desta correção.
UPDATE public.profiles p
   SET email = lower(u.email)
  FROM auth.users u
 WHERE u.id = p.id
   AND u.email IS NOT NULL
   AND p.email IS DISTINCT FROM lower(u.email);

-- ─────────────── 3. presentations: campos do servidor ───────────────

CREATE OR REPLACE FUNCTION public.protect_presentation_server_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Deck criado pelo cliente começa sem uso de IA e sem falas pagas: as
    -- falas (+50 créditos) só são concedidas pela geração no servidor.
    NEW.ai_edit_messages := 0;
    NEW.ai_edit_complex := 0;
    NEW.speech_regen_count := 0;
    NEW.view_count := 0;
    NEW.include_speeches := false;
    -- Deck "pago" (com cota de chat de edição) e brief criativo só vêm da
    -- geração no servidor: um INSERT direto renovava a cota do chat de graça a
    -- cada linha nova, e o brief entra no prompt da IA.
    NEW.is_paid := false;
    NEW.creative_brief := NULL;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.ai_edit_messages IS DISTINCT FROM OLD.ai_edit_messages
     OR NEW.ai_edit_complex IS DISTINCT FROM OLD.ai_edit_complex
     OR NEW.speech_regen_count IS DISTINCT FROM OLD.speech_regen_count
     OR NEW.include_speeches IS DISTINCT FROM OLD.include_speeches
     OR NEW.view_count IS DISTINCT FROM OLD.view_count
     OR NEW.is_paid IS DISTINCT FROM OLD.is_paid
     OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
     OR NEW.creative_brief IS DISTINCT FROM OLD.creative_brief
  THEN
    RAISE EXCEPTION 'Campos definidos pelo servidor não podem ser alterados pelo cliente.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_ai_edit_usage ON public.presentations;
DROP FUNCTION IF EXISTS public.protect_ai_edit_usage();
DROP TRIGGER IF EXISTS trg_protect_presentation_server_fields ON public.presentations;
CREATE TRIGGER trg_protect_presentation_server_fields
  BEFORE INSERT OR UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.protect_presentation_server_fields();

-- Contadores negativos gravados pelo INSERT antigo do cliente: zerados antes
-- da restrição. Uma CHECK, mesmo NOT VALID, é conferida em todo UPDATE da
-- linha; sem isto, o deck deixaria de aceitar qualquer alteração (lixeira,
-- publicar, reserva do chat). Os gatilhos de proteção só valem para o cliente.
UPDATE public.presentations
   SET ai_edit_messages = GREATEST(ai_edit_messages, 0),
       ai_edit_complex = GREATEST(ai_edit_complex, 0),
       speech_regen_count = GREATEST(speech_regen_count, 0)
 WHERE ai_edit_messages < 0 OR ai_edit_complex < 0 OR speech_regen_count < 0;

DO $do$
BEGIN
  ALTER TABLE public.presentations
    ADD CONSTRAINT presentations_ai_usage_nonnegative
    CHECK (ai_edit_messages >= 0 AND ai_edit_complex >= 0 AND speech_regen_count >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;
ALTER TABLE public.presentations VALIDATE CONSTRAINT presentations_ai_usage_nonnegative;

-- Título, tipo, tema e brief entram nos prompts do chat de edição e das falas.
-- Sem teto, um título de megabytes virava ~1M de tokens por chamada. Os limites
-- ficam muito acima do que as telas e a geração gravam (título 200, tipo 80,
-- descrição 1500; tema e brief têm poucos KB). Linhas que já passavam do
-- limite (só possíveis pela API) são cortadas antes, pelo mesmo motivo do
-- bloco acima; tema e brief acima do teto voltam ao padrão (NULL).
UPDATE public.presentations
   SET title = left(title, 300),
       type = left(type, 200),
       description = left(description, 5000),
       dynamic_theme = CASE WHEN pg_column_size(dynamic_theme) > 16384 THEN NULL ELSE dynamic_theme END,
       creative_brief = CASE WHEN pg_column_size(creative_brief) > 32768 THEN NULL ELSE creative_brief END
 WHERE char_length(title) > 300
    OR char_length(type) > 200
    OR char_length(description) > 5000
    OR pg_column_size(dynamic_theme) > 16384
    OR pg_column_size(creative_brief) > 32768;

DO $do$
BEGIN
  ALTER TABLE public.presentations
    ADD CONSTRAINT presentations_prompt_field_sizes
    CHECK (
      char_length(title) <= 300
      AND char_length(type) <= 200
      AND char_length(description) <= 5000
      AND pg_column_size(dynamic_theme) <= 16384
      AND pg_column_size(creative_brief) <= 32768
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;
ALTER TABLE public.presentations VALIDATE CONSTRAINT presentations_prompt_field_sizes;

-- ─────────────── 4. Apresentações privadas por padrão ───────────────

ALTER TABLE public.presentations ALTER COLUMN is_published SET DEFAULT false;

-- Sem isto, GET /rest/v1/presentations (e /slides) devolvia TODAS as
-- apresentações publicadas de todos os usuários — e todas nasciam publicadas.
DROP POLICY IF EXISTS "presentations_public_read" ON public.presentations;
DROP POLICY IF EXISTS "slides_public_read" ON public.slides;

-- Visualizador (/slides/:slug): uma apresentação pelo slug exato, se estiver
-- publicada e fora da lixeira, ou se for do próprio usuário. Não devolve o
-- user_id do autor (só is_owner).
CREATE OR REPLACE FUNCTION public.get_shared_presentation(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.presentations%ROWTYPE;
BEGIN
  IF _slug IS NULL OR length(_slug) = 0 OR length(_slug) > 200 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO _p
    FROM public.presentations pr
   WHERE pr.slug = _slug
     AND ((pr.is_published AND pr.deleted_at IS NULL) OR (_uid IS NOT NULL AND pr.user_id = _uid));
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'presentation', jsonb_build_object(
      'id', _p.id,
      'title', _p.title,
      'description', _p.description,
      'theme', _p.theme,
      'font_style', _p.font_style,
      'slug', _p.slug,
      'include_speeches', _p.include_speeches,
      'presenters_names', _p.presenters_names,
      'dynamic_theme', _p.dynamic_theme,
      'creative_brief', _p.creative_brief,
      'is_published', _p.is_published,
      'is_owner', _uid IS NOT NULL AND _p.user_id = _uid
    ),
    'slides', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id,
               'position', s.position,
               'slide_type', s.slide_type,
               'layout_template', s.layout_template,
               'content', s.content,
               'speaker_notes', s.speaker_notes,
               'presenters_data', s.presenters_data
             ) ORDER BY s.position)
        FROM public.slides s
       WHERE s.presentation_id = _p.id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_presentation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_presentation(text) TO anon, authenticated, service_role;

-- Segredo para pseudonimizar o IP nas chaves de limite (o IP nunca é gravado).
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'rate_limit_pepper') THEN
    -- gen_random_uuid é nativo (não depende do pgcrypto no search_path).
    PERFORM vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'rate_limit_pepper',
                                'Pseudonimização do IP nas chaves de rate limit');
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Vault indisponível (%): rate_limit_subject usa só o hash do IP.', SQLERRM;
END
$do$;

CREATE OR REPLACE FUNCTION public.rate_limit_subject()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pepper text := '';
BEGIN
  BEGIN
    SELECT decrypted_secret INTO _pepper FROM vault.decrypted_secrets WHERE name = 'rate_limit_pepper' LIMIT 1;
  EXCEPTION WHEN others THEN
    _pepper := '';
  END;
  RETURN md5(COALESCE(_pepper, '') || ':' || COALESCE(public.request_client_info()->>'ip', 'unknown'));
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_subject() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_subject() TO service_role;

-- Visualização: mesma regra da política antiga (publicada, ou do dono, e fora
-- da lixeira), agora com teto por visitante: 30 por hora na mesma
-- apresentação e 300 por hora no total. Sem isso, um script anônimo inflava o
-- contador (e a tabela) sem limite.
CREATE OR REPLACE FUNCTION public.record_presentation_view(_presentation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _who text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.presentations p
     WHERE p.id = _presentation_id
       AND p.deleted_at IS NULL
       AND (p.is_published OR p.user_id = auth.uid())
  ) THEN
    RETURN false;
  END IF;
  _who := public.rate_limit_subject();
  IF NOT public.check_rate_limit('view:' || _who, 'record_presentation_view', 300) THEN
    RETURN false;
  END IF;
  IF NOT public.check_rate_limit('view:' || _who || ':' || _presentation_id::text, 'record_presentation_view', 30) THEN
    RETURN false;
  END IF;
  INSERT INTO public.slide_views(presentation_id, user_agent)
  VALUES (_presentation_id, left(public.request_client_info()->>'user_agent', 300));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_presentation_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_presentation_view(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "views_anyone_insert" ON public.slide_views;
DROP POLICY IF EXISTS "views_published_insert" ON public.slide_views;
REVOKE INSERT, UPDATE, DELETE ON public.slide_views FROM anon, authenticated;

-- Métricas do painel da equipe. Sem leitura ampla de presentations/slides, as
-- contagens vêm daqui (antes elas misturavam os decks do próprio admin com os
-- publicados de terceiros).
CREATE OR REPLACE FUNCTION public.get_content_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _since timestamptz := now() - interval '24 hours';
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'presentations_total', (SELECT count(*) FROM public.presentations),
    'slides_total', (SELECT count(*) FROM public.slides),
    'presentations_24h', (SELECT count(*) FROM public.presentations WHERE created_at >= _since),
    'slides_24h', (SELECT count(*) FROM public.slides WHERE created_at >= _since),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('title', r.title, 'created_at', r.created_at, 'slides_count', r.slides_count))
        FROM (SELECT title, created_at, slides_count FROM public.presentations ORDER BY created_at DESC LIMIT 8) r
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_content_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_content_metrics() TO authenticated, service_role;

-- Uso interno das funções de portfólio; chamada direta permitia consultar,
-- para qualquer par de contas, se uma tem acesso ao portfólio da outra.
REVOKE ALL ON FUNCTION public.can_view_portfolio(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_portfolio(uuid, uuid) TO service_role;

-- ─────────────── 5. Suporte ───────────────

-- Conversas são abertas só pelo support-chat (servidor), que gera o ticket.
-- O INSERT direto deixava o usuário criar conversas com qualquer estado e
-- ocupar ticket_ids futuros (TCK-xxxxxx da sequência): o atendimento seguinte
-- de outra pessoa falhava na chave única. Também inundava a fila da equipe.
DROP POLICY IF EXISTS "conv_own_insert" ON public.support_conversations;
REVOKE INSERT ON public.support_conversations FROM anon, authenticated;

-- Números já ocupados pelo INSERT antigo: a sequência passa do maior ticket
-- existente, senão cada número ocupado derrubaria a abertura de um atendimento
-- de verdade. E o número deixa de ser cortado em 6 dígitos (lpad truncava
-- 1000000 para "100000", voltando a números já usados).
DO $do$
DECLARE
  _max bigint;
BEGIN
  SELECT max(substring(ticket_id FROM 5)::bigint) INTO _max
    FROM public.support_conversations
   WHERE ticket_id ~ '^TCK-[0-9]{1,18}$';
  IF _max IS NOT NULL AND _max >= (SELECT last_value FROM public.support_ticket_seq) THEN
    PERFORM setval('public.support_ticket_seq', _max, true);
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION public.generate_ticket_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _n bigint;
BEGIN
  _n := nextval('public.support_ticket_seq');
  RETURN 'TCK-' || CASE WHEN _n < 1000000 THEN lpad(_n::text, 6, '0') ELSE _n::text END;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_ticket_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ticket_id() TO service_role;

-- Mensagens do usuário entram pelo support-chat (servidor). Escrita direta só
-- como "user": antes dava para inserir "assistant"/"system" no próprio
-- atendimento (falso "reembolso aprovado" para a equipe e injeção no histórico).
DROP POLICY IF EXISTS "msg_own_insert" ON public.support_messages;
CREATE POLICY "msg_own_insert" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    role = 'user'
    AND EXISTS (SELECT 1 FROM public.support_conversations c
                 WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

-- O dono só avalia o atendimento (SupportWidget grava `rating`); estado,
-- escalonamento e resolução são da equipe ou do servidor.
CREATE OR REPLACE FUNCTION public.protect_support_conversation_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
     AND (to_jsonb(NEW) - 'rating' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'rating' - 'updated_at')
  THEN
    RAISE EXCEPTION 'Só a avaliação do atendimento pode ser alterada.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_support_conversation_fields ON public.support_conversations;
CREATE TRIGGER trg_protect_support_conversation_fields
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.protect_support_conversation_fields();

-- ─────────────── 6. Cotas por apresentação e crédito por pedido ───────────────

-- Regenerar falas: reserva a vaga ANTES da chamada de IA. Ler o contador,
-- chamar a IA e só então gravar deixava pedidos em paralelo passarem do teto.
CREATE OR REPLACE FUNCTION public.reserve_speech_regen(_presentation_id uuid, _uid uuid, _max integer)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.presentations
     SET speech_regen_count = speech_regen_count + 1
   WHERE id = _presentation_id
     AND user_id = _uid
     AND include_speeches
     AND speech_regen_count < _max
  RETURNING speech_regen_count;
$$;

CREATE OR REPLACE FUNCTION public.release_speech_regen(_presentation_id uuid, _uid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.presentations
     SET speech_regen_count = GREATEST(speech_regen_count - 1, 0)
   WHERE id = _presentation_id AND user_id = _uid;
$$;

-- Chat de edição: mesma reserva atômica (10 mensagens OU 3 complexas).
CREATE OR REPLACE FUNCTION public.reserve_ai_edit_usage(
  _presentation_id uuid, _uid uuid, _complex boolean, _max_messages integer, _max_complex integer
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.presentations
     SET ai_edit_messages = ai_edit_messages + 1,
         ai_edit_complex = ai_edit_complex + CASE WHEN _complex THEN 1 ELSE 0 END
   WHERE id = _presentation_id
     AND user_id = _uid
     AND ai_edit_messages < _max_messages
     AND ai_edit_complex < _max_complex
  RETURNING jsonb_build_object('messages', ai_edit_messages, 'complex_edits', ai_edit_complex);
$$;

CREATE OR REPLACE FUNCTION public.release_ai_edit_usage(_presentation_id uuid, _uid uuid, _complex boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.presentations
     SET ai_edit_messages = GREATEST(ai_edit_messages - 1, 0),
         ai_edit_complex = GREATEST(ai_edit_complex - CASE WHEN _complex THEN 1 ELSE 0 END, 0)
   WHERE id = _presentation_id AND user_id = _uid;
$$;

-- Compra avulsa: o crédito é concedido uma vez por PEDIDO, qualquer que seja o
-- evento que o traga. A idempotência do webhook é por (evento, pedido): um
-- segundo evento "pago" do mesmo pedido (tipo novo da Cakto classificado pela
-- heurística, por exemplo) creditava os 500 de novo.
CREATE OR REPLACE FUNCTION public.grant_order_bonus_credits(_uid uuid, _order_id text, _amount integer, _type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _b integer;
  _m integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 OR COALESCE(_order_id, '') = '' THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'invalid');
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_profile');
  END IF;
  -- Estorno processado antes da aprovação (entrega da aprovação falhou e a
  -- Cakto reenviou depois): o pedido já foi devolvido, não há o que creditar.
  -- Vem antes de "já concedido" para o webhook saber que é um reembolso.
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
     WHERE user_id = _uid AND type = 'refund_revoke' AND metadata->>'order_id' = _order_id
  ) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_refunded');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
     WHERE user_id = _uid AND type = _type AND metadata->>'order_id' = _order_id
  ) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END IF;
  UPDATE public.profiles
     SET credits_bonus = COALESCE(credits_bonus, 0) + _amount
   WHERE id = _uid
  RETURNING credits_bonus, credits_monthly INTO _b, _m;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
  VALUES (_uid, _type, _amount, _b, COALESCE(_m, 0), jsonb_build_object('order_id', _order_id));
  RETURN jsonb_build_object('granted', true, 'amount', _amount, 'balance_bonus', _b);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_speech_regen(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_speech_regen(uuid, uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.release_speech_regen(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_speech_regen(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_ai_edit_usage(uuid, uuid, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_edit_usage(uuid, uuid, boolean, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.release_ai_edit_usage(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_ai_edit_usage(uuid, uuid, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.grant_order_bonus_credits(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_order_bonus_credits(uuid, text, integer, text) TO service_role;

-- ─────────────── 7. Storage ───────────────

-- A leitura de avatares era aberta a qualquer pessoa (inclusive anônimos): a
-- listagem do bucket entregava o UUID de todo usuário com foto. A foto exibida
-- usa URL assinada, que não depende desta política; o dono precisa ler a
-- própria pasta para gerar a URL e para o upsert.
DROP POLICY IF EXISTS "avatars_read_auth" ON storage.objects;
DROP POLICY IF EXISTS "avatars_read_own" ON storage.objects;
CREATE POLICY "avatars_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Limites no próprio bucket (o cliente e o assetStorage já checam; aqui vale
-- também para quem chama a API de Storage direto).
DO $do$
BEGIN
  UPDATE storage.buckets
     SET file_size_limit = 4 * 1024 * 1024,
         allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
   WHERE id = 'avatars';
  UPDATE storage.buckets
     SET file_size_limit = 12 * 1024 * 1024,
         allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/jpg', 'image/avif']
   WHERE id = 'slide-images';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Limites de bucket não aplicados (%): configure no painel de Storage.', SQLERRM;
END
$do$;

-- ─────────────── 8. Revisão adversarial: créditos e webhook ───────────────

-- Buscas do webhook por pedido e pelo e-mail usado na compra (a conta pode ter
-- trocado de e-mail depois: profiles.email acompanha auth.users).
CREATE INDEX IF NOT EXISTS idx_payment_events_cakto_id
  ON public.payment_events (cakto_id) WHERE cakto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_user_email
  ON public.payment_events (user_email) WHERE user_email IS NOT NULL;

-- Cota mensal uma vez por PEDIDO. set_monthly_credits redefinia a cota a cada
-- evento "pago" da assinatura: purchase_approved e subscription_created do
-- mesmo pedido (ou um reenvio tardio) devolviam a cota já gasta entre os dois.
-- Guarda pedido e assinatura na transação (base do estorno ligado ao pedido).
CREATE OR REPLACE FUNCTION public.grant_monthly_for_order(
  _uid uuid, _order_id text, _subscription_id text, _amount integer, _type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _b integer;
  _m integer;
BEGIN
  IF _amount IS NULL OR _amount < 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'invalid');
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_profile');
  END IF;
  IF COALESCE(_order_id, '') <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE user_id = _uid AND type = 'refund_revoke' AND metadata->>'order_id' = _order_id
    ) THEN
      RETURN jsonb_build_object('granted', false, 'reason', 'already_refunded');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE user_id = _uid AND type IN ('subscription_monthly', 'subscription_renewal')
         AND metadata->>'order_id' = _order_id
    ) THEN
      RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
    END IF;
  END IF;
  -- Ativação/renovação reancora o ciclo no dia do pagamento (set_monthly_credits).
  UPDATE public.profiles
     SET credits_monthly = _amount, credits_cycle_anchor = current_date
   WHERE id = _uid
  RETURNING credits_bonus, credits_monthly INTO _b, _m;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
  VALUES (_uid, _type, _amount, COALESCE(_b, 0), _m,
          jsonb_strip_nulls(jsonb_build_object('order_id', NULLIF(_order_id, ''), 'subscription_id', NULLIF(_subscription_id, ''))));
  RETURN jsonb_build_object('granted', true, 'amount', _amount, 'balance_monthly', _m);
END;
$$;

-- Bônus de ativação: mesma regra (uma vez por conta), agora guardando o pedido
-- e a assinatura que o concederam. Sem isso, o estorno de QUALQUER pedido de
-- assinatura (renovação, reassinatura sem bônus) retirava o bônus inteiro,
-- levando junto créditos avulsos pagos. O parâmetro novo tem padrão: chamadas
-- antigas com três argumentos continuam valendo.
DROP FUNCTION IF EXISTS public.grant_bonus_credits_once(uuid, integer, text);
CREATE OR REPLACE FUNCTION public.grant_bonus_credits_once(
  _uid uuid, _amount integer, _type text, _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _b integer;
  _m integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'noop');
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_profile');
  END IF;
  -- Ativação de um pedido (ou assinatura) que já foi reembolsado: a aprovação
  -- chegou depois do estorno. Não há bônus a dar.
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
     WHERE user_id = _uid AND type = 'refund_revoke'
       AND ((COALESCE(_metadata->>'order_id', '') <> '' AND metadata->>'order_id' = _metadata->>'order_id')
         OR (COALESCE(_metadata->>'subscription_id', '') <> '' AND metadata->>'subscription_id' = _metadata->>'subscription_id'))
  ) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_refunded');
  END IF;
  IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE user_id = _uid AND type = _type) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END IF;
  UPDATE public.profiles
     SET credits_bonus = COALESCE(credits_bonus, 0) + _amount
   WHERE id = _uid
  RETURNING credits_bonus, credits_monthly INTO _b, _m;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata)
  VALUES (_uid, _type, _amount, _b, COALESCE(_m, 0), COALESCE(jsonb_strip_nulls(_metadata), '{}'::jsonb));
  RETURN jsonb_build_object('granted', true, 'amount', _amount, 'balance_bonus', _b);
END;
$$;

-- Quanto uma assinatura (ou, sem assinatura no evento, o pedido) concedeu de
-- crédito bônus do tipo dado, menos o que outro estorno dela já retirou: é o
-- teto do estorno. O reembolso de uma
-- assinatura cancela aquela assinatura; o bônus de OUTRA (a primeira, já
-- gasto) não entra, nem os créditos avulsos. Concessões anteriores a esta
-- migração não guardavam a ligação: conta a que aconteceu junto (±10 min) de
-- um evento de pagamento da mesma assinatura (ou do mesmo pedido).
CREATE OR REPLACE FUNCTION public.order_granted_bonus(
  _uid uuid, _order_id text, _subscription_id text, _type text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH k AS (SELECT COALESCE(_order_id, '') AS ord, COALESCE(_subscription_id, '') AS sub),
  granted AS (
    SELECT COALESCE(sum(ct.amount), 0)::integer AS total
      FROM public.credit_transactions ct, k
     WHERE ct.user_id = _uid AND ct.type = _type AND ct.amount > 0
       AND (
         (k.sub <> '' AND ct.metadata->>'subscription_id' = k.sub)
         OR (k.sub = '' AND k.ord <> '' AND ct.metadata->>'order_id' = k.ord)
         OR (NOT (COALESCE(ct.metadata, '{}'::jsonb) ?| ARRAY['order_id', 'subscription_id'])
             AND EXISTS (
               SELECT 1 FROM public.payment_events pe
                WHERE pe.user_id = _uid
                  AND pe.created_at BETWEEN ct.created_at - interval '10 minutes'
                                        AND ct.created_at + interval '10 minutes'
                  AND ((k.sub <> '' AND (pe.payload @> jsonb_build_object('data', jsonb_build_object('subscription', jsonb_build_object('id', k.sub)))
                                         OR pe.payload @> jsonb_build_object('subscription', jsonb_build_object('id', k.sub))))
                       OR (k.sub = '' AND k.ord <> '' AND pe.cakto_id = k.ord))))
       )
  ),
  -- Bônus já retirado por outro reembolso/chargeback da mesma assinatura (ou
  -- do mesmo pedido): sem isto, cada pedido reembolsado da assinatura tirava o
  -- bônus de novo, levando créditos avulsos pagos.
  revoked AS (
    SELECT COALESCE(sum(COALESCE((ct.metadata->>'revoked_bonus')::integer, 0)), 0)::integer AS total
      FROM public.credit_transactions ct, k
     WHERE ct.user_id = _uid AND ct.type = 'refund_revoke'
       AND ((k.sub <> '' AND ct.metadata->>'subscription_id' = k.sub)
         OR (k.sub = '' AND k.ord <> '' AND ct.metadata->>'order_id' = k.ord))
  )
  SELECT GREATEST(granted.total - revoked.total, 0) FROM granted, revoked
$$;

-- Estorno por pedido, agora guardando também a assinatura: é o que permite
-- descontar o bônus já retirado (order_granted_bonus) e reconhecer a
-- aprovação atrasada de uma assinatura reembolsada. O parâmetro novo tem
-- padrão: chamadas com cinco argumentos continuam valendo. Corpo igual ao da
-- 0002 fora isso.
DROP FUNCTION IF EXISTS public.revoke_order_credits(uuid, text, integer, boolean, text);
CREATE OR REPLACE FUNCTION public.revoke_order_credits(
  _uid uuid,
  _order_id text,
  _revoke_bonus integer,
  _zero_monthly boolean,
  _type text DEFAULT 'refund_revoke',
  _subscription_id text DEFAULT NULL
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
    jsonb_strip_nulls(jsonb_build_object('order_id', _order_id, 'subscription_id', NULLIF(_subscription_id, ''),
      'revoked_bonus', _bonus_cut, 'revoked_monthly', _monthly_cut))
  );

  RETURN jsonb_build_object('ok', true, 'revoked', _bonus_cut + _monthly_cut,
    'revoked_bonus', _bonus_cut, 'revoked_monthly', _monthly_cut);
END;
$$;

-- Estorno de geração: a parte que saiu da cota mensal só volta se o débito é
-- do ciclo atual, e nunca acima da alocação do plano. Antes, um estorno
-- depois do reset (ou da renovação) somava créditos que já tinham expirado à
-- cota nova: 300 de sobra viravam 3.500 num plano de 3.200. A parte do bônus
-- (permanente) volta inteira, como antes. Corpo igual ao da 0006 fora isso.
CREATE OR REPLACE FUNCTION public.refund_generation_credits(_uid uuid, _credits integer, _reference text, _reason text DEFAULT 'generation_failed'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p public.profiles%ROWTYPE;
  _last jsonb;
  _charged_at timestamptz;
  _from_bonus integer;
  _from_monthly integer;
  _to_monthly integer;
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

  -- O débito desta tentativa diz de onde os créditos saíram. Débitos antigos
  -- (sem referência) usam o último débito de mesmo valor, como antes.
  SELECT metadata, created_at INTO _last, _charged_at
  FROM public.credit_transactions
  WHERE user_id = _uid AND type = 'consume' AND metadata->>'reference' = _reference
  LIMIT 1;
  IF _last IS NULL THEN
    SELECT metadata, created_at INTO _last, _charged_at
    FROM public.credit_transactions
    WHERE user_id = _uid AND type = 'consume' AND amount = -_credits
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  _from_bonus := LEAST(COALESCE((_last->>'from_bonus')::integer, _credits), _credits);
  _from_monthly := _credits - _from_bonus;
  IF _charged_at IS NOT NULL AND _p.credits_cycle_anchor IS NOT NULL
     AND _charged_at < _p.credits_cycle_anchor::timestamptz THEN
    _to_monthly := 0;
  ELSE
    _to_monthly := LEAST(_from_monthly,
      GREATEST(public.plan_monthly_credits(_p.plan) - COALESCE(_p.credits_monthly, 0), 0));
  END IF;

  UPDATE public.profiles
    SET credits_bonus = COALESCE(credits_bonus, 0) + _from_bonus,
        credits_monthly = COALESCE(credits_monthly, 0) + _to_monthly
    WHERE id = _uid
    RETURNING credits_bonus, credits_monthly INTO _p.credits_bonus, _p.credits_monthly;

  INSERT INTO public.credit_transactions(
    user_id, type, amount, balance_bonus_after, balance_monthly_after, metadata
  )
  VALUES (
    _uid, 'generation_refund', _from_bonus + _to_monthly, _p.credits_bonus, _p.credits_monthly,
    jsonb_build_object(
      'reference', _reference,
      'reason', _reason,
      'requested', _credits,
      'to_bonus', _from_bonus,
      'to_monthly', _to_monthly,
      'expired_monthly', _from_monthly - _to_monthly
    )
  );

  UPDATE public.generation_attempts
     SET status = 'refunded', finished_at = COALESCE(finished_at, now())
   WHERE id::text = _reference AND user_id = _uid;

  RETURN jsonb_build_object(
    'refunded', true, 'amount', _from_bonus + _to_monthly, 'expired_monthly', _from_monthly - _to_monthly,
    'balance_bonus', _p.credits_bonus, 'balance_monthly', _p.credits_monthly
  );
END; $function$;

-- Varredura de tentativas interrompidas: até esta migração ela abortava no
-- gatilho (item 1), e o runbook mandava estornar à mão com referência
-- 'manual:...', que não fecha a tentativa. A varredura não tem como saber se
-- um estorno manual foi daquela tentativa ou de um débito antigo sem
-- tentativa: fechar a tentativa por valor e data tiraria do usuário um estorno
-- devido. Então ela estorna normalmente e, quando há um estorno manual de mesmo
-- valor feito depois da tentativa, avisa a equipe (alerta
-- generation_refund_possible_duplicate) para conferir. Corpo igual ao da 0006
-- fora isso.
CREATE OR REPLACE FUNCTION public.refund_stale_generations(_older_than interval DEFAULT interval '10 minutes')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _a public.generation_attempts%ROWTYPE;
  _r jsonb;
  _ok boolean;
  _manual uuid;
  _refunded integer := 0;
  _credits integer := 0;
  _failed integer := 0;
  _recovered integer := 0;
  _possible_duplicates jsonb := '[]'::jsonb;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('slideai:stale-generations')) THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  FOR _a IN
    SELECT * FROM public.generation_attempts
     WHERE status = 'running' AND created_at < now() - _older_than
     ORDER BY created_at
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  LOOP
    -- A função pode ter caído depois de registrar o sucesso.
    IF EXISTS (
      SELECT 1 FROM public.generation_logs
       WHERE status = 'success' AND metadata->>'attempt_ref' = _a.id::text
    ) THEN
      UPDATE public.generation_attempts SET status = 'succeeded', finished_at = now() WHERE id = _a.id;
      _recovered := _recovered + 1;
      CONTINUE;
    END IF;

    _r := public.refund_generation_credits(_a.user_id, _a.credits, _a.id::text, 'stale_timeout');
    _ok := COALESCE((_r->>'refunded')::boolean, false) OR COALESCE(_r->>'reason' = 'already_refunded', false);
    UPDATE public.generation_attempts
       SET status = CASE WHEN _ok THEN 'refunded' ELSE 'failed' END, finished_at = now()
     WHERE id = _a.id;

    IF COALESCE((_r->>'refunded')::boolean, false) THEN
      _refunded := _refunded + 1;
      _credits := _credits + _a.credits;
      -- Estorno manual de mesmo valor depois da tentativa: pode ter sido desta.
      SELECT m.id INTO _manual
        FROM public.credit_transactions m
       WHERE m.user_id = _a.user_id AND m.type = 'generation_refund'
         AND m.metadata->>'reference' LIKE 'manual:%'
         AND COALESCE((m.metadata->>'requested')::integer, m.amount) = _a.credits
         AND m.created_at >= _a.created_at
       ORDER BY m.created_at
       LIMIT 1;
      IF _manual IS NOT NULL AND jsonb_array_length(_possible_duplicates) < 50 THEN
        _possible_duplicates := _possible_duplicates || jsonb_build_object(
          'usuario', _a.user_id, 'tentativa', _a.id, 'creditos', _a.credits, 'estorno_manual', _manual);
      END IF;
    ELSIF NOT _ok THEN
      _failed := _failed + 1;
    END IF;

    -- Aparece no painel de métricas como as demais falhas.
    INSERT INTO public.generation_logs(user_id, status, reason, credits_charged, metadata)
    VALUES (_a.user_id, 'error', 'stale_timeout', CASE WHEN _ok THEN 0 ELSE _a.credits END,
      jsonb_build_object(
        'failure_code', 'stale_timeout',
        'attempt_ref', _a.id,
        'started_at', _a.created_at,
        'credits_refunded', CASE WHEN COALESCE((_r->>'refunded')::boolean, false) THEN _a.credits ELSE 0 END,
        'refund_failed', NOT _ok,
        'refund_result', _r));
  END LOOP;

  IF _refunded + _failed > 0 THEN
    INSERT INTO public.ops_alerts(kind, severity, title, details, dedupe_key)
    VALUES (
      'generation_stale',
      CASE WHEN _failed > 0 THEN 'critical' ELSE 'warning' END,
      CASE WHEN _refunded + _failed = 1 THEN '1 geração interrompida sem resposta'
           ELSE format('%s gerações interrompidas sem resposta', _refunded + _failed) END,
      jsonb_build_object('estornadas', _refunded, 'creditos_devolvidos', _credits, 'estorno_com_falha', _failed,
                         'sem_resposta_ha_mais_de', _older_than::text),
      'generation_stale:' || gen_random_uuid()
    );
  END IF;

  IF jsonb_array_length(_possible_duplicates) > 0 THEN
    INSERT INTO public.ops_alerts(kind, severity, title, details, dedupe_key)
    VALUES (
      'generation_refund_possible_duplicate', 'warning',
      'Geração estornada pela varredura que pode já ter sido estornada à mão',
      jsonb_build_object('casos', _possible_duplicates),
      'generation_refund_possible_duplicate:' || gen_random_uuid()
    );
  END IF;

  RETURN jsonb_build_object('refunded', _refunded, 'credits', _credits, 'refund_failed', _failed,
                            'recovered', _recovered, 'possible_duplicates', jsonb_array_length(_possible_duplicates));
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_monthly_for_order(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_for_order(uuid, text, text, integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.grant_bonus_credits_once(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_bonus_credits_once(uuid, integer, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.order_granted_bonus(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_granted_bonus(uuid, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.revoke_order_credits(uuid, text, integer, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_order_credits(uuid, text, integer, boolean, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.refund_generation_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_credits(uuid, integer, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.refund_stale_generations(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_stale_generations(interval) TO service_role;

-- ─────────────── 8. Revisão adversarial: pedidos de acesso e papéis ───────────────

-- Pedido de acesso ao portfólio gera e-mail da plataforma para o dono. A
-- política só exigia requester_id = auth.uid(): qualquer conta mandava pedido
-- (e o e-mail, com nome e mensagem escolhidos por ela) a qualquer usuário com
-- username, inclusive a quem desligou os pedidos. Agora só a quem aceita.
CREATE OR REPLACE FUNCTION public.accepts_access_requests(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _owner AND p.allow_access_requests AND NOT COALESCE(p.is_public, false)
  )
$$;
REVOKE ALL ON FUNCTION public.accepts_access_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepts_access_requests(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "par_insert_own" ON public.profile_access_requests;
CREATE POLICY "par_insert_own" ON public.profile_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending' AND public.accepts_access_requests(owner_id));

-- A tela limita a mensagem a 400 caracteres; o e-mail cita até 500. Pedidos
-- antigos acima disso (só pela API) são cortados antes: a restrição é
-- conferida em todo UPDATE, e o dono não conseguiria mais aprovar, recusar
-- nem revogar o pedido.
UPDATE public.profile_access_requests SET message = left(message, 500) WHERE char_length(message) > 500;
DO $do$
BEGIN
  ALTER TABLE public.profile_access_requests
    ADD CONSTRAINT profile_access_requests_message_len CHECK (char_length(message) <= 500) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;
ALTER TABLE public.profile_access_requests VALIDATE CONSTRAINT profile_access_requests_message_len;

-- O dono só decide (status). Reescrever requester_id mandava o e-mail de
-- "acesso decidido" para qualquer conta.
CREATE OR REPLACE FUNCTION public.protect_access_request_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id
          OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
          OR NEW.message IS DISTINCT FROM OLD.message
          OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Só o status do pedido pode ser alterado.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_access_request_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_access_request_fields ON public.profile_access_requests;
CREATE TRIGGER trg_protect_access_request_fields
  BEFORE UPDATE ON public.profile_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_access_request_fields();

-- has_role é usada só por políticas TO authenticated e por funções do
-- servidor. Aberta a anônimos, junto com get_profile_for_viewer (username →
-- id), dizia a qualquer visitante quais contas são de admin/developer; e
-- qualquer conta logada (gratuita) fazia o mesmo. Para clientes (JWT anon ou
-- authenticated) ela só responde sobre o próprio usuário — todas as políticas
-- e funções passam auth.uid(). O servidor (service_role) e as rotinas do banco
-- (sem JWT) continuam consultando qualquer conta.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
     AND (_user_id = auth.uid() OR COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated'))
$function$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
