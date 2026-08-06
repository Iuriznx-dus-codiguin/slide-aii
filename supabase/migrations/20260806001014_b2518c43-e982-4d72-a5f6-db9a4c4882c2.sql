CREATE OR REPLACE FUNCTION public.increment_profile_generations(_uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_count integer;
BEGIN
  UPDATE public.profiles
    SET generations_count = COALESCE(generations_count, 0) + 1
    WHERE id = _uid
    RETURNING generations_count INTO _new_count;
  RETURN _new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_profile_generations(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_profile_generations(uuid) TO service_role;