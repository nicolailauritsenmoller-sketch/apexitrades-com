
CREATE TABLE public.agent_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  agent_role text NOT NULL DEFAULT 'Support Agent',
  staff_id text NOT NULL,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.agent_profiles TO authenticated;
GRANT ALL ON public.agent_profiles TO service_role;

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view agent profiles"
  ON public.agent_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff manage their own agent profile"
  ON public.agent_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND private.is_staff(auth.uid()));

CREATE POLICY "Staff update their own agent profile"
  ON public.agent_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND private.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_agent_profiles_updated
  BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS active_agent_id uuid;

CREATE POLICY "Users mark agent messages read in their own sessions"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  );

GRANT UPDATE (read_at) ON public.chat_messages TO authenticated;

CREATE TABLE public.chat_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid,
  agent_name text,
  agent_role text,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.chat_ratings TO authenticated;
GRANT ALL ON public.chat_ratings TO service_role;

ALTER TABLE public.chat_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own chat ratings"
  ON public.chat_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read their own chat ratings"
  ON public.chat_ratings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff read all chat ratings"
  ON public.chat_ratings FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS current_path text;

CREATE POLICY "Users upload their own chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read their own chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Staff read all chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND private.is_staff(auth.uid()));

CREATE POLICY "Staff upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND private.is_staff(auth.uid()));

ALTER TABLE public.deposits REPLICA IDENTITY FULL;
ALTER TABLE public.withdrawals REPLICA IDENTITY FULL;
ALTER TABLE public.kyc_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.positions REPLICA IDENTITY FULL;
ALTER TABLE public.contracts REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['deposits','withdrawals','kyc_submissions','support_tickets','chat_sessions','user_sessions','positions','contracts','chat_messages','chat_ratings']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
