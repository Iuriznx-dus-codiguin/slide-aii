-- Apresentações privadas por padrão e API fechada (auditoria de 17/10/2026).
--
-- 1) Toda apresentação nova nasce privada, como a Central de Ajuda já dizia.
--    As já publicadas continuam publicadas (links compartilhados seguem
--    funcionando).
-- 2) A leitura pública direta das tabelas sai: com a chave pública do site,
--    qualquer pessoa listava pela API os decks publicados de TODOS os
--    usuários (com notas e falas), sem precisar do link, e contornava o
--    portfólio privado. O visualizador passa a ler por slug numa função que
--    devolve só aquele deck e só as colunas que ele usa.
-- 3) Visitas registradas por função: só decks publicados, sem contar o dono
--    e sem repetir o mesmo visitante em 30 minutos.
-- 4) Colunas que só o servidor altera: e-mail e contadores do perfil,
--    view_count da apresentação, estado das conversas de suporte.
-- 5) Suporte: o cliente não cria mais conversas nem mensagens direto (a edge
--    function cria), o que fechava a forja de respostas "assistant" e o
--    bloqueio de chamados por ticket_id adiantado.
-- 6) generation_logs só para a equipe (expunha custo real e erros internos).
-- 7) Pedidos de acesso ao portfólio respeitam a preferência do dono.
-- 8) Storage: limite de tamanho e tipo nos buckets; avatar legível só pelo dono
--    (as URLs assinadas, usadas nas páginas, não dependem de RLS).
-- 9) Métricas do painel /__dev por função restrita à equipe.
-- Idempotente.

-- ─────────────── 1) Privada por padrão ───────────────
ALTER TABLE public.presentations ALTER COLUMN is_published SET DEFAULT false;

-- ─────────────── 2) Leitura pública por slug ───────────────
CREATE OR REPLACE FUNCTION public.get_shared_presentation(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.presentations%ROWTYPE;
  _owner boolean;
BEGIN
  SELECT * INTO _p FROM public.presentations
   WHERE slug = _slug AND deleted_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  _owner := auth.uid() IS NOT NULL AND auth.uid() = _p.user_id;
  -- Privada: só o dono abre.
  IF NOT (COALESCE(_p.is_published, false) OR _owner) THEN
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
      'is_published', COALESCE(_p.is_published, false),
      'is_owner', _owner
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

DROP POLICY IF EXISTS "presentations_public_read" ON public.presentations;
DROP POLICY IF EXISTS "slides_public_read" ON public.slides;

-- ─────────────── 3) Visitas ───────────────
-- O código do visitante é um hash do IP + navegador + um sal secreto do dia:
-- serve só para não contar a mesma visita duas vezes. O sal fica numa tabela
-- que nenhum cliente lê e é apagado no dia seguinte, então o código não pode
-- ser revertido (nem pelo dono do deck, que lê slide_views) e não liga a
-- mesma pessoa de um dia para o outro.
CREATE TABLE IF NOT EXISTS public.view_dedupe_salt (
  day date PRIMARY KEY,
  salt text NOT NULL
);
ALTER TABLE public.view_dedupe_salt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.view_dedupe_salt FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_slide_view(_presentation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _info jsonb := public.request_client_info();
  _salt text;
  _hash text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.presentations
     WHERE id = _presentation_id
       AND COALESCE(is_published, false)
       AND deleted_at IS NULL
       AND user_id IS DISTINCT FROM auth.uid()
  ) THEN
    RETURN;
  END IF;
  DELETE FROM public.view_dedupe_salt WHERE day < current_date;
  INSERT INTO public.view_dedupe_salt(day, salt)
  VALUES (current_date, gen_random_uuid()::text || gen_random_uuid()::text)
  ON CONFLICT (day) DO NOTHING;
  SELECT salt INTO _salt FROM public.view_dedupe_salt WHERE day = current_date;
  _hash := md5(_salt || '|' || COALESCE(_info->>'ip', '') || '|' || COALESCE(_info->>'user_agent', ''));
  IF EXISTS (
    SELECT 1 FROM public.slide_views
     WHERE presentation_id = _presentation_id
       AND viewer_ip_hash = _hash
       AND created_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.slide_views(presentation_id, viewer_ip_hash, user_agent)
  VALUES (_presentation_id, _hash, left(_info->>'user_agent', 300));
END;
$$;
REVOKE ALL ON FUNCTION public.record_slide_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_slide_view(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS views_published_insert ON public.slide_views;
DROP POLICY IF EXISTS views_anyone_insert ON public.slide_views;
REVOKE INSERT, UPDATE, DELETE ON public.slide_views FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS slide_views_dedupe_idx
  ON public.slide_views (presentation_id, viewer_ip_hash, created_at DESC);

-- ─────────────── 4) Colunas que só o servidor altera ───────────────
-- Contadores de IA, falas pagas e visualizações da apresentação (0010 + view_count).
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
          OR NEW.include_speeches IS DISTINCT FROM OLD.include_speeches
          OR NEW.view_count IS DISTINCT FROM OLD.view_count) THEN
    RAISE EXCEPTION 'Contadores de uso de IA não podem ser alterados pelo cliente.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_ai_edit_usage ON public.presentations;
CREATE TRIGGER trg_protect_ai_edit_usage BEFORE UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.protect_ai_edit_usage();

