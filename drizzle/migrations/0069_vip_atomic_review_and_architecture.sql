CREATE OR REPLACE FUNCTION public.request_prime_allocation(p_user_id uuid,p_level integer) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_level integer; recommended integer; previous_status text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vip_fee_tiers WHERE level=p_level AND level BETWEEN 1 AND 20) THEN RAISE EXCEPTION 'Invalid allocation'; END IF;
 SELECT vip_tier INTO previous_status FROM profiles WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 INSERT INTO vip_accounts(user_id,level) VALUES(p_user_id,0) ON CONFLICT DO NOTHING;
 SELECT level,recommended_level INTO current_level,recommended FROM vip_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF current_level>=p_level THEN RETURN 'active'; END IF;
 IF recommended IS NOT NULL AND recommended>=p_level THEN RETURN 'pending'; END IF;
 UPDATE vip_accounts SET recommended_level=p_level,updated_at=now() WHERE user_id=p_user_id;
 IF previous_status='regular' THEN UPDATE profiles SET vip_tier='vip_pending' WHERE id=p_user_id; END IF;
 INSERT INTO notifications(user_id,title,body,kind) VALUES(p_user_id,'Institutional allocation under review','Your allocation request is pending review. Trading fees remain unchanged until approval.','info');
 INSERT INTO admin_audit_logs(actor_id,target_user_id,action,details) VALUES(p_user_id,p_user_id,'vip.allocation_requested',jsonb_build_object('requested_level',p_level,'current_level',current_level));
 INSERT INTO notifications(user_id,title,body,kind) SELECT user_id,'Institutional allocation request','A cleared allocation request awaits review in VIP Control Center.','warning' FROM user_roles WHERE role='admin';
 RETURN 'pending';
END $$;
REVOKE ALL ON FUNCTION public.request_prime_allocation(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_prime_allocation(uuid,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.review_vip_credit(p_id uuid,p_status text,p_reason text,p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; current_status text;
BEGIN
 IF p_status NOT IN ('approved_simulation','rejected','liquidated_simulation') OR length(trim(p_reason)) NOT BETWEEN 5 AND 400 THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT user_id,vip_credit_status INTO owner_id,current_status FROM support_tickets WHERE id=p_id AND subject='Treasury Operations - Credit Facility Simulation' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scenario not found'; END IF;
 IF p_status='liquidated_simulation' AND current_status<>'approved_simulation' THEN RAISE EXCEPTION 'Only an approved simulation can be liquidated'; END IF;
 UPDATE support_tickets SET vip_credit_status=p_status,vip_credit_review_note=trim(p_reason),updated_at=now() WHERE id=p_id;
 INSERT INTO admin_audit_logs(actor_id,action,target_user_id,details) VALUES(p_actor,'vip.credit_review',owner_id,jsonb_build_object('ticket',p_id,'from',current_status,'status',p_status,'reason',trim(p_reason)));
 INSERT INTO notifications(user_id,kind,title,body) VALUES(owner_id,'info','Credit simulation review','Treasury updated your credit scenario: '||replace(p_status,'_',' ')||'. No funds have moved.');
END $$;
REVOKE ALL ON FUNCTION public.review_vip_credit(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_vip_credit(uuid,text,text,uuid) TO service_role;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS vip_credit_drawdown_at timestamptz;
CREATE OR REPLACE FUNCTION public.record_vip_simulated_drawdown(p_id uuid,p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE support_tickets SET vip_credit_drawdown_at=COALESCE(vip_credit_drawdown_at,now()) WHERE id=p_id AND user_id=p_user AND subject='Treasury Operations - Credit Facility Simulation' AND vip_credit_status='approved_simulation';
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved simulation required'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_vip_simulated_drawdown(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_vip_simulated_drawdown(uuid,uuid) TO service_role;