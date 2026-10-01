CREATE OR REPLACE FUNCTION public.swap_assets_atomic(p_user uuid, p_from text, p_to text, p_from_amount numeric, p_to_amount numeric, p_rate numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_from_amount <= 0 OR p_to_amount <= 0 OR p_from = p_to THEN RAISE EXCEPTION 'Invalid swap'; END IF;
  PERFORM public.wallet_adjust(p_user, p_from, -p_from_amount);
  PERFORM public.wallet_adjust(p_user, p_to, p_to_amount);
  INSERT INTO public.swaps (user_id, from_currency, to_currency, from_amount, to_amount, rate)
  VALUES (p_user, p_from, p_to, p_from_amount, p_to_amount, p_rate);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.reward_referral_atomic(p_id uuid, p_amount numeric, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.referrals;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Referral not found'; END IF;
  IF r.status = 'rewarded' THEN RETURN jsonb_build_object('rewarded', false); END IF;
  PERFORM public.wallet_adjust(r.referrer_id, 'USDT', p_amount);
  INSERT INTO public.deposits (user_id, coin, network, amount, status, admin_note, reviewed_by, reviewed_at)
  VALUES (r.referrer_id, 'USDT', 'Referral reward', p_amount, 'approved', 'Referral Bonus (+' || p_amount || ' USDT)', p_actor, now());
  UPDATE public.profiles SET referral_rewards_usdt = referral_rewards_usdt + p_amount WHERE id = r.referrer_id;
  UPDATE public.referrals SET status = 'rewarded', reward_amount = p_amount, rewarded_at = now(), reviewed_by = p_actor WHERE id = p_id;
  RETURN jsonb_build_object('rewarded', true, 'referrer_id', r.referrer_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.swap_assets_atomic(uuid, text, text, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reward_referral_atomic(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.swap_assets_atomic(uuid, text, text, numeric, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.reward_referral_atomic(uuid, numeric, uuid) TO service_role;