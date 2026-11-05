GRANT SELECT (max_trade_amount,allowed_pairs,commission_pct,daily_payout_cap) ON public.scalping_tier_rules TO authenticated;
GRANT ALL ON public.scalping_tier_rules TO service_role;