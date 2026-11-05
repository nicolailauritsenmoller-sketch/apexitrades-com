DROP POLICY "Traders read available tiers and admins read all" ON public.scalping_tier_rules;
CREATE POLICY "Authenticated users read configuration metadata" ON public.scalping_tier_rules FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.scalping_tier_rules FROM authenticated;
GRANT SELECT (id,label,duration_seconds,min_trade_amount,roi_pct,active,updated_at,created_at,deleted_at) ON public.scalping_tier_rules TO authenticated;