ALTER TABLE public.vip_fee_tiers ADD COLUMN IF NOT EXISTS min_eth_holdings numeric NOT NULL DEFAULT 0 CHECK (min_eth_holdings >= 0);
ALTER TABLE public.vip_fee_tiers ADD COLUMN IF NOT EXISTS min_collateral_usdt numeric NOT NULL DEFAULT 0 CHECK (min_collateral_usdt >= 0);
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS vip_credit_scenario jsonb;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS vip_credit_status text NOT NULL DEFAULT 'pending' CHECK (vip_credit_status IN ('pending','approved_simulation','rejected','liquidated_simulation'));
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS vip_credit_review_note text;
CREATE OR REPLACE FUNCTION public.get_vip_ecosystem_config() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE((SELECT value FROM public.platform_settings WHERE key='vip_ecosystem'), '{}'::jsonb) WHERE auth.uid() IS NOT NULL $$;
REVOKE ALL ON FUNCTION public.get_vip_ecosystem_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vip_ecosystem_config() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_prime_architecture() RETURNS TABLE(level integer,name text,min_portfolio_usdt numeric,min_collateral_usdt numeric,min_eth_holdings numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT level,name,min_portfolio_usdt,min_collateral_usdt,min_eth_holdings FROM public.vip_fee_tiers WHERE auth.uid() IS NOT NULL AND level>0 ORDER BY level $$;
REVOKE ALL ON FUNCTION public.get_prime_architecture() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prime_architecture() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.activate_cleared_vip(p_user uuid,p_level integer,p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM vip_fee_tiers WHERE level=p_level AND p_level>0) THEN RAISE EXCEPTION 'Unknown tier'; END IF;
 PERFORM 1 FROM profiles WHERE id=p_user FOR UPDATE;
 SELECT level INTO previous FROM vip_accounts WHERE user_id=p_user;
 IF COALESCE(previous,0)>=p_level THEN RETURN; END IF;
 INSERT INTO vip_accounts(user_id,level,recommended_level,grace_until,updated_at) VALUES(p_user,p_level,NULL,NULL,now()) ON CONFLICT(user_id) DO UPDATE SET level=GREATEST(vip_accounts.level,excluded.level),recommended_level=NULL,grace_until=NULL,updated_at=now();
 UPDATE profiles SET vip_tier='vip1',vip_upgraded_at=COALESCE(vip_upgraded_at,now()) WHERE id=p_user;
 INSERT INTO admin_audit_logs(actor_id,action,target_user_id,details) VALUES(COALESCE(p_actor,'00000000-0000-0000-0000-000000000000'::uuid),'vip.auto_promotion',p_user,jsonb_build_object('from',COALESCE(previous,0),'to',p_level,'source','cleared criteria'));
 INSERT INTO notifications(user_id,title,body,kind) VALUES(p_user,'VIP allocation activated','Your cleared account meets the configured VIP allocation requirements.','info');
END $$;
REVOKE ALL ON FUNCTION public.activate_cleared_vip(uuid,integer,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_cleared_vip(uuid,integer,uuid) TO service_role;
COMMENT ON COLUMN public.support_tickets.vip_credit_scenario IS 'Non-executing institutional credit scenario. No money movement or actual collateral reservation.';