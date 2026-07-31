CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  display_symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up','down')),
  stake NUMERIC NOT NULL CHECK (stake > 0),
  currency TEXT NOT NULL DEFAULT 'USDT',
  duration_seconds INTEGER NOT NULL,
  payout_pct NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled')),
  result TEXT CHECK (result IN ('win','loss','draw')),
  payout NUMERIC,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ
);

CREATE INDEX contracts_user_status_idx ON public.contracts (user_id, status, expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contracts" ON public.contracts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own contracts" ON public.contracts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);