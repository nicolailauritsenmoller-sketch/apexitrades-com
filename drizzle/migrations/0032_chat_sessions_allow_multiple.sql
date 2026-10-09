ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS chat_sessions_one_open_per_user ON public.chat_sessions (user_id) WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS chat_sessions_user_created_idx ON public.chat_sessions (user_id, created_at DESC);