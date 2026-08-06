-- 1. Colunas mortas de senha (nunca usadas na UI, expostas via leitura pública)
ALTER TABLE public.presentations DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.presentations DROP COLUMN IF EXISTS is_password_protected;

-- 2. Defesa em profundidade: revoga escrita direta onde nenhuma tela escreve
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.generation_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.error_catalog_history FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.edge_rate_limits FROM anon, authenticated;
REVOKE SELECT ON public.payment_events FROM anon;
REVOKE SELECT ON public.generation_logs FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.error_catalog_history FROM anon;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.payment_events TO service_role;
GRANT ALL ON public.generation_logs TO service_role;
GRANT ALL ON public.error_catalog_history TO service_role;
GRANT ALL ON public.edge_rate_limits TO service_role;

-- 3. slide_views: só apresentações publicadas + incremento real de view_count
DROP POLICY IF EXISTS views_anyone_insert ON public.slide_views;
CREATE POLICY views_published_insert ON public.slide_views
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id = slide_views.presentation_id
        AND p.deleted_at IS NULL
        AND (p.is_published = true OR p.user_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.bump_presentation_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.presentations
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = NEW.presentation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_view_count ON public.slide_views;
CREATE TRIGGER trg_bump_view_count
AFTER INSERT ON public.slide_views
FOR EACH ROW EXECUTE FUNCTION public.bump_presentation_view_count();

-- 4. Portfólio público sem expor e-mail/billing
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, full_name, username, avatar_url, bio, website, location, social_links, created_at
  FROM public.profiles
  WHERE is_public = true;

GRANT SELECT ON public.public_profiles TO anon, authenticated;