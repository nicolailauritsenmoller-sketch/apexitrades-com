-- 1. Unified transactions ledger
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  currency text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('COMPLETED','PENDING','FAILED')),
  ref_table text NOT NULL,
  ref_id uuid NOT NULL,
  tx_hash text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ref_table, ref_id, kind)
);
CREATE INDEX transactions_user_created_idx ON public.transactions (user_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own ledger" ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'finance'::public.app_role));
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION private.ledger_upsert(p_user uuid, p_kind text, p_cur text, p_amount numeric, p_status text, p_table text, p_ref uuid, p_hash text, p_note text, p_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, tx_hash, note, created_at)
  VALUES (p_user, p_kind, p_cur, p_amount, p_status, p_table, p_ref, p_hash, p_note, COALESCE(p_at, now()))
  ON CONFLICT (ref_table, ref_id, kind) DO UPDATE
    SET amount = EXCLUDED.amount, status = EXCLUDED.status, tx_hash = EXCLUDED.tx_hash, note = EXCLUDED.note;
$$;

CREATE OR REPLACE FUNCTION private.map_request_status(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s WHEN 'approved' THEN 'COMPLETED' WHEN 'rejected' THEN 'FAILED' ELSE 'PENDING' END;
$$;

CREATE OR REPLACE FUNCTION private.ledger_from_deposit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.ledger_upsert(NEW.user_id, 'deposit', NEW.coin, NEW.amount, private.map_request_status(NEW.status::text), 'deposits', NEW.id, NEW.tx_hash, NEW.network, NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER ledger_deposits AFTER INSERT OR UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION private.ledger_from_deposit();

CREATE OR REPLACE FUNCTION private.ledger_from_withdrawal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.ledger_upsert(NEW.user_id, 'withdrawal', NEW.coin, -NEW.amount, private.map_request_status(NEW.status::text), 'withdrawals', NEW.id, NULL, NEW.network || ' -> ' || NEW.destination_address, NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER ledger_withdrawals AFTER INSERT OR UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION private.ledger_from_withdrawal();

CREATE OR REPLACE FUNCTION private.ledger_from_swap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.ledger_upsert(NEW.user_id, 'swap_out', NEW.from_currency, -NEW.from_amount, 'COMPLETED', 'swaps', NEW.id, NULL, NEW.from_currency || ' -> ' || NEW.to_currency, NEW.created_at);
  PERFORM private.ledger_upsert(NEW.user_id, 'swap_in', NEW.to_currency, NEW.to_amount, 'COMPLETED', 'swaps', NEW.id, NULL, NEW.from_currency || ' -> ' || NEW.to_currency, NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER ledger_swaps AFTER INSERT ON public.swaps FOR EACH ROW EXECUTE FUNCTION private.ledger_from_swap();

CREATE OR REPLACE FUNCTION private.ledger_from_contract() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.ledger_upsert(NEW.user_id, 'contract_stake', NEW.currency, -(NEW.stake + COALESCE(NEW.fee_paid,0)), 'COMPLETED', 'contracts', NEW.id, NULL, NEW.display_symbol || ' ' || NEW.direction, NEW.opened_at);
  ELSIF NEW.status = 'settled' AND OLD.status IS DISTINCT FROM 'settled' THEN
    PERFORM private.ledger_upsert(NEW.user_id, 'contract_settlement', NEW.currency, COALESCE(NEW.payout,0), 'COMPLETED', 'contracts', NEW.id, NULL, NEW.display_symbol || ' ' || COALESCE(NEW.result,''), COALESCE(NEW.settled_at, now()));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ledger_contracts AFTER INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION private.ledger_from_contract();

CREATE OR REPLACE FUNCTION private.ledger_from_position() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'closed') THEN
    PERFORM private.ledger_upsert(NEW.user_id, 'position_pnl', NEW.currency, COALESCE(NEW.realized_pnl,0), 'COMPLETED', 'positions', NEW.id, NULL, NEW.display_symbol || ' ' || NEW.side::text, COALESCE(NEW.closed_at, now()));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ledger_positions AFTER INSERT OR UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION private.ledger_from_position();

-- Backfill
INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, tx_hash, note, created_at)
SELECT user_id, 'deposit', coin, amount, private.map_request_status(status::text), 'deposits', id, tx_hash, network, created_at FROM public.deposits
ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, note, created_at)
SELECT user_id, 'withdrawal', coin, -amount, private.map_request_status(status::text), 'withdrawals', id, network || ' -> ' || destination_address, created_at FROM public.withdrawals
ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, note, created_at)
SELECT user_id, 'swap_out', from_currency, -from_amount, 'COMPLETED', 'swaps', id, from_currency || ' -> ' || to_currency, created_at FROM public.swaps
ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, note, created_at)
SELECT user_id, 'swap_in', to_currency, to_amount, 'COMPLETED', 'swaps', id, from_currency || ' -> ' || to_currency, created_at FROM public.swaps
ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, note, created_at)
SELECT user_id, 'contract_stake', currency, -(stake + COALESCE(fee_paid,0)), 'COMPLETED', 'contracts', id, display_symbol || ' ' || direction, opened_at FROM public.contracts
ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, note, created_at)
SELECT user_id, 'contract_settlement', currency, COALESCE(payout,0), 'COMPLETED', 'contracts', id, display_symbol || ' ' || COALESCE(result,''), COALESCE(settled_at, opened_at) FROM public.contracts WHERE status = 'settled'
ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (user_id, kind, currency, amount, status, ref_table, ref_id, note, created_at)
SELECT user_id, 'position_pnl', currency, COALESCE(realized_pnl,0), 'COMPLETED', 'positions', id, display_symbol || ' ' || side::text, COALESCE(closed_at, opened_at) FROM public.positions WHERE status = 'closed'
ON CONFLICT DO NOTHING;

