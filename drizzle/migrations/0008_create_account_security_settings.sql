CREATE TABLE public.account_security_settings (
  user_id uuid PRIMARY KEY,
  anti_phishing_code_hash text,
  anti_phishing_code_hint text,
  address_whitelisting_enabled boolean NOT NULL DEFAULT false,
  login_password_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anti_phishing_hint_length CHECK (anti_phishing_code_hint IS NULL OR char_length(anti_phishing_code_hint) <= 2)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_security_settings TO authenticated;
GRANT ALL ON public.account_security_settings TO service_role;

ALTER TABLE public.account_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own account security settings"
ON public.account_security_settings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own account security settings"
ON public.account_security_settings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own account security settings"
ON public.account_security_settings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own account security settings"
ON public.account_security_settings
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_account_security_settings_updated_at
BEFORE UPDATE ON public.account_security_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();