ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS bot_context jsonb,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;

COMMENT ON COLUMN public.chat_sessions.bot_context IS 'Private support-agent context captured from the automated assistant; never render in the customer transcript.';
COMMENT ON COLUMN public.chat_sessions.escalated_at IS 'Timestamp of the latest live-agent queue request.';
COMMENT ON COLUMN public.chat_sessions.connected_at IS 'Timestamp when a support agent accepted the live chat.';