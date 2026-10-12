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
-- 5. Suporte: o usuário só escreve mensagens como "user" e só altera a nota
--    (rating) do próprio atendimento.
-- 6. Reserva atômica das cotas por apresentação (falas e chat de edição) e
--    crédito avulso idempotente por pedido.
-- 7. Storage: avatares deixam de ser listáveis por qualquer pessoa; limites de
--    tamanho e tipo nos buckets.
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

DO $do$
BEGIN
  ALTER TABLE public.presentations
    ADD CONSTRAINT presentations_ai_usage_nonnegative
    CHECK (ai_edit_messages >= 0 AND ai_edit_complex >= 0 AND speech_regen_count >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

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
