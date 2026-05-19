
REVOKE ALL ON FUNCTION public.can_user_generate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_single_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_generate(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_single_credit(uuid) TO service_role;
