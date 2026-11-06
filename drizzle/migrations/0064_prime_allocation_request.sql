CREATE OR REPLACE FUNCTION public.request_prime_allocation(p_user_id uuid, p_level integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_level integer; recommended integer; previous_status text;
BEGIN
 IF p_level NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Invalid allocation'; END IF;
 SELECT vip_tier INTO previous_status FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 INSERT INTO public.vip_accounts(user_id,level) VALUES(p_user_id,0) ON CONFLICT DO NOTHING;
 SELECT level,recommended_level INTO current_level,recommended FROM public.vip_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF current_level >= p_level THEN RETURN 'active'; END IF;
 IF recommended IS NOT NULL AND recommended >= p_level THEN RETURN 'pending'; END IF;
 UPDATE public.vip_accounts SET recommended_level=p_level,updated_at=now() WHERE user_id=p_user_id;
 IF previous_status='regular' THEN UPDATE public.profiles SET vip_tier='vip_pending' WHERE id=p_user_id; END IF;
 INSERT INTO public.notifications(user_id,title,body,kind) VALUES(p_user_id,'Institutional allocation under review','Your allocation request is pending review. Trading fees remain unchanged until approval.','info');
 INSERT INTO public.admin_audit_logs(actor_id,target_user_id,action,details) VALUES(p_user_id,p_user_id,'vip.allocation_requested',jsonb_build_object('requested_level',p_level,'current_level',current_level));
 INSERT INTO public.notifications(user_id,title,body,kind) SELECT user_id,'Institutional allocation request','A collateral-qualified allocation request is awaiting review in VIP fee tiers.','warning' FROM public.user_roles WHERE role='admin';
 RETURN 'pending';
END;
$$;
REVOKE ALL ON FUNCTION public.request_prime_allocation(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_prime_allocation(uuid,integer) TO service_role;