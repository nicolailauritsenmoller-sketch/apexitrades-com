ALTER TABLE public.contracts ADD COLUMN engine_version text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.positions ADD COLUMN engine_version text NOT NULL DEFAULT 'legacy';
CREATE TABLE public.trade_settlements (
 trade_id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id), kind text NOT NULL CHECK(kind IN ('contract','position')),
 product_type text NOT NULL, symbol text NOT NULL, currency text NOT NULL, side text NOT NULL CHECK(side IN ('long','short')),
 leverage numeric NOT NULL CHECK(leverage>=1 AND leverage<=100), initial_margin numeric NOT NULL CHECK(initial_margin>0),
 quantity numeric NOT NULL CHECK(quantity>0), notional numeric NOT NULL CHECK(notional>0), average_entry numeric NOT NULL CHECK(average_entry>0),
 average_exit numeric, opening_fee numeric NOT NULL, closing_fee numeric NOT NULL DEFAULT 0, funding_fee numeric NOT NULL DEFAULT 0,
 adjustments numeric NOT NULL DEFAULT 0, gross_pnl numeric, net_pnl numeric, roi_pct numeric, wallet_credit numeric,
 balance_before_open numeric NOT NULL, balance_after_open numeric NOT NULL, balance_before_close numeric, balance_after_close numeric,
 opened_at timestamptz NOT NULL, settled_at timestamptz, expires_at timestamptz, close_reason text, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','settled')),
 price_source text NOT NULL, price_observed_at timestamptz NOT NULL
);
GRANT SELECT ON public.trade_settlements TO authenticated;
GRANT ALL ON public.trade_settlements TO service_role;
ALTER TABLE public.trade_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY settlement_read ON public.trade_settlements FOR SELECT TO authenticated USING(auth.uid()=user_id OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'finance'::public.app_role));
CREATE TABLE public.execution_fills (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trade_id uuid NOT NULL REFERENCES public.trade_settlements(trade_id), user_id uuid NOT NULL,
 leg text NOT NULL CHECK(leg IN ('entry','exit')), quantity numeric NOT NULL CHECK(quantity>0), price numeric NOT NULL CHECK(price>0),
 fee numeric NOT NULL, currency text NOT NULL, source text NOT NULL, source_reference text NOT NULL, observed_at timestamptz NOT NULL,
 executed_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(trade_id,leg,source_reference)
);
GRANT SELECT ON public.execution_fills TO authenticated;
GRANT ALL ON public.execution_fills TO service_role;
ALTER TABLE public.execution_fills ENABLE ROW LEVEL SECURITY;
CREATE POLICY fill_read ON public.execution_fills FOR SELECT TO authenticated USING(auth.uid()=user_id OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'finance'::public.app_role));
CREATE TABLE public.trade_reconciliation (
 trade_id uuid PRIMARY KEY, user_id uuid NOT NULL, kind text NOT NULL, reason text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trade_reconciliation TO authenticated;
GRANT ALL ON public.trade_reconciliation TO service_role;
ALTER TABLE public.trade_reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY reconciliation_read ON public.trade_reconciliation FOR SELECT TO authenticated USING(auth.uid()=user_id OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'finance'::public.app_role));
-- Additive reconciliation inventory only: original trades, ledger and wallets are untouched.
INSERT INTO public.trade_reconciliation(trade_id,user_id,kind,reason) SELECT id,user_id,'contract','Legacy fixed-return contract; execution log records stake as quantity and has no execution prices. Recorded payout is not verified linear P&L.' FROM public.contracts;
INSERT INTO public.trade_reconciliation(trade_id,user_id,kind,reason) SELECT id,user_id,'position','Legacy position has no immutable priced fill ledger or atomic settlement evidence; requires reconciliation.' FROM public.positions;
CREATE FUNCTION public.reject_financial_evidence_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Financial evidence is immutable'; END $$;
CREATE TRIGGER fills_immutable BEFORE UPDATE OR DELETE ON public.execution_fills FOR EACH ROW EXECUTE FUNCTION public.reject_financial_evidence_mutation();
CREATE TRIGGER reconciliation_immutable BEFORE UPDATE OR DELETE ON public.trade_reconciliation FOR EACH ROW EXECUTE FUNCTION public.reject_financial_evidence_mutation();
CREATE FUNCTION public.guard_linear_settlement() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status='settled' THEN RAISE EXCEPTION 'Completed settlement is immutable'; END IF;
 IF current_setting('app.linear_write',true) IS DISTINCT FROM OLD.trade_id::text THEN RAISE EXCEPTION 'Use atomic trading engine'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER settlements_guard BEFORE UPDATE OR DELETE ON public.trade_settlements FOR EACH ROW EXECUTE FUNCTION public.guard_linear_settlement();
