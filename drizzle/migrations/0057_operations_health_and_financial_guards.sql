CREATE TABLE public.operations_feed_checks (
 feed text PRIMARY KEY CHECK (feed IN ('alpha','listings','quotes','chart','news')),
 checked_at timestamptz NOT NULL DEFAULT now(), last_success_at timestamptz,
 status text NOT NULL CHECK (status IN ('healthy','degraded','unavailable')),
 row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0), latency_ms integer NOT NULL DEFAULT 0,
 detail text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.operations_feed_checks TO authenticated;
GRANT ALL ON public.operations_feed_checks TO service_role;
ALTER TABLE public.operations_feed_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY operations_checks_admin ON public.operations_feed_checks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin'));

CREATE TABLE public.platform_setting_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL,
 before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now(), actor_id uuid
);
GRANT SELECT ON public.platform_setting_revisions TO authenticated;
GRANT ALL ON public.platform_setting_revisions TO service_role;
ALTER TABLE public.platform_setting_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY setting_revisions_admin ON public.platform_setting_revisions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin'));
CREATE INDEX setting_revisions_time ON public.platform_setting_revisions(created_at DESC);
CREATE FUNCTION public.capture_platform_setting_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.value IS NOT DISTINCT FROM OLD.value THEN RETURN NEW; END IF;
 INSERT INTO public.platform_setting_revisions(key,before_value,after_value,actor_id) VALUES(NEW.key,CASE WHEN TG_OP='UPDATE' THEN OLD.value ELSE NULL END,NEW.value,coalesce(auth.uid(),nullif(current_setting('app.operator_id',true),'')::uuid));
 RETURN NEW;
END $$;
CREATE TRIGGER platform_settings_revision AFTER INSERT OR UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.capture_platform_setting_revision();
CREATE TRIGGER immutable_setting_revision BEFORE UPDATE OR DELETE ON public.platform_setting_revisions FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();
REVOKE EXECUTE ON FUNCTION public.capture_platform_setting_revision() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.financial_review_approvals (
 request_id uuid NOT NULL, request_kind text NOT NULL CHECK(request_kind IN ('withdrawal','correction')),
 approver_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(request_kind,request_id,approver_id)
);
GRANT SELECT ON public.financial_review_approvals TO authenticated;
GRANT ALL ON public.financial_review_approvals TO service_role;
ALTER TABLE public.financial_review_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_approvals_staff ON public.financial_review_approvals FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('admin','finance')));
CREATE TRIGGER immutable_financial_approval BEFORE UPDATE OR DELETE ON public.financial_review_approvals FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

CREATE TABLE public.credited_deposit_transfers (
 network text NOT NULL, coin text NOT NULL, transfer_id text NOT NULL,
 deposit_id uuid NOT NULL UNIQUE, credited_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(network,coin,transfer_id)
);
GRANT ALL ON public.credited_deposit_transfers TO service_role;
ALTER TABLE public.credited_deposit_transfers ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.validate_receiving_address() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n text:=upper(NEW.network); c text:=upper(NEW.coin); a text:=trim(NEW.address); valid boolean:=false;
BEGIN
 IF NOT NEW.active OR NEW.status <> 'active' THEN RETURN NEW; END IF;
 IF NOT ((c='BTC' AND n='BITCOIN') OR (c='ETH' AND n='ERC20') OR (c='USDT' AND n IN ('TRC20','ERC20','BEP20','SOL')) OR (c='USDC' AND n IN ('ERC20','SOL','BASE','BEP20')) OR (c='BNB' AND n='BEP20') OR (c='SOL' AND n='SOL') OR (c='XRP' AND n='XRP') OR (c='XLM' AND n='XLM')) THEN RAISE EXCEPTION 'Unsupported asset/network combination'; END IF;
 valid:= CASE WHEN n='TRC20' THEN a ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' WHEN n IN ('ERC20','BEP20','BASE') THEN a ~ '^0x[0-9a-fA-F]{40}$' WHEN n='BITCOIN' THEN a ~ '^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$' WHEN n='SOL' THEN a ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' WHEN n='XRP' THEN a ~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$' WHEN n='XLM' THEN a ~ '^G[A-Z2-7]{55}$' ELSE false END;
 IF NOT valid THEN RAISE EXCEPTION 'Invalid receiving address format'; END IF;
 IF n IN ('XRP','XLM') AND coalesce(trim(NEW.memo),'')='' THEN RAISE EXCEPTION 'Destination tag or memo required'; END IF;
 IF n='XRP' AND NEW.memo !~ '^[0-9]{1,10}$' THEN RAISE EXCEPTION 'Invalid XRP tag'; END IF;
 IF n='XLM' AND length(NEW.memo)>28 THEN RAISE EXCEPTION 'Invalid XLM memo'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_active_receiving_address BEFORE INSERT OR UPDATE ON public.deposit_addresses FOR EACH ROW EXECUTE FUNCTION public.validate_receiving_address();
