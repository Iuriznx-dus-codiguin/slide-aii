DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profile(_username text)
RETURNS TABLE (
  id uuid, full_name text, username text, avatar_url text,
  bio text, website text, location text, social_links jsonb, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.username, p.avatar_url, p.bio, p.website,
         p.location, p.social_links, p.created_at
  FROM public.profiles p
  WHERE p.is_public = true AND p.username = _username
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated, service_role;

-- Rotinas internas: só o servidor (service_role) pode executar
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_user_generate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_single_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_single_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_own_generations_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_ticket_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_user_generate(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_single_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_single_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_own_generations_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_ticket_id() TO service_role;

-- has_role é usado dentro das políticas RLS: precisa continuar executável por quem consulta
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;