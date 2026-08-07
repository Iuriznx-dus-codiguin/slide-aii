CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  fn_name text,
  user_id uuid,
  ip_hash text,
  status_code integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_security_events" ON public.security_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'developer'::app_role));

CREATE INDEX idx_security_events_created ON public.security_events (created_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events (event_type, created_at DESC);
CREATE INDEX idx_security_events_request ON public.security_events (request_id);

CREATE OR REPLACE FUNCTION public.check_rate_limit_daily(_key text, _fn text, _max_per_day integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _window timestamptz := date_trunc('day', now());
  _count integer;
BEGIN
  INSERT INTO public.edge_rate_limits (rl_key, fn_name, window_start, request_count)
  VALUES (_key, _fn || ':daily', _window, 1)
  ON CONFLICT (rl_key, fn_name, window_start)
  DO UPDATE SET request_count = public.edge_rate_limits.request_count + 1
  RETURNING request_count INTO _count;

  RETURN _count <= _max_per_day;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit_daily(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_daily(text, text, integer) TO service_role;