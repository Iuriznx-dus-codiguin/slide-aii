-- Dedupe existente antes de criar o índice único.
DELETE FROM public.assets a
USING public.assets b
WHERE a.user_id = b.user_id
  AND a.url = b.url
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS assets_user_url_uniq
  ON public.assets (user_id, url);

CREATE INDEX IF NOT EXISTS assets_user_source_lastused_idx
  ON public.assets (user_id, source, last_used_at DESC);