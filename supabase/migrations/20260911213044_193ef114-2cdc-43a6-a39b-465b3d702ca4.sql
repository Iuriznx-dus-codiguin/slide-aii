ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.credit_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_transactions;