CREATE FUNCTION public.guard_trade_financial_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.engine_version<>'linear_v1' OR current_setting('app.linear_write',true) IS DISTINCT FROM NEW.id::text THEN RAISE EXCEPTION 'Use atomic linear order entry'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Trade records are immutable'; END IF;
 IF TG_TABLE_NAME='contracts' THEN
  IF (to_jsonb(NEW)-'outcome_override') IS DISTINCT FROM (to_jsonb(OLD)-'outcome_override') AND current_setting('app.linear_write',true) IS DISTINCT FROM OLD.id::text THEN RAISE EXCEPTION 'Trade financial fields require atomic settlement; historical records cannot be rewritten'; END IF;
 ELSE
  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) AND current_setting('app.linear_write',true) IS DISTINCT FROM OLD.id::text THEN RAISE EXCEPTION 'Trade financial fields require atomic settlement; historical records cannot be rewritten'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_contract_financial_guard BEFORE INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.guard_trade_financial_fields();
CREATE TRIGGER a_position_financial_guard BEFORE INSERT OR UPDATE OR DELETE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.guard_trade_financial_fields();
-- Preserve tier eligibility/minimum/maximum/commission guards. Fixed payout caps are not valid linear exposure caps.
CREATE OR REPLACE FUNCTION public.validate_contract_tier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rule public.scalping_tier_rules;
BEGIN
 SELECT * INTO rule FROM public.scalping_tier_rules WHERE id=NEW.tier_id FOR UPDATE;
 IF NOT FOUND OR NOT rule.active OR rule.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'This duration tier is no longer available'; END IF;
 IF NEW.tier_version IS DISTINCT FROM rule.updated_at OR NEW.duration_seconds<>rule.duration_seconds THEN RAISE EXCEPTION 'Trade configuration changed. Review current terms and submit again'; END IF;
 IF NEW.stake IS NULL OR NEW.stake<rule.min_trade_amount THEN RAISE EXCEPTION 'Investment is below the current tier minimum'; END IF;
 IF rule.max_trade_amount IS NOT NULL AND NEW.stake>rule.max_trade_amount THEN RAISE EXCEPTION 'Investment exceeds the current tier maximum'; END IF;
 IF cardinality(rule.allowed_pairs)>0 AND NOT NEW.symbol=ANY(rule.allowed_pairs) THEN RAISE EXCEPTION 'This trading pair is not eligible for the selected tier'; END IF;
 IF NEW.currency<>'USDT' OR NEW.leverage NOT IN (1,2,5,10) OR NEW.status<>'open' THEN RAISE EXCEPTION 'Invalid linear timed contract'; END IF;
 IF rule.daily_payout_cap IS NOT NULL THEN RAISE EXCEPTION 'This tier has legacy fixed-payout limits. Linear execution requires an approved exposure policy'; END IF;
 NEW.opened_at:=clock_timestamp(); NEW.expires_at:=NEW.opened_at+make_interval(secs=>rule.duration_seconds);
 NEW.protocol_fee_pct:=rule.commission_pct;
 IF NEW.fee_paid<round(NEW.stake*rule.commission_pct/100,8) THEN RAISE EXCEPTION 'Contract commission is missing'; END IF;
 PERFORM public.wallet_adjust(NEW.user_id,NEW.currency,-(NEW.stake+NEW.fee_paid));
 RETURN NEW;
