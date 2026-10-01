REVOKE EXECUTE ON FUNCTION public.purge_old_session_replays() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_kyc_level_status() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wallet_adjust(p_user uuid, p_currency text, p_delta numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v numeric;
BEGIN
  INSERT INTO public.wallets (user_id, currency, balance) VALUES (p_user, p_currency, p_delta)
  ON CONFLICT (user_id, currency) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO v;
  IF v < 0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.settle_deposit_atomic(p_id uuid, p_status text, p_note text, p_reviewer uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.status <> 'pending' THEN RETURN jsonb_build_object('settled', false); END IF;
  UPDATE public.deposits SET status = p_status::request_status, admin_note = p_note, reviewed_by = p_reviewer, reviewed_at = now() WHERE id = p_id;
  IF p_status = 'approved' THEN PERFORM public.wallet_adjust(d.user_id, d.coin, d.amount); END IF;
  RETURN jsonb_build_object('settled', true, 'user_id', d.user_id, 'amount', d.amount, 'coin', d.coin, 'network', d.network, 'tx_hash', d.tx_hash);
END $$;

CREATE OR REPLACE FUNCTION public.review_withdrawal_atomic(p_id uuid, p_status text, p_note text, p_reviewer uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR w.status <> 'pending' THEN RETURN jsonb_build_object('settled', false); END IF;
  UPDATE public.withdrawals SET status = p_status::request_status, admin_note = p_note, reviewed_by = p_reviewer, reviewed_at = now() WHERE id = p_id;
  IF p_status = 'rejected' THEN PERFORM public.wallet_adjust(w.user_id, w.coin, w.amount); END IF;
  RETURN jsonb_build_object('settled', true);
END $$;

CREATE OR REPLACE FUNCTION public.settle_contract_atomic(p_id uuid, p_user uuid, p_exit numeric, p_result text, p_payout numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.contracts;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = p_id AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF c.status <> 'open' THEN
    RETURN jsonb_build_object('settled', false, 'result', c.result, 'exit_price', c.exit_price, 'payout', c.payout, 'currency', c.currency);
  END IF;
  UPDATE public.contracts SET status = 'settled', exit_price = p_exit, result = p_result, payout = p_payout, settled_at = now() WHERE id = p_id;
  IF p_payout > 0 THEN PERFORM public.wallet_adjust(p_user, c.currency, p_payout); END IF;
  RETURN jsonb_build_object('settled', true, 'result', p_result, 'exit_price', p_exit, 'payout', p_payout, 'currency', c.currency);
END $$;

REVOKE EXECUTE ON FUNCTION public.wallet_adjust(uuid,text,numeric), public.settle_deposit_atomic(uuid,text,text,uuid), public.review_withdrawal_atomic(uuid,text,text,uuid), public.settle_contract_atomic(uuid,uuid,numeric,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_adjust(uuid,text,numeric), public.settle_deposit_atomic(uuid,text,text,uuid), public.review_withdrawal_atomic(uuid,text,text,uuid), public.settle_contract_atomic(uuid,uuid,numeric,text,numeric) TO service_role;