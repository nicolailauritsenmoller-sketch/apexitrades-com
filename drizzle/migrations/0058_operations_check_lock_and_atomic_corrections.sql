CREATE TABLE public.operations_check_locks (name text PRIMARY KEY, claimed_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.operations_check_locks TO service_role;
ALTER TABLE public.operations_check_locks ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_operations_feed_check() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed text;
BEGIN
 INSERT INTO public.operations_check_locks(name,claimed_at) VALUES('feeds',now()) ON CONFLICT(name) DO UPDATE SET claimed_at=now() WHERE operations_check_locks.claimed_at<now()-interval '60 seconds' RETURNING name INTO claimed;
 RETURN claimed IS NOT NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_operations_feed_check() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_operations_feed_check() TO service_role;

CREATE TABLE public.balance_correction_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, currency text NOT NULL,
 amount numeric NOT NULL, mode text NOT NULL CHECK(mode IN ('set','delta')), kind text NOT NULL,
 reason text NOT NULL, requested_by uuid NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_by uuid, reviewed_at timestamptz
);
GRANT SELECT ON public.balance_correction_requests TO authenticated;
GRANT ALL ON public.balance_correction_requests TO service_role;
ALTER TABLE public.balance_correction_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY balance_corrections_finance ON public.balance_correction_requests FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('admin','finance')));
CREATE FUNCTION public.apply_balance_correction(p_user uuid,p_currency text,p_amount numeric,p_mode text,p_kind text,p_reason text,p_actor uuid,p_request uuid DEFAULT NULL) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE balance_before numeric; balance_after numeric; delta numeric; reference_id uuid:=coalesce(p_request,gen_random_uuid());
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role IN ('admin','finance')) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 IF p_mode NOT IN ('set','delta') OR p_kind NOT IN ('credit','debit','bonus','correction') OR length(trim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Invalid correction or missing audit reason'; END IF;
 IF p_request IS NOT NULL AND EXISTS(SELECT 1 FROM transactions WHERE ref_table='admin_adjustment' AND ref_id=p_request) THEN RAISE EXCEPTION 'Correction already applied'; END IF;
 INSERT INTO wallets(user_id,currency,balance) VALUES(p_user,upper(p_currency),0) ON CONFLICT(user_id,currency) DO NOTHING;
 SELECT balance INTO balance_before FROM wallets WHERE user_id=p_user AND currency=upper(p_currency) FOR UPDATE;
 delta:=CASE WHEN p_mode='set' THEN p_amount-balance_before ELSE p_amount END;
 balance_after:=public.wallet_adjust(p_user,upper(p_currency),delta);
 IF delta<>0 THEN INSERT INTO transactions(user_id,kind,currency,amount,status,ref_table,ref_id,note) VALUES(p_user,'admin_'||p_kind,upper(p_currency),delta,'COMPLETED','admin_adjustment',reference_id,'Account Operations correction'); END IF;
 INSERT INTO admin_audit_logs(actor_id,action,target_user_id,details) VALUES(p_actor,'balance.'||p_kind,p_user,jsonb_build_object('currency',upper(p_currency),'previous_balance',balance_before,'resulting_balance',balance_after,'reason',p_reason,'request_id',p_request));
 INSERT INTO notifications(user_id,title,body,kind) VALUES(p_user,'Balance updated','Your '||upper(p_currency)||' balance was updated by Account Operations.','info');
 RETURN balance_after;
END $$;
CREATE FUNCTION public.review_balance_correction(p_id uuid,p_actor uuid,p_action text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.balance_correction_requests; result numeric;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role IN ('admin','finance')) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 IF p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid action'; END IF;
 SELECT * INTO r FROM balance_correction_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Correction already reviewed'; END IF;
 IF r.requested_by=p_actor THEN RAISE EXCEPTION 'A different finance operator must review this correction'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=r.requested_by AND role IN ('admin','finance')) THEN RAISE EXCEPTION 'Requesting operator no longer has finance access'; END IF;
 IF p_action='approve' THEN result:=public.apply_balance_correction(r.user_id,r.currency,r.amount,r.mode,r.kind,r.reason,p_actor,r.id); END IF;
 UPDATE balance_correction_requests SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,reviewed_by=p_actor,reviewed_at=now() WHERE id=p_id;
 INSERT INTO admin_audit_logs(actor_id,action,target_user_id,details) VALUES(p_actor,'balance.request.'||p_action,r.user_id,jsonb_build_object('request_id',r.id,'requested_by',r.requested_by));
 RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_balance_correction(uuid,text,numeric,text,text,text,uuid,uuid),public.review_balance_correction(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_balance_correction(uuid,text,numeric,text,text,text,uuid,uuid),public.review_balance_correction(uuid,uuid,text) TO service_role;