ALTER TABLE public.scalping_tier_rules
 ADD COLUMN max_trade_amount numeric,
 ADD COLUMN allowed_pairs text[] NOT NULL DEFAULT '{}',
 ADD COLUMN commission_pct numeric NOT NULL DEFAULT 0,
 ADD COLUMN daily_payout_cap numeric,
 ADD CONSTRAINT scalping_max_stake CHECK (max_trade_amount IS NULL OR (max_trade_amount >= min_trade_amount AND max_trade_amount <= 100000000)),
 ADD CONSTRAINT scalping_commission_range CHECK (commission_pct BETWEEN 0 AND 100),
 ADD CONSTRAINT scalping_daily_cap_positive CHECK (daily_payout_cap IS NULL OR daily_payout_cap > 0);
ALTER TABLE public.contracts ADD COLUMN protocol_fee_pct numeric NOT NULL DEFAULT 0;
CREATE INDEX contracts_tier_payout_day ON public.contracts(tier_id, expires_at);
COMMENT ON COLUMN public.scalping_tier_rules.daily_payout_cap IS 'Aggregate USDT total payout budget across all users per UTC expiry day. Open contracts reserve full winning payout; accepted payouts are never clipped.';
COMMENT ON COLUMN public.scalping_tier_rules.commission_pct IS 'Protocol commission on stake, charged at entry in addition to the existing account trading fee. Zero preserves prior pricing.';
CREATE OR REPLACE FUNCTION public.validate_contract_tier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rule public.scalping_tier_rules; day_start timestamptz; committed numeric; maximum_payout numeric; protocol_fee numeric;
BEGIN
 SELECT * INTO rule FROM public.scalping_tier_rules WHERE id=NEW.tier_id FOR UPDATE;
 IF NOT FOUND OR NOT rule.active OR rule.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'This duration tier is no longer available'; END IF;
 IF NEW.tier_version IS DISTINCT FROM rule.updated_at OR NEW.duration_seconds <> rule.duration_seconds OR NEW.payout_pct <> rule.roi_pct THEN RAISE EXCEPTION 'Trade configuration changed. Review current terms and submit again'; END IF;
 IF NEW.stake IS NULL OR NEW.stake < rule.min_trade_amount THEN RAISE EXCEPTION 'Investment is below the current tier minimum'; END IF;
 IF rule.max_trade_amount IS NOT NULL AND NEW.stake > rule.max_trade_amount THEN RAISE EXCEPTION 'Investment exceeds the current tier maximum'; END IF;
 IF cardinality(rule.allowed_pairs)>0 AND NOT (NEW.symbol=ANY(rule.allowed_pairs)) THEN RAISE EXCEPTION 'This trading pair is not eligible for the selected tier'; END IF;
 IF NEW.currency <> 'USDT' OR NEW.leverage NOT IN (1,2,5,10) OR NEW.status <> 'open' OR NEW.expires_at IS NULL THEN RAISE EXCEPTION 'Invalid scalping contract'; END IF;
 NEW.opened_at := clock_timestamp();
 NEW.expires_at := NEW.opened_at + make_interval(secs => rule.duration_seconds);
 NEW.protocol_fee_pct := rule.commission_pct;
 protocol_fee := round(NEW.stake * rule.commission_pct / 100,8);
 IF NEW.fee_paid IS NULL OR NEW.fee_paid < protocol_fee THEN RAISE EXCEPTION 'Contract commission is missing'; END IF;
 maximum_payout := NEW.stake + NEW.stake * NEW.payout_pct * NEW.leverage / 100;
 IF rule.daily_payout_cap IS NOT NULL THEN
  day_start := date_trunc('day',NEW.expires_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  SELECT coalesce(sum(CASE WHEN status='open' THEN stake+stake*payout_pct*leverage/100 ELSE coalesce(payout,0) END),0) INTO committed
  FROM public.contracts WHERE tier_id=rule.id AND expires_at>=day_start AND expires_at<day_start+interval '24 hours';
  IF committed+maximum_payout>rule.daily_payout_cap THEN RAISE EXCEPTION 'Daily payout capacity for this tier is exhausted. Select another tier or try again later'; END IF;
 END IF;
 -- Contract creation and the complete stake/fee debit share one transaction.
 PERFORM public.wallet_adjust(NEW.user_id,NEW.currency,-(NEW.stake+NEW.fee_paid));
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.audit_scalping_rule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE reason text := nullif(trim(NEW.audit_reason),'');
BEGIN
 IF reason IS NULL THEN
  reason := CASE WHEN TG_OP='INSERT' THEN 'Confirmed scalping tier creation' WHEN NEW.deleted_at IS NOT NULL THEN 'Confirmed scalping tier removal' WHEN OLD.active IS DISTINCT FROM NEW.active AND NOT NEW.active THEN 'Confirmed scalping tier deactivation' WHEN OLD.active IS DISTINCT FROM NEW.active AND NEW.active THEN 'Confirmed scalping tier activation' ELSE 'Confirmed scalping tier update' END;
 END IF;
 NEW.updated_at:=clock_timestamp();
 IF auth.uid() IS NOT NULL THEN
 INSERT INTO public.admin_audit_logs(actor_id,action,details) VALUES(auth.uid(),CASE WHEN NEW.deleted_at IS NOT NULL THEN 'scalping_tier_removed' ELSE 'scalping_tier_saved' END,jsonb_build_object('tier_id',NEW.id,'label',NEW.label,'duration_seconds',NEW.duration_seconds,'min_trade_amount',NEW.min_trade_amount,'max_trade_amount',NEW.max_trade_amount,'allowed_pairs',NEW.allowed_pairs,'commission_pct',NEW.commission_pct,'daily_payout_cap',NEW.daily_payout_cap,'roi_pct',NEW.roi_pct,'active',NEW.active,'reason',reason));
 END IF;
 NEW.audit_reason:=''; RETURN NEW;
END $$;