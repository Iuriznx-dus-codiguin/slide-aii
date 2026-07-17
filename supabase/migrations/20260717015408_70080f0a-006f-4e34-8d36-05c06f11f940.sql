
ALTER TABLE public.error_occurrences
  ADD COLUMN IF NOT EXISTS request_id text;
CREATE INDEX IF NOT EXISTS idx_error_occurrences_request_id ON public.error_occurrences(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_occurrences_created_at ON public.error_occurrences(created_at DESC);

ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS awaiting_confirmation_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by_human boolean,
  ADD COLUMN IF NOT EXISTS auto_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_reason text;

CREATE INDEX IF NOT EXISTS idx_support_conv_state ON public.support_conversations(state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conv_awaiting ON public.support_conversations(awaiting_confirmation_at) WHERE state = 'awaiting_confirmation';