END $$;
CREATE FUNCTION public.validate_execution_quote(p_quote jsonb,p_earliest timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE observed timestamptz:=(p_quote->>'observedAt')::timestamptz; price numeric:=(p_quote->>'price')::numeric;
BEGIN
 IF price IS NULL OR price<=0 OR price::text IN ('NaN','Infinity','-Infinity') OR p_quote->>'source' NOT IN ('binance_trade','coinbase_trade','yahoo_regular_market') OR p_quote->>'reference' IS NULL OR observed IS NULL OR observed<clock_timestamp()-interval '60 seconds' OR observed>clock_timestamp()+interval '5 seconds' THEN RAISE EXCEPTION 'Fresh verifiable execution price required'; END IF;
 IF p_earliest IS NOT NULL AND (observed<p_earliest OR observed>p_earliest+interval '60 seconds') THEN RAISE EXCEPTION 'Expiry execution price unavailable; reconciliation required'; END IF;
END $$;
CREATE FUNCTION public.open_linear_trade(p_user uuid,p_kind text,p_symbol text,p_display text,p_asset text,p_currency text,p_side text,p_size numeric,p_leverage numeric,p_fee_rate numeric,p_quote jsonb,p_tier uuid DEFAULT NULL,p_version timestamptz DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE id uuid:=gen_random_uuid(); price numeric; qty numeric; margin numeric; notion numeric; fee numeric; protocol numeric:=0; before_balance numeric; after_balance numeric; op timestamptz; expiry timestamptz; rule public.scalping_tier_rules;
BEGIN
 IF p_kind NOT IN ('contract','position') OR p_side NOT IN ('long','short') OR p_size IS NULL OR p_size<=0 OR p_size>100000000 OR p_leverage IS NULL OR p_leverage<1 OR p_leverage>100 OR p_fee_rate IS NULL OR abs(p_fee_rate)>100 THEN RAISE EXCEPTION 'Invalid linear order'; END IF;
 IF p_quote->>'symbol' IS DISTINCT FROM p_symbol THEN RAISE EXCEPTION 'Execution symbol mismatch'; END IF;
 PERFORM public.validate_execution_quote(p_quote);
 PERFORM 1 FROM profiles WHERE profiles.id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF EXISTS(SELECT 1 FROM profiles WHERE profiles.id=p_user AND (account_frozen OR trading_frozen OR (margin_restricted AND p_leverage>1))) THEN RAISE EXCEPTION 'Account trading restricted'; END IF;
 price:=(p_quote->>'price')::numeric;
 IF p_kind='contract' THEN
  margin:=p_size; notion:=margin*p_leverage; qty:=round(notion/price,18); notion:=qty*price;
  SELECT * INTO rule FROM scalping_tier_rules WHERE scalping_tier_rules.id=p_tier FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tier not found'; END IF;
  protocol:=round(margin*rule.commission_pct/100,8);
 ELSE qty:=p_size; notion:=qty*price; margin:=round(notion/p_leverage,18); END IF;
 fee:=round(notion*p_fee_rate/100,8)+protocol;
 SELECT balance INTO before_balance FROM wallets WHERE user_id=p_user AND currency=p_currency FOR UPDATE;
 IF before_balance IS NULL OR before_balance<margin+fee THEN RAISE EXCEPTION 'Insufficient margin including opening fees'; END IF;
 PERFORM set_config('app.linear_write',id::text,true);
 IF p_kind='contract' THEN
  INSERT INTO contracts(id,user_id,symbol,display_symbol,direction,stake,currency,duration_seconds,payout_pct,tier_id,tier_version,entry_price,fee_paid,leverage,engine_version)
  VALUES(id,p_user,p_symbol,p_display,CASE WHEN p_side='long' THEN 'up' ELSE 'down' END,margin,p_currency,rule.duration_seconds,0,p_tier,p_version,price,fee,p_leverage,'linear_v1') RETURNING opened_at,expires_at INTO op,expiry;
 ELSE
  PERFORM public.wallet_adjust(p_user,p_currency,-(margin+fee));
  INSERT INTO positions(id,user_id,symbol,display_symbol,asset_class,side,quantity,entry_price,leverage,currency,fees_paid,engine_version)
  VALUES(id,p_user,p_symbol,p_display,p_asset::public.asset_class,p_side::public.trade_side,qty,price,p_leverage,p_currency,fee,'linear_v1') RETURNING opened_at INTO op;
 END IF;
 SELECT balance INTO after_balance FROM wallets WHERE user_id=p_user AND currency=p_currency;
 INSERT INTO trade_settlements(trade_id,user_id,kind,product_type,symbol,currency,side,leverage,initial_margin,quantity,notional,average_entry,opening_fee,balance_before_open,balance_after_open,opened_at,expires_at,price_source,price_observed_at)
 VALUES(id,p_user,p_kind,CASE WHEN p_kind='contract' THEN 'Timed linear' ELSE 'Linear margin' END,p_symbol,p_currency,p_side,p_leverage,margin,qty,notion,price,fee,before_balance,after_balance,op,expiry,p_quote->>'source',(p_quote->>'observedAt')::timestamptz);
 INSERT INTO execution_fills(trade_id,user_id,leg,quantity,price,fee,currency,source,source_reference,observed_at) VALUES(id,p_user,'entry',qty,price,fee,p_currency,p_quote->>'source',p_quote->>'reference',(p_quote->>'observedAt')::timestamptz);
 INSERT INTO trade_executions(user_id,ref_type,ref_id,symbol,side,requested_qty,filled_qty,submitted_at,acknowledged_at,filled_at,status) VALUES(p_user,CASE WHEN p_kind='contract' THEN 'contract' ELSE 'position_open' END,id,p_symbol,p_side,qty,qty,op,op,op,'filled');
 RETURN id;
END $$;
CREATE FUNCTION public.settle_linear_trade(p_id uuid,p_user uuid,p_quote jsonb,p_close_rate numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.trade_settlements; entry_qty numeric; exit_qty numeric; entry_avg numeric; exit_avg numeric; opening numeric; closing numeric; gross numeric; net numeric; credit numeric; before_balance numeric; after_balance numeric; at_time timestamptz; result text;
BEGIN
 SELECT * INTO t FROM trade_settlements WHERE trade_id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Priced execution data missing; reconciliation required'; END IF;
 IF t.status='settled' THEN RETURN jsonb_build_object('settled',false,'trade_id',t.trade_id,'net_pnl',t.net_pnl::text); END IF;
 IF p_quote->>'symbol' IS DISTINCT FROM t.symbol THEN RAISE EXCEPTION 'Execution symbol mismatch'; END IF;
 IF p_close_rate IS NULL OR abs(p_close_rate)>100 THEN RAISE EXCEPTION 'Invalid closing fee'; END IF;
 IF t.kind='contract' THEN
  IF clock_timestamp()<t.expires_at THEN RAISE EXCEPTION 'Contract has not expired'; END IF;
  PERFORM public.validate_execution_quote(p_quote,t.expires_at);
 ELSE PERFORM public.validate_execution_quote(p_quote); END IF;
 SELECT sum(quantity),sum(quantity*price)/sum(quantity),sum(fee) INTO entry_qty,entry_avg,opening FROM execution_fills WHERE trade_id=p_id AND leg='entry';
 IF entry_qty IS NULL OR entry_qty<>t.quantity OR abs(entry_avg-t.average_entry)>0.000000000001 OR opening<>t.opening_fee THEN RAISE EXCEPTION 'Entry fills do not reconcile; review required'; END IF;
 PERFORM set_config('app.linear_write',p_id::text,true);
 INSERT INTO execution_fills(trade_id,user_id,leg,quantity,price,fee,currency,source,source_reference,observed_at)
 VALUES(p_id,p_user,'exit',entry_qty,(p_quote->>'price')::numeric,round(entry_qty*(p_quote->>'price')::numeric*p_close_rate/100,8),t.currency,p_quote->>'source',p_quote->>'reference',(p_quote->>'observedAt')::timestamptz);
 SELECT sum(quantity),sum(quantity*price)/sum(quantity),sum(fee) INTO exit_qty,exit_avg,closing FROM execution_fills WHERE trade_id=p_id AND leg='exit';
 IF exit_qty<>entry_qty THEN RAISE EXCEPTION 'Exit quantity mismatch; reconciliation required'; END IF;
 gross:=entry_qty*(exit_avg-entry_avg)*CASE WHEN t.side='long' THEN 1 ELSE -1 END;
 net:=gross-opening-closing-t.funding_fee+t.adjustments;
 credit:=t.initial_margin+gross-closing-t.funding_fee+t.adjustments;
 -- Never hide insolvency with a clamped payout or fabricate an extra wallet debit.
 IF credit<0 THEN RAISE EXCEPTION 'Loss exceeds isolated margin; liquidation reconciliation required'; END IF;
 SELECT balance INTO before_balance FROM wallets WHERE user_id=p_user AND currency=t.currency FOR UPDATE;
 IF before_balance IS NULL THEN RAISE EXCEPTION 'Wallet missing'; END IF;
 after_balance:=public.wallet_adjust(p_user,t.currency,credit); at_time:=clock_timestamp(); result:=CASE WHEN net>0 THEN 'win' WHEN net<0 THEN 'loss' ELSE 'draw' END;
 UPDATE trade_settlements SET average_entry=entry_avg,average_exit=exit_avg,opening_fee=opening,closing_fee=closing,gross_pnl=gross,net_pnl=net,roi_pct=net/t.initial_margin*100,wallet_credit=credit,balance_before_close=before_balance,balance_after_close=after_balance,settled_at=at_time,status='settled',close_reason=CASE WHEN t.kind='contract' THEN 'Scheduled timed settlement' ELSE 'Manual close' END,price_source=p_quote->>'source',price_observed_at=(p_quote->>'observedAt')::timestamptz WHERE trade_id=p_id;
 IF t.kind='contract' THEN
  UPDATE contracts SET status='settled',exit_price=exit_avg,result=result,payout=credit,settled_at=at_time WHERE id=p_id;
 ELSE
  UPDATE positions SET status='closed',exit_price=exit_avg,realized_pnl=net,fees_paid=opening+closing,closed_at=at_time WHERE id=p_id;
 END IF;
 INSERT INTO trade_executions(user_id,ref_type,ref_id,symbol,side,requested_qty,filled_qty,submitted_at,acknowledged_at,filled_at,status) VALUES(p_user,CASE WHEN t.kind='contract' THEN 'contract_close' ELSE 'position_close' END,p_id,t.symbol,t.side,entry_qty,entry_qty,at_time,at_time,at_time,'filled');
 RETURN jsonb_build_object('settled',true,'trade_id',p_id,'net_pnl',net::text);
END $$;
-- The former RPC accepted arbitrary caller-calculated payouts. Retire it rather than leaving a bypass.
CREATE OR REPLACE FUNCTION public.settle_contract_atomic(p_id uuid,p_user uuid,p_exit numeric,p_result text,p_payout numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Legacy fixed-return settlement disabled; use verified linear settlement'; END $$;
CREATE OR REPLACE FUNCTION private.ledger_from_position() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE credit numeric;
BEGIN
 IF NEW.engine_version='linear_v1' THEN
  IF TG_OP='INSERT' THEN
   PERFORM private.ledger_upsert(NEW.user_id,'position_margin',NEW.currency,-(NEW.quantity*NEW.entry_price/NEW.leverage+NEW.fees_paid),'COMPLETED','positions',NEW.id,NULL,NEW.display_symbol,NEW.opened_at);
  ELSIF NEW.status='closed' AND OLD.status<>'closed' THEN
   SELECT wallet_credit INTO credit FROM trade_settlements WHERE trade_id=NEW.id;
   PERFORM private.ledger_upsert(NEW.user_id,'position_settlement',NEW.currency,credit,'COMPLETED','positions',NEW.id,NULL,NEW.display_symbol,NEW.closed_at);
  END IF;
 ELSE
  IF NEW.status='closed' AND (TG_OP='INSERT' OR OLD.status<>'closed') THEN PERFORM private.ledger_upsert(NEW.user_id,'position_pnl',NEW.currency,NEW.realized_pnl,'COMPLETED','positions',NEW.id,NULL,NEW.display_symbol,NEW.closed_at); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_contract_settled() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE net numeric;
BEGIN
 IF NEW.result IS NOT NULL AND OLD.result IS NULL THEN
  SELECT net_pnl INTO net FROM trade_settlements WHERE trade_id=NEW.id;
  net:=coalesce(net,NEW.payout-NEW.stake-NEW.fee_paid);
  INSERT INTO notifications(user_id,title,body,kind) VALUES(NEW.user_id,'Timed trade settled',NEW.display_symbol||' '||NEW.leverage::text||'x. Net P/L '||round(net,8)::text||' '||NEW.currency||'.','trade_execution');
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.open_linear_trade(uuid,text,text,text,text,text,text,numeric,numeric,numeric,jsonb,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.open_linear_trade(uuid,text,text,text,text,text,text,numeric,numeric,numeric,jsonb,uuid,timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.settle_linear_trade(uuid,uuid,jsonb,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_linear_trade(uuid,uuid,jsonb,numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.validate_execution_quote(jsonb,timestamptz), public.reject_financial_evidence_mutation(),public.guard_linear_settlement(),public.guard_trade_financial_fields() FROM PUBLIC,anon,authenticated;
COMMENT ON COLUMN public.contracts.payout_pct IS 'DEPRECATED for linear_v1: legacy fixed-return terms only; never determines linear P&L';
COMMENT ON COLUMN public.contracts.outcome_override IS 'Legacy administration only; never affects linear_v1 execution';
COMMENT ON TABLE public.execution_fills IS 'Immutable platform reference-price executions, not claimed external broker fills. Prices and quantities drive linear settlement.';