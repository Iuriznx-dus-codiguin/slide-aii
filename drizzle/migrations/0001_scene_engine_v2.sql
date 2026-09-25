ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS engine_version smallint NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.presentation_asset_quotas (
  presentation_id uuid PRIMARY KEY REFERENCES public.presentations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ai_planned integer NOT NULL DEFAULT 0 CHECK (ai_planned BETWEEN 0 AND 200),
  ai_consumed integer NOT NULL DEFAULT 0 CHECK (ai_consumed >= 0),
  photo_planned integer NOT NULL DEFAULT 0 CHECK (photo_planned BETWEEN 0 AND 200),
  photo_consumed integer NOT NULL DEFAULT 0 CHECK (photo_consumed >= 0),
  ai_cost_usd numeric(10, 5) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS presentation_asset_quotas_user_idx
  ON public.presentation_asset_quotas (user_id);

REVOKE INSERT, UPDATE, DELETE ON public.presentation_asset_quotas FROM anon, authenticated;
GRANT SELECT ON public.presentation_asset_quotas TO authenticated;
GRANT ALL ON public.presentation_asset_quotas TO service_role;

ALTER TABLE public.presentation_asset_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_quota_owner_read" ON public.presentation_asset_quotas;
CREATE POLICY "asset_quota_owner_read" ON public.presentation_asset_quotas
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
  );

CREATE OR REPLACE FUNCTION public.consume_presentation_asset(_presentation_id uuid, _uid uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining integer;
BEGIN
  IF _kind = 'ai' THEN
    UPDATE public.presentation_asset_quotas
       SET ai_consumed = ai_consumed + 1
     WHERE presentation_id = _presentation_id
       AND user_id = _uid
       AND ai_consumed < ai_planned
       AND expires_at > now()
    RETURNING ai_planned - ai_consumed INTO _remaining;
  ELSIF _kind = 'photo' THEN
    UPDATE public.presentation_asset_quotas
       SET photo_consumed = photo_consumed + 1
     WHERE presentation_id = _presentation_id
       AND user_id = _uid
       AND photo_consumed < photo_planned
       AND expires_at > now()
    RETURNING photo_planned - photo_consumed INTO _remaining;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_quota');
  END IF;
  RETURN jsonb_build_object('ok', true, 'remaining', _remaining);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_presentation_asset(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_presentation_asset(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.add_presentation_asset_cost(_presentation_id uuid, _uid uuid, _cost_usd numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.presentation_asset_quotas
     SET ai_cost_usd = ai_cost_usd + LEAST(GREATEST(COALESCE(_cost_usd, 0), 0), 5)
   WHERE presentation_id = _presentation_id
     AND user_id = _uid;
$$;

REVOKE ALL ON FUNCTION public.add_presentation_asset_cost(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_presentation_asset_cost(uuid, uuid, numeric) TO service_role;