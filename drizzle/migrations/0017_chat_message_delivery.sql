ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
CREATE INDEX IF NOT EXISTS chat_messages_unread_idx ON public.chat_messages (session_id) WHERE read_at IS NULL;