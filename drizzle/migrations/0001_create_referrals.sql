CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL UNIQUE,
  referral_code text,
  status text NOT NULL DEFAULT 'pending',
  reward_amount numeric NOT NULL DEFAULT 10,
  admin_note text,
  reviewed_by uuid,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX referrals_referrer_idx ON public.referrals (referrer_id);
CREATE INDEX referrals_status_idx ON public.referrals (status);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_referrals_updated
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill existing referred users
INSERT INTO public.referrals (referrer_id, referee_id, referral_code, status, created_at)
SELECT p.referred_by, p.id, r.referral_code, 'pending', p.created_at
FROM public.profiles p
LEFT JOIN public.profiles r ON r.id = p.referred_by
WHERE p.referred_by IS NOT NULL
ON CONFLICT (referee_id) DO NOTHING;

-- Record new referrals at sign-up time
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref_code text := NULLIF(NEW.raw_user_meta_data->>'referral_code', '');
  referrer uuid;
  full_name text := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(trim(concat_ws(' ', NEW.raw_user_meta_data->>'given_name', NEW.raw_user_meta_data->>'family_name')), ''),
    split_part(NEW.email, '@', 1),
    'Trader'
  );
BEGIN
  IF ref_code IS NOT NULL THEN
    SELECT id INTO referrer FROM public.profiles WHERE referral_code = upper(ref_code) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, display_name, email, avatar_url, referred_by)
  VALUES (
    NEW.id,
    full_name,
    NEW.email,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'), ''),
    referrer
  )
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(public.profiles.email, EXCLUDED.email);

  IF referrer IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referee_id, referral_code)
    VALUES (referrer, NEW.id, upper(ref_code))
    ON CONFLICT (referee_id) DO NOTHING;
  END IF;

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
$function$;