CREATE TYPE public.asset_class AS ENUM ('crypto','stock','future','forex','metal');
CREATE TYPE public.trade_side AS ENUM ('long','short');
CREATE TYPE public.position_status AS ENUM ('open','closed');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Trader',
  base_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  currency TEXT NOT NULL,
  balance NUMERIC(24,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallets" ON public.wallets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  display_symbol TEXT NOT NULL,
  asset_class public.asset_class NOT NULL,
  side public.trade_side NOT NULL,
  quantity NUMERIC(24,8) NOT NULL,
  entry_price NUMERIC(24,8) NOT NULL,
  exit_price NUMERIC(24,8),
  leverage NUMERIC(6,2) NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.position_status NOT NULL DEFAULT 'open',
  realized_pnl NUMERIC(24,8),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own positions" ON public.positions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX positions_user_status_idx ON public.positions (user_id, status, opened_at DESC);

CREATE TABLE public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlist" ON public.watchlist FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Trader'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, currency, balance) VALUES
    (NEW.id, 'USD', 100000),
    (NEW.id, 'EUR', 25000),
    (NEW.id, 'GBP', 10000),
    (NEW.id, 'USDT', 50000),
    (NEW.id, 'BTC', 0.5)
  ON CONFLICT (user_id, currency) DO NOTHING;

  INSERT INTO public.watchlist (user_id, symbol) VALUES
    (NEW.id, 'BTCUSDT'), (NEW.id, 'ETHUSDT'), (NEW.id, 'SOLUSDT'),
    (NEW.id, 'AAPL'), (NEW.id, 'NVDA'), (NEW.id, 'EURUSD=X'), (NEW.id, 'GC=F')
  ON CONFLICT (user_id, symbol) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();