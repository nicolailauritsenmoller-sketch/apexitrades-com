-- Profile identity, referral and device management support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS uid text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS referral_rewards_usdt numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.generate_uid7()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..7 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.uid = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_uid7() FROM PUBLIC, anon, authenticated;

-- Backfill existing profiles
UPDATE public.profiles SET uid = public.generate_uid7() WHERE uid IS NULL;
UPDATE public.profiles SET referral_code = uid WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_uid_key ON public.profiles (uid);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);

CREATE OR REPLACE FUNCTION public.set_profile_uid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.uid IS NULL THEN NEW.uid := public.generate_uid7(); END IF;
  IF NEW.referral_code IS NULL THEN NEW.referral_code := NEW.uid; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_uid() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_uid ON public.profiles;
CREATE TRIGGER trg_profiles_uid BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_uid();

-- KYC document expiry tracking
ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS document_expires_at date;

-- Device / session tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  browser text NOT NULL DEFAULT 'Unknown',
  os text NOT NULL DEFAULT 'Unknown',
  ip_address text,
  country text,
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sessions read" ON public.user_sessions
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own sessions insert" ON public.user_sessions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own sessions update" ON public.user_sessions
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own sessions delete" ON public.user_sessions
FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON public.user_sessions (user_id, last_active_at DESC);

-- New signups: capture referral code from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code text := NULLIF(NEW.raw_user_meta_data->>'referral_code', '');
  referrer uuid;
BEGIN
  IF ref_code IS NOT NULL THEN
    SELECT id INTO referrer FROM public.profiles WHERE referral_code = upper(ref_code) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, display_name, referred_by)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Trader'), referrer)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, currency, balance) VALUES
    (NEW.id, 'USD', 0), (NEW.id, 'EUR', 0), (NEW.id, 'GBP', 0),
    (NEW.id, 'USDT', 0), (NEW.id, 'BTC', 0), (NEW.id, 'ETH', 0)
  ON CONFLICT (user_id, currency) DO NOTHING;

  INSERT INTO public.watchlist (user_id, symbol) VALUES
    (NEW.id, 'BTCUSDT'), (NEW.id, 'ETHUSDT'), (NEW.id, 'SOLUSDT'),
    (NEW.id, 'AAPL'), (NEW.id, 'NVDA'), (NEW.id, 'EURUSD=X'), (NEW.id, 'GC=F')
  ON CONFLICT (user_id, symbol) DO NOTHING;

  RETURN NEW;
END;
$$;