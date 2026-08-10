-- Platform settings (public marketing stats, admin-managed)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage settings" ON public.platform_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_platform_settings_updated BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (key, value) VALUES
  ('membership', '{"totalMembers": null, "countries": null, "activeMembers": null, "supportedMarkets": null, "verified": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Consent audit trail
CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id text,
  essential boolean NOT NULL DEFAULT true,
  functional boolean NOT NULL DEFAULT false,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL DEFAULT 'v1',
  source text NOT NULL DEFAULT 'banner',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.consent_records TO anon;
GRANT SELECT, INSERT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone records consent" ON public.consent_records FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "own consent read" ON public.consent_records FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admins read consent" ON public.consent_records FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- Per-account personalization preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;