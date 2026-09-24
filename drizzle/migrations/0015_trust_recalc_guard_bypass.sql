CREATE OR REPLACE FUNCTION private.recompute_trader_trust(_uid uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s numeric := 0; k record; tfa boolean; dep int; wins int; bal numeric; cap numeric;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  SELECT status::text AS st, level2_status AS l2 INTO k FROM kyc_submissions WHERE user_id = _uid LIMIT 1;
  IF k.st = 'approved' THEN s := s + 5; END IF;
  IF k.l2 = 'approved' THEN s := s + 5; END IF;
  SELECT two_factor_enabled INTO tfa FROM user_security WHERE user_id = _uid;
  IF coalesce(tfa,false) THEN s := s + 5; END IF;
  SELECT count(*) INTO dep FROM deposits WHERE user_id = _uid AND status = 'approved';
  IF dep > 0 THEN s := s + 5; END IF;
  SELECT (SELECT count(*) FROM contracts WHERE user_id=_uid AND status<>'open' AND settled_at IS NOT NULL AND coalesce(payout,0) - stake > 0)
       + (SELECT count(*) FROM positions WHERE user_id=_uid AND status='closed' AND coalesce(realized_pnl,0) > 0)
    INTO wins;
  IF wins > 0 THEN s := s + 3 + (wins - 1) * 2; END IF;
  SELECT coalesce(sum(balance),0) INTO bal FROM wallets WHERE user_id=_uid AND currency IN ('USDT','USD');
  cap := CASE WHEN bal > 5000 THEN 100 ELSE 50 END;
  s := greatest(0, least(cap, s));
  PERFORM set_config('app.trust_recalc', 'on', true);
  UPDATE profiles SET trader_trust_score = s, trust_score_updated_at = now()
    WHERE id = _uid AND trader_trust_score IS DISTINCT FROM s;
  PERFORM set_config('app.trust_recalc', 'off', true);
  RETURN s;
END; $$;
REVOKE ALL ON FUNCTION private.recompute_trader_trust(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('app.trust_recalc', true), 'off') <> 'on'
     AND (NEW.trader_trust_score IS DISTINCT FROM OLD.trader_trust_score
       OR NEW.trust_score_updated_at IS DISTINCT FROM OLD.trust_score_updated_at) THEN
    RAISE EXCEPTION 'Not allowed to modify administrative profile fields';
  END IF;
  IF NEW.outcome_mode IS DISTINCT FROM OLD.outcome_mode
     OR NEW.credit_score IS DISTINCT FROM OLD.credit_score
     OR NEW.vip_tier IS DISTINCT FROM OLD.vip_tier
     OR NEW.vip_upgraded_at IS DISTINCT FROM OLD.vip_upgraded_at
     OR NEW.referral_rewards_usdt IS DISTINCT FROM OLD.referral_rewards_usdt
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.uid IS DISTINCT FROM OLD.uid
     OR NEW.trading_frozen IS DISTINCT FROM OLD.trading_frozen
     OR NEW.withdrawals_disabled IS DISTINCT FROM OLD.withdrawals_disabled
     OR NEW.account_frozen IS DISTINCT FROM OLD.account_frozen
     OR NEW.suspension_status IS DISTINCT FROM OLD.suspension_status
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
     OR NEW.suspension_note IS DISTINCT FROM OLD.suspension_note
     OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
     OR NEW.trust_score_override IS DISTINCT FROM OLD.trust_score_override
     OR NEW.margin_restricted IS DISTINCT FROM OLD.margin_restricted
     OR NEW.verification_required IS DISTINCT FROM OLD.verification_required
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify administrative profile fields';
  END IF;
  RETURN NEW;
END;
$function$;