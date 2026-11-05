CREATE FUNCTION public.request_withdrawal_atomic(p_user uuid,p_coin text,p_network text,p_amount numeric,p_destination text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.withdrawals; daily_cap numeric; used numeric;
BEGIN
 IF p_amount<=0 OR p_amount>100000000 THEN RAISE EXCEPTION 'Invalid withdrawal amount'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':withdrawal',0));
 IF EXISTS(SELECT 1 FROM profiles WHERE id=p_user AND (withdrawals_disabled OR account_frozen)) THEN RAISE EXCEPTION 'Withdrawals disabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM kyc_submissions WHERE user_id=p_user AND status='approved') THEN RAISE EXCEPTION 'Approved identity verification required'; END IF;
 IF upper(p_coin) IN ('USDT','USDC') THEN
  SELECT daily_limit_usdt INTO daily_cap FROM user_withdrawal_limits WHERE user_id=p_user;
  SELECT coalesce(sum(amount),0) INTO used FROM withdrawals WHERE user_id=p_user AND upper(coin) IN ('USDT','USDC') AND status<>'rejected' AND created_at>=now()-interval '24 hours';
  IF daily_cap IS NOT NULL AND used+p_amount>daily_cap THEN RAISE EXCEPTION 'Daily withdrawal limit exceeded'; END IF;
 END IF;
 PERFORM public.wallet_adjust(p_user,upper(p_coin),-p_amount);
 INSERT INTO withdrawals(user_id,coin,network,amount,destination_address) VALUES(p_user,upper(p_coin),p_network,p_amount,p_destination) RETURNING * INTO w;
 RETURN jsonb_build_object('id',w.id,'created_at',w.created_at);
END $$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal_atomic(uuid,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_atomic(uuid,text,text,numeric,text) TO service_role;