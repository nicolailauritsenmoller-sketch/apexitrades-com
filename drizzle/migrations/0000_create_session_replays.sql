CREATE TABLE public.session_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key text NOT NULL,
  device_id text,
  route text,
  chunk_index integer NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.session_replays TO authenticated;
GRANT ALL ON public.session_replays TO service_role;

ALTER TABLE public.session_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own replay chunks"
  ON public.session_replays FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own replay chunks"
  ON public.session_replays FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff read all replay chunks"
  ON public.session_replays FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'agent'::public.app_role));

CREATE INDEX idx_session_replays_user_key ON public.session_replays (user_id, session_key, chunk_index);
CREATE INDEX idx_session_replays_created ON public.session_replays (created_at DESC);