-- Perfil: o e-mail identifica quem pagou (webhook) e recebe os avisos da
-- plataforma; os contadores são métricas. Só o servidor altera.
CREATE OR REPLACE FUNCTION public.protect_profile_server_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (NEW.email IS DISTINCT FROM OLD.email
          OR NEW.generations_count IS DISTINCT FROM OLD.generations_count
          OR NEW.total_views IS DISTINCT FROM OLD.total_views) THEN
    RAISE EXCEPTION 'Este campo do perfil não pode ser alterado pelo cliente.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_profile_server_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_server_columns BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_server_columns();

-- O e-mail do perfil acompanha o e-mail da conta (troca feita pelo login).
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = lower(NEW.email) WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Conversas de suporte: o dono só avalia (rating); o resto é do servidor e da
-- equipe.
CREATE OR REPLACE FUNCTION public.protect_support_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
     AND (to_jsonb(NEW) - 'rating' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'rating' - 'updated_at') THEN
    RAISE EXCEPTION 'Só a avaliação da conversa pode ser alterada.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_support_conversation ON public.support_conversations;
CREATE TRIGGER trg_protect_support_conversation BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.protect_support_conversation();

-- ─────────────── 5) Suporte: criação só pelo servidor ───────────────
DROP POLICY IF EXISTS "conv_own_insert" ON public.support_conversations;
DROP POLICY IF EXISTS "msg_own_insert" ON public.support_messages;

-- ─────────────── 6) generation_logs só para a equipe ───────────────
DROP POLICY IF EXISTS "logs_owner_select" ON public.generation_logs;
DROP POLICY IF EXISTS "logs_staff_select" ON public.generation_logs;
CREATE POLICY "logs_staff_select" ON public.generation_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'admin'));

-- ─────────────── 7) Pedidos de acesso ao portfólio ───────────────
CREATE OR REPLACE FUNCTION public.accepts_access_requests(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = _owner AND COALESCE(allow_access_requests, true) AND NOT COALESCE(is_public, false)
  );
$$;
REVOKE ALL ON FUNCTION public.accepts_access_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepts_access_requests(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "par_insert_own" ON public.profile_access_requests;
CREATE POLICY "par_insert_own" ON public.profile_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND status = 'pending'
    AND (message IS NULL OR char_length(message) <= 400)
    AND public.accepts_access_requests(owner_id)
  );

-- ─────────────── 8) Storage ───────────────
UPDATE storage.buckets
   SET file_size_limit = 4194304,
       allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 WHERE id = 'avatars';
UPDATE storage.buckets
   SET file_size_limit = 12582912,
       allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/avif']
 WHERE id = 'slide-images';

DROP POLICY IF EXISTS "avatars_read_auth" ON storage.objects;
DROP POLICY IF EXISTS "avatars_read_own" ON storage.objects;
CREATE POLICY "avatars_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────── 9) Métricas do painel /__dev ───────────────
CREATE OR REPLACE FUNCTION public.staff_content_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - interval '24 hours';
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')) THEN
    RAISE EXCEPTION 'Somente a equipe.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'presentations_total', (SELECT count(*) FROM public.presentations),
    'presentations_24h', (SELECT count(*) FROM public.presentations WHERE created_at >= _since),
    'slides_total', (SELECT count(*) FROM public.slides),
    'slides_24h', (SELECT count(*) FROM public.slides WHERE created_at >= _since),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('title', r.title, 'created_at', r.created_at, 'slides_count', r.slides_count))
        FROM (SELECT title, created_at, slides_count FROM public.presentations ORDER BY created_at DESC LIMIT 8) r
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.staff_content_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_content_stats() TO authenticated, service_role;

-- ─────────────── 10) Central de Ajuda ───────────────
-- Onde publicar (agora também no editor e no visualizador) e como as visitas
-- são contadas. Só troca o trecho se ele ainda estiver no texto.
UPDATE public.help_articles
   SET content_md = replace(content_md,
         'No painel (Minhas apresentações), clique no ícone de **globo** da apresentação. Ela passa a mostrar "Pública" e fica acessível a qualquer pessoa com o link, sem login.',
         'No painel (Minhas apresentações), clique no ícone de **globo** da apresentação. Ela passa a mostrar "Pública" e fica acessível a qualquer pessoa com o link, sem login. Também dá para publicar no editor (botão **Privada**, no topo) ou no visualizador, em **Compartilhar → Publicar**.'),
       updated_at = now()
 WHERE slug = 'publicar-e-despublicar'
   AND position('Compartilhar → Publicar' IN content_md) = 0;

UPDATE public.help_articles
   SET content_md = replace(replace(content_md,
         '- Cada abertura de uma apresentação publicada no visualizador conta uma visualização.',
         '- Cada abertura de uma apresentação publicada no visualizador conta uma visualização. As suas próprias aberturas não contam, e a mesma pessoa conta uma vez a cada 30 minutos.'),
         '- Registramos só a data, a hora e o tipo de navegador da visita, para o contador. **Não guardamos o IP nem identificamos quem assistiu.**',
         '- Registramos só a data, a hora e o tipo de navegador da visita, para o contador. Para não contar a mesma pessoa duas vezes, guardamos também um código embaralhado do acesso, que não pode ser revertido e deixa de valer no dia seguinte. **Não guardamos o IP nem identificamos quem assistiu.**'),
       updated_at = now()
 WHERE slug = 'estatisticas-de-visualizacao'
   AND position('a cada 30 minutos' IN content_md) = 0;
