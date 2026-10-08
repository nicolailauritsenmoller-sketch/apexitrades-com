CREATE TABLE public.treasury_wallets (
  currency text PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.treasury_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('send','receive','fund','withdraw')),
  currency text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  counterparty_user_id uuid,
  treasury_balance_after numeric NOT NULL,
  user_balance_after numeric,
  reason text NOT NULL,
  actor_id uuid NOT NULL,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX treasury_ledger_created_idx ON public.treasury_ledger (created_at DESC);
GRANT SELECT ON public.treasury_wallets TO authenticated;
GRANT SELECT ON public.treasury_ledger TO authenticated;
GRANT ALL ON public.treasury_wallets TO service_role;
GRANT ALL ON public.treasury_ledger TO service_role;
ALTER TABLE public.treasury_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance reads treasury" ON public.treasury_wallets FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finance'::public.app_role));
CREATE POLICY "Finance reads treasury ledger" ON public.treasury_ledger FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finance'::public.app_role));
CREATE TRIGGER treasury_ledger_immutable BEFORE UPDATE OR DELETE ON public.treasury_ledger
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

INSERT INTO public.treasury_wallets (currency) VALUES ('USDT'),('USD'),('EUR'),('GBP'),('BTC'),('ETH') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.treasury_transfer(p_direction text, p_user uuid, p_currency text, p_amount numeric, p_reason text, p_actor uuid, p_actor_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t numeric; u numeric; lid uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF length(coalesce(trim(p_reason),'')) < 5 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  INSERT INTO public.treasury_wallets (currency) VALUES (p_currency) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.treasury_wallets WHERE currency = p_currency FOR UPDATE;

  IF p_direction = 'send' THEN
    IF p_user IS NULL THEN RAISE EXCEPTION 'Recipient required'; END IF;
    UPDATE public.treasury_wallets SET balance = balance - p_amount, updated_at = now() WHERE currency = p_currency RETURNING balance INTO t;
    IF t < 0 THEN RAISE EXCEPTION 'Insufficient treasury balance'; END IF;
    u := public.wallet_adjust(p_user, p_currency, p_amount);
  ELSIF p_direction = 'receive' THEN
    IF p_user IS NULL THEN RAISE EXCEPTION 'Source account required'; END IF;
    u := public.wallet_adjust(p_user, p_currency, -p_amount);
    UPDATE public.treasury_wallets SET balance = balance + p_amount, updated_at = now() WHERE currency = p_currency RETURNING balance INTO t;
  ELSIF p_direction = 'fund' THEN
    UPDATE public.treasury_wallets SET balance = balance + p_amount, updated_at = now() WHERE currency = p_currency RETURNING balance INTO t;
  ELSIF p_direction = 'withdraw' THEN
    UPDATE public.treasury_wallets SET balance = balance - p_amount, updated_at = now() WHERE currency = p_currency RETURNING balance INTO t;
    IF t < 0 THEN RAISE EXCEPTION 'Insufficient treasury balance'; END IF;
  ELSE
    RAISE EXCEPTION 'Invalid direction';
  END IF;

  INSERT INTO public.treasury_ledger (direction, currency, amount, counterparty_user_id, treasury_balance_after, user_balance_after, reason, actor_id, actor_name)
  VALUES (p_direction, p_currency, p_amount, CASE WHEN p_direction IN ('send','receive') THEN p_user END, t, u, trim(p_reason), p_actor, p_actor_name)
  RETURNING id INTO lid;

  IF p_direction IN ('send','receive') THEN
    INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, note)
    VALUES (p_user, CASE WHEN p_direction = 'send' THEN 'treasury_credit' ELSE 'treasury_debit' END, p_currency,
            CASE WHEN p_direction = 'send' THEN p_amount ELSE -p_amount END, 'COMPLETED', 'treasury_ledger', lid, trim(p_reason));
  END IF;

  RETURN jsonb_build_object('id', lid, 'treasury_balance', t, 'user_balance', u);
END $$;
REVOKE EXECUTE ON FUNCTION public.treasury_transfer(text, uuid, text, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.treasury_transfer(text, uuid, text, numeric, text, uuid, text) TO service_role;