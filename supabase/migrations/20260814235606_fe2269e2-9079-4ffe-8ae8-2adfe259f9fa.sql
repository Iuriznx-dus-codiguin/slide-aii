ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allow_access_requests boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.profile_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_access_requests_status_chk CHECK (status IN ('pending','approved','denied')),
  CONSTRAINT profile_access_requests_not_self CHECK (owner_id <> requester_id),
  CONSTRAINT profile_access_requests_unique UNIQUE (owner_id, requester_id)
);

GRANT SELECT, INSERT, UPDATE ON public.profile_access_requests TO authenticated;
GRANT ALL ON public.profile_access_requests TO service_role;

ALTER TABLE public.profile_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "par_select_involved" ON public.profile_access_requests
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR requester_id = auth.uid());

CREATE POLICY "par_insert_own" ON public.profile_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');

CREATE POLICY "par_update_owner" ON public.profile_access_requests
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_par_updated
  BEFORE UPDATE ON public.profile_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_par_owner_status ON public.profile_access_requests (owner_id, status);

CREATE OR REPLACE FUNCTION public.can_view_portfolio(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _owner
      AND (
        p.is_public = true
        OR p.id = _viewer
        OR EXISTS (
          SELECT 1 FROM public.profile_access_requests r
          WHERE r.owner_id = _owner AND r.requester_id = _viewer AND r.status = 'approved'
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.get_profile_for_viewer(_username text)
RETURNS TABLE (
  id uuid, full_name text, username text, avatar_url text, bio text, website text,
  location text, social_links jsonb, created_at timestamptz,
  is_public boolean, allow_access_requests boolean, access_state text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    CASE WHEN _allowed.ok THEN p.full_name ELSE NULL END,
    p.username,
    CASE WHEN _allowed.ok THEN p.avatar_url ELSE NULL END,
    CASE WHEN _allowed.ok THEN p.bio ELSE NULL END,
    CASE WHEN _allowed.ok THEN p.website ELSE NULL END,
    CASE WHEN _allowed.ok THEN p.location ELSE NULL END,
    CASE WHEN _allowed.ok THEN p.social_links ELSE '{}'::jsonb END,
    p.created_at,
    p.is_public,
    p.allow_access_requests,
    CASE
      WHEN _allowed.ok THEN 'granted'
      WHEN auth.uid() IS NULL THEN 'anonymous'
      ELSE COALESCE(
        (SELECT r.status FROM public.profile_access_requests r
          WHERE r.owner_id = p.id AND r.requester_id = auth.uid()),
        'none')
    END
  FROM public.profiles p
  CROSS JOIN LATERAL (
    SELECT public.can_view_portfolio(p.id, auth.uid()) AS ok
  ) AS _allowed
  WHERE p.username = _username
$$;

CREATE OR REPLACE FUNCTION public.get_portfolio_presentations(_owner uuid)
RETURNS TABLE (
  id uuid, title text, slug text, description text,
  slides_count integer, view_count integer, created_at timestamptz,
  cover_image_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.id, pr.title, pr.slug, pr.description, pr.slides_count, pr.view_count, pr.created_at,
    (SELECT s.background_image_url FROM public.slides s
      WHERE s.presentation_id = pr.id AND s.background_image_url IS NOT NULL
      ORDER BY s.position ASC LIMIT 1)
  FROM public.presentations pr
  WHERE pr.user_id = _owner
    AND pr.is_published = true
    AND pr.deleted_at IS NULL
    AND public.can_view_portfolio(_owner, auth.uid())
  ORDER BY pr.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.can_view_portfolio(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_for_viewer(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_presentations(uuid) TO anon, authenticated;

CREATE POLICY "msg_staff_insert" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role)
  );

CREATE POLICY "avatars_read_auth" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);