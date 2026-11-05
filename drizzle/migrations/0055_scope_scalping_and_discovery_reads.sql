ALTER POLICY "Authenticated users read configuration metadata"
ON public.scalping_tier_rules
USING (
  (active AND deleted_at IS NULL)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

ALTER POLICY moderation_read
ON public.discovery_moderation
USING (
  status IN ('hidden', 'featured')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

COMMENT ON POLICY "Authenticated users read configuration metadata" ON public.scalping_tier_rules IS 'Traders may read active, non-deleted trading terms only; administrators may inspect all configuration rows. Existing safe-column grants remain unchanged.';
COMMENT ON POLICY moderation_read ON public.discovery_moderation IS 'Public feed readers receive only actionable hidden/featured directives through existing safe-column grants. Approved decisions are no-ops for feeds and remain administrator-only; private reasons and reviewer identities remain ungranted.';