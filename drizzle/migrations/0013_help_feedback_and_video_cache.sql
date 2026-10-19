-- Votos da Central de Ajuda e cache de vídeos de fundo (auditoria de 17/10/2026).
--
-- 1) "Este artigo foi útil?": o clique não era gravado. Um voto por pessoa,
--    artigo e dia, identificado só por um código embaralhado com o sal
--    diário das visitas (view_dedupe_salt, migração 0011), que é descartado
--    no dia seguinte. A equipe vê o resumo em help_feedback_summary().
-- 2) Vídeo de fundo do visualizador: cada visitante buscava na Pexels o
--    vídeo de cada slide, o que podia esgotar a cota do projeto inteiro
--    (a mesma usada nas fotos das gerações). Agora o resultado fica guardado
--    por tema de busca; a Pexels é chamada uma vez por tema a cada 30 dias.
-- Idempotente.

-- ─────────────── 1) Votos da Central de Ajuda ───────────────
CREATE TABLE IF NOT EXISTS public.help_article_feedback (
  id bigserial PRIMARY KEY,
  article_slug text NOT NULL,
  helpful boolean NOT NULL,
  voter_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.help_article_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.help_article_feedback FROM anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS help_article_feedback_vote_idx
  ON public.help_article_feedback (article_slug, voter_hash);
CREATE INDEX IF NOT EXISTS help_article_feedback_created_idx
  ON public.help_article_feedback (created_at DESC);

CREATE OR REPLACE FUNCTION public.record_help_feedback(_slug text, _helpful boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _info jsonb := public.request_client_info();
  _salt text;
BEGIN
  IF _helpful IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.help_articles WHERE slug = _slug AND is_published
  ) THEN
    RETURN;
  END IF;
  DELETE FROM public.view_dedupe_salt WHERE day < current_date;
  INSERT INTO public.view_dedupe_salt(day, salt)
  VALUES (current_date, gen_random_uuid()::text || gen_random_uuid()::text)
  ON CONFLICT (day) DO NOTHING;
  SELECT salt INTO _salt FROM public.view_dedupe_salt WHERE day = current_date;
  INSERT INTO public.help_article_feedback(article_slug, helpful, voter_hash)
  VALUES (
    _slug, _helpful,
    md5(_salt || '|' || COALESCE(auth.uid()::text, COALESCE(_info->>'ip', '') || '|' || COALESCE(_info->>'user_agent', '')))
  )
  -- Mudou de ideia no mesmo dia: vale o último voto.
  ON CONFLICT (article_slug, voter_hash) DO UPDATE SET helpful = EXCLUDED.helpful, created_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.record_help_feedback(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_help_feedback(text, boolean) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.help_feedback_summary(_days integer DEFAULT 30)
RETURNS TABLE(article_slug text, title text, helpful bigint, not_helpful bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')) THEN
    RAISE EXCEPTION 'Somente a equipe.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT f.article_slug, a.title,
           count(*) FILTER (WHERE f.helpful),
           count(*) FILTER (WHERE NOT f.helpful)
      FROM public.help_article_feedback f
      LEFT JOIN public.help_articles a ON a.slug = f.article_slug
     WHERE f.created_at >= now() - make_interval(days => GREATEST(1, LEAST(COALESCE(_days, 30), 365)))
     GROUP BY f.article_slug, a.title
     ORDER BY count(*) FILTER (WHERE NOT f.helpful) DESC, count(*) DESC
     LIMIT 20;
END;
$$;
REVOKE ALL ON FUNCTION public.help_feedback_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.help_feedback_summary(integer) TO authenticated, service_role;

-- ─────────────── 2) Cache dos vídeos de fundo ───────────────
CREATE TABLE IF NOT EXISTS public.video_search_cache (
  query_key text PRIMARY KEY,
  url text,
  poster text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.video_search_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_search_cache FROM anon, authenticated;
