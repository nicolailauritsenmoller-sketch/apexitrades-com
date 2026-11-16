CREATE OR REPLACE FUNCTION public.apply_balance_correction(p_user uuid, p_currency text, p_amount numeric, p_mode text, p_kind text, p_reason text, p_actor uuid, p_request uuid DEFAULT NULL::uuid)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
 INSERT INTO admin_audit_logs(actor_id,action,target_user_id,details) VALUES(p_actor,'balance.'||p_kind,p_user,jsonb_build_object('currency',upper(p_currency),'previous_balance',balance_before,'resulting_balance',balance_after,'reason',p_reason,'request_id',p_request,'silent',true));
 RETURN balance_after;
END $function$;