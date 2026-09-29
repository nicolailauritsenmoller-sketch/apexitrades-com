CREATE TABLE public.vip_fee_tiers (
  level integer PRIMARY KEY CHECK (level >= 0 AND level <= 20),
  name text NOT NULL,
  min_spot_volume numeric NOT NULL DEFAULT 0,
  min_futures_volume numeric NOT NULL DEFAULT 0,
  min_scalp_volume numeric NOT NULL DEFAULT 0,
  min_portfolio_usdt numeric NOT NULL DEFAULT 0,
  spot_maker numeric NOT NULL DEFAULT 0.1,
  spot_taker numeric NOT NULL DEFAULT 0.1,
  futures_maker numeric NOT NULL DEFAULT 0.02,
  futures_taker numeric NOT NULL DEFAULT 0.05,
  scalp_maker numeric NOT NULL DEFAULT 0,
  scalp_taker numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vip_fee_tiers TO authenticated;
GRANT ALL ON public.vip_fee_tiers TO service_role;
ALTER TABLE public.vip_fee_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read tiers" ON public.vip_fee_tiers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance'::public.app_role));

CREATE TABLE public.vip_accounts (
  user_id uuid PRIMARY KEY,
  level integer NOT NULL DEFAULT 0,
  recommended_level integer,
  grace_until timestamptz,
  spot_volume_30d numeric NOT NULL DEFAULT 0,
  futures_volume_30d numeric NOT NULL DEFAULT 0,
  scalp_volume_30d numeric NOT NULL DEFAULT 0,
  portfolio_usdt numeric NOT NULL DEFAULT 0,
  account_manager_name text,
  account_manager_email text,
  evaluated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vip_accounts TO authenticated;
GRANT ALL ON public.vip_accounts TO service_role;
ALTER TABLE public.vip_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read vip account" ON public.vip_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.user_fee_overrides (
  user_id uuid PRIMARY KEY,
  spot_maker numeric,
  spot_taker numeric,
  futures_maker numeric,
  futures_taker numeric,
  scalp_maker numeric,
  scalp_taker numeric,
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_fee_overrides TO authenticated;
GRANT ALL ON public.user_fee_overrides TO service_role;
ALTER TABLE public.user_fee_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read fee override" ON public.user_fee_overrides FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS fees_paid numeric NOT NULL DEFAULT 0;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS fee_paid numeric NOT NULL DEFAULT 0;

CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
REVOKE ALL ON private.cron_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.cron_tokens TO service_role;
INSERT INTO private.cron_tokens (name) VALUES ('vip_evaluate') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_token(p_name text, p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT EXISTS (SELECT 1 FROM private.cron_tokens WHERE name = p_name AND token = p_token);
$$;
REVOKE ALL ON FUNCTION public.verify_cron_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text, text) TO service_role;