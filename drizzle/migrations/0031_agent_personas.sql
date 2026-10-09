ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS welcome_message text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS presence text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS active_persona_id uuid;

CREATE TABLE public.agent_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  full_name text NOT NULL,
  agent_role text NOT NULL,
  staff_id text NOT NULL,
  avatar_url text,
  signature text,
  welcome_message text,
  language text NOT NULL DEFAULT 'en',
  presence text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_personas_presence_chk CHECK (presence IN ('available','busy','offline')),
  CONSTRAINT agent_personas_language_chk CHECK (language IN ('en','es','fr','de','ar','zh'))
);
CREATE INDEX agent_personas_user_idx ON public.agent_personas(user_id);
GRANT SELECT ON public.agent_personas TO authenticated;
GRANT ALL ON public.agent_personas TO service_role;
ALTER TABLE public.agent_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own personas" ON public.agent_personas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER agent_personas_updated BEFORE UPDATE ON public.agent_personas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();