REVOKE EXECUTE ON FUNCTION public.validate_receiving_address() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.settle_deposit_atomic(p_id uuid,p_status text,p_note text,p_reviewer uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.deposits; h text; n text;
BEGIN
 IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid settlement status'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_reviewer AND role IN ('admin','finance')) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 SELECT * INTO d FROM public.deposits WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR d.status<>'pending' THEN RETURN jsonb_build_object('settled',false); END IF;
 IF p_status='approved' THEN
  n:=upper(trim(d.network)); h:=trim(coalesce(d.tx_hash,''));
  IF h='' THEN RAISE EXCEPTION 'A verified transaction reference is required before crediting a deposit'; END IF;
  IF n IN ('ERC20','BEP20','BASE','BITCOIN','BTC') THEN h:=lower(h); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(n||':'||upper(d.coin)||':'||h,0));
  IF EXISTS(SELECT 1 FROM public.deposits WHERE id<>d.id AND status='approved' AND upper(trim(network))=n AND upper(coin)=upper(d.coin) AND CASE WHEN n IN ('ERC20','BEP20','BASE','BITCOIN','BTC') THEN lower(trim(tx_hash)) ELSE trim(tx_hash) END=h) THEN RAISE EXCEPTION 'This transfer has already been credited'; END IF;
  INSERT INTO public.credited_deposit_transfers(network,coin,transfer_id,deposit_id) VALUES(n,upper(d.coin),h,d.id);
 END IF;
 UPDATE public.deposits SET status=p_status::request_status,admin_note=p_note,reviewed_by=p_reviewer,reviewed_at=now() WHERE id=p_id;
 IF p_status='approved' THEN
  PERFORM public.wallet_adjust(d.user_id,d.coin,d.amount);
  INSERT INTO public.notifications(user_id,title,body,kind) VALUES(d.user_id,'Deposit settled',d.amount||' '||d.coin||' ('||d.network||') - clearing complete.','success');
 ELSE INSERT INTO public.notifications(user_id,title,body,kind) VALUES(d.user_id,'Deposit compliance check failed','Your deposit could not be approved. Contact support for details.','warning'); END IF;
 RETURN jsonb_build_object('settled',true,'user_id',d.user_id,'amount',d.amount,'coin',d.coin,'network',d.network,'tx_hash',d.tx_hash);
END $$;

CREATE OR REPLACE FUNCTION public.review_withdrawal_atomic(p_id uuid,p_status text,p_note text,p_reviewer uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.withdrawals; rc jsonb; approvals integer; need_two boolean;
BEGIN
 IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid settlement status'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_reviewer AND role IN ('admin','finance')) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 SELECT * INTO w FROM public.withdrawals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR w.status<>'pending' THEN RETURN jsonb_build_object('settled',false); END IF;
 SELECT value INTO rc FROM public.platform_settings WHERE key='risk_controls';
 need_two:=p_status='approved' AND coalesce((rc->>'largeWithdrawalReview')::boolean,false) AND upper(w.coin) IN ('USD','USDT','USDC','BUSD','DAI') AND w.amount>coalesce((rc->>'largeWithdrawalThresholdUsd')::numeric,10000);
 IF need_two THEN
  INSERT INTO public.financial_review_approvals(request_kind,request_id,approver_id) VALUES('withdrawal',p_id,p_reviewer) ON CONFLICT DO NOTHING;
  SELECT count(*) INTO approvals FROM public.financial_review_approvals a WHERE request_kind='withdrawal' AND request_id=p_id AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=a.approver_id AND r.role IN ('admin','finance'));
  IF approvals<2 THEN RETURN jsonb_build_object('settled',false,'awaiting_second_approval',true); END IF;
 END IF;
 UPDATE public.withdrawals SET status=p_status::request_status,admin_note=p_note,reviewed_by=p_reviewer,reviewed_at=now() WHERE id=p_id;
 IF p_status='rejected' THEN PERFORM public.wallet_adjust(w.user_id,w.coin,w.amount); END IF;
 INSERT INTO public.notifications(user_id,title,body,kind) VALUES(w.user_id,CASE WHEN p_status='approved' THEN 'Withdrawal settled' ELSE 'Withdrawal declined' END,w.amount||' '||w.coin||' ('||w.network||') - '||CASE WHEN p_status='approved' THEN 'review complete.' ELSE 'held funds returned.' END,CASE WHEN p_status='approved' THEN 'success' ELSE 'warning' END);
 RETURN jsonb_build_object('settled',true);
