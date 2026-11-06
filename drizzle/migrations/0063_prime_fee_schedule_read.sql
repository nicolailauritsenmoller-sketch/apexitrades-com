CREATE OR REPLACE FUNCTION public.get_prime_fee_schedule()
RETURNS TABLE(level integer, min_portfolio_usdt numeric, spot_maker numeric, spot_taker numeric, futures_maker numeric, futures_taker numeric, scalp_maker numeric, scalp_taker numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT t.level, t.min_portfolio_usdt, t.spot_maker, t.spot_taker, t.futures_maker, t.futures_taker, t.scalp_maker, t.scalp_taker
 FROM public.vip_fee_tiers t WHERE auth.uid() IS NOT NULL AND t.level BETWEEN 0 AND 4 ORDER BY t.level;
$$;
REVOKE ALL ON FUNCTION public.get_prime_fee_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prime_fee_schedule() TO authenticated, service_role;
COMMENT ON FUNCTION public.get_prime_fee_schedule() IS 'Authenticated safe projection of the configured Prime fee matrix; excludes operator identities and internal account data.';