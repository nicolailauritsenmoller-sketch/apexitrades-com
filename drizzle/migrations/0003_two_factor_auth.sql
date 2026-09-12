CREATE TABLE IF NOT EXISTS public.user_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  totp_secret text,
  pending_totp_secret text,
  two_factor_verified_at timestamptz,
  last_totp_step bigint,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_recovery_codes_user_idx ON public.user_recovery_codes(user_id);

CREATE TABLE IF NOT EXISTS public.two_factor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

CREATE TABLE IF NOT EXISTS public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_logs_user_idx ON public.security_logs(user_id, created_at DESC);

GRANT ALL ON public.user_security TO service_role;
GRANT ALL ON public.user_recovery_codes TO service_role;
GRANT ALL ON public.two_factor_sessions TO service_role;
GRANT ALL ON public.security_logs TO service_role;
GRANT SELECT ON public.security_logs TO authenticated;

ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own security logs" ON public.security_logs;
CREATE POLICY "Users read own security logs"
  ON public.security_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_security_updated ON public.user_security;
CREATE TRIGGER trg_user_security_updated
  BEFORE UPDATE ON public.user_security
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();