END $$;
REVOKE EXECUTE ON FUNCTION public.settle_deposit_atomic(uuid,text,text,uuid),public.review_withdrawal_atomic(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_deposit_atomic(uuid,text,text,uuid),public.review_withdrawal_atomic(uuid,text,text,uuid) TO service_role;

CREATE FUNCTION public.restore_platform_setting(p_revision uuid,p_actor uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.platform_setting_revisions; current_value jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF length(trim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Audit reason required'; END IF;
 SELECT * INTO r FROM public.platform_setting_revisions WHERE id=p_revision;
 IF NOT FOUND OR r.before_value IS NULL THEN RAISE EXCEPTION 'No previous configuration to restore'; END IF;
 SELECT value INTO current_value FROM public.platform_settings WHERE key=r.key FOR UPDATE;
 IF current_value IS DISTINCT FROM r.after_value THEN RAISE EXCEPTION 'Configuration has changed since this revision; refresh before restoring'; END IF;
 PERFORM set_config('app.operator_id',p_actor::text,true);
 UPDATE public.platform_settings SET value=r.before_value,updated_at=now() WHERE key=r.key;
 INSERT INTO public.admin_audit_logs(actor_id,action,details) VALUES(p_actor,'settings.restore',jsonb_build_object('key',r.key,'revision_id',r.id,'reason',p_reason));
END $$;
REVOKE EXECUTE ON FUNCTION public.restore_platform_setting(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restore_platform_setting(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.operations_health_summary() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object(
 'pendingDeposits',(SELECT count(*) FROM deposits WHERE status='pending'),
 'pendingWithdrawals',(SELECT count(*) FROM withdrawals WHERE status='pending'),
 'oldestDeposit',(SELECT min(created_at) FROM deposits WHERE status='pending'),
 'oldestWithdrawal',(SELECT min(created_at) FROM withdrawals WHERE status='pending'),
 'pendingLevel1',(SELECT count(*) FROM kyc_submissions WHERE kyc_level_1_status='pending'),
 'pendingLevel2',(SELECT count(*) FROM kyc_submissions WHERE kyc_level_2_status='pending'),
 'oldestLevel1',(SELECT min(created_at) FROM kyc_submissions WHERE kyc_level_1_status='pending'),
 'oldestLevel2',(SELECT min(level2_submitted_at) FROM kyc_submissions WHERE kyc_level_2_status='pending'),
 'openTickets',(SELECT count(*) FROM support_tickets WHERE status NOT IN ('resolved','closed')),
 'unassignedTickets',(SELECT count(*) FROM support_tickets WHERE status NOT IN ('resolved','closed') AND assigned_agent_id IS NULL),
 'oldestTicket',(SELECT min(created_at) FROM support_tickets WHERE status NOT IN ('resolved','closed')),
 'missingDepositLedger',(SELECT count(*) FROM deposits d WHERE status='approved' AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.ref_table='deposits' AND t.ref_id=d.id AND t.status='COMPLETED')),
 'missingWithdrawalLedger',(SELECT count(*) FROM withdrawals w WHERE status='approved' AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.ref_table='withdrawals' AND t.ref_id=w.id AND t.status='COMPLETED')),
 'unreadFinancial',(SELECT count(*) FROM notifications WHERE read_at IS NULL AND (title ILIKE '%deposit%' OR title ILIKE '%withdrawal%')),
 'openContracts',(SELECT count(*) FROM contracts WHERE status='open'),
 'contractExposure',(SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (SELECT currency,sum(stake) as stake,sum(stake*(1+payout_pct/100)) as reserved_payout FROM contracts WHERE status='open' GROUP BY currency) x)
);
$$;
REVOKE EXECUTE ON FUNCTION public.operations_health_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.operations_health_summary() TO service_role;