-- 2. KYC document + live selfie validation
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS selfie_capture jsonb;
ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS level2_selfie_capture jsonb;

CREATE OR REPLACE FUNCTION private.validate_selfie_capture(p_meta jsonb) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_meta IS NOT NULL
    AND p_meta->>'source' = 'camera'
    AND (p_meta->>'capturedAt') IS NOT NULL
    AND (p_meta->>'capturedAt')::timestamptz BETWEEN now() - interval '30 minutes' AND now() + interval '2 minutes';
$$;

CREATE OR REPLACE FUNCTION public.validate_kyc_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_prefix text := NEW.user_id::text || '/';
BEGIN
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending' OR NEW.selfie_path IS DISTINCT FROM OLD.selfie_path OR NEW.document_path IS DISTINCT FROM OLD.document_path) THEN
    IF NEW.document_type NOT IN ('passport','id_card','drivers_license') THEN
      RAISE EXCEPTION 'Unsupported identity document type';
    END IF;
    IF NEW.document_path IS NULL OR NEW.document_path NOT LIKE owner_prefix || '%' THEN
      RAISE EXCEPTION 'A valid identity document upload is required';
    END IF;
    IF NEW.selfie_path IS NULL OR NEW.selfie_path NOT LIKE owner_prefix || 'selfie-%' THEN
      RAISE EXCEPTION 'A valid selfie upload is required';
    END IF;
    IF NOT private.validate_selfie_capture(NEW.selfie_capture) THEN
      RAISE EXCEPTION 'Selfie must be captured live with the in-app camera';
    END IF;
  END IF;
  IF NEW.level2_status = 'pending' AND (TG_OP = 'INSERT' OR OLD.level2_status IS DISTINCT FROM 'pending') THEN
    IF NEW.level2_proof_path IS NULL OR NEW.level2_proof_path NOT LIKE owner_prefix || '%' THEN
      RAISE EXCEPTION 'A valid proof of address upload is required';
    END IF;
    IF NEW.level2_selfie_path IS NULL OR NEW.level2_selfie_path NOT LIKE owner_prefix || 'level2-selfie-%' THEN
      RAISE EXCEPTION 'A valid liveness selfie upload is required';
    END IF;
    IF NOT private.validate_selfie_capture(NEW.level2_selfie_capture) THEN
      RAISE EXCEPTION 'Liveness selfie must be captured live with the in-app camera';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kyc_validate_submission BEFORE INSERT OR UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_kyc_submission();

-- 3. 60-day display name cooldown at the database
CREATE OR REPLACE FUNCTION public.enforce_display_name_cooldown() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    IF OLD.display_name_updated_at IS NOT NULL AND OLD.display_name_updated_at > now() - interval '60 days' THEN
      RAISE EXCEPTION 'Name updated. Can only be modified once every 60 days.';
    END IF;
    NEW.display_name_updated_at := now();
  ELSIF NEW.display_name_updated_at IS DISTINCT FROM OLD.display_name_updated_at THEN
    NEW.display_name_updated_at := OLD.display_name_updated_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_name_cooldown BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_display_name_cooldown();

REVOKE EXECUTE ON FUNCTION public.validate_kyc_submission() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_display_name_cooldown() FROM PUBLIC, anon, authenticated;