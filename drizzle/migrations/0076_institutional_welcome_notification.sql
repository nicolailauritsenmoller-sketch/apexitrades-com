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

  INSERT INTO public.notifications (user_id, title, body, kind, read_at)
  VALUES (
    NEW.id,
    'Welcome to Velocity Trade Prime',
    'Your account profile has been successfully provisioned. Complete your security verification to access prime liquidity, dedicated desk support, and tier-1 market execution.',
    'info',
    NULL
  );

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.handle_new_user() IS 'Provisions accounts and creates one unread institutional welcome notification in the auth-user insert transaction; login and profile updates do not resend it.';