ALTER POLICY moderation_read ON public.discovery_moderation USING (status IN ('hidden', 'featured'));
CREATE POLICY moderation_admin_read ON public.discovery_moderation FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE SELECT ON public.discovery_moderation FROM anon, authenticated;
GRANT SELECT (content_kind,content_id,status,priority) ON public.discovery_moderation TO anon;
GRANT SELECT (id,content_kind,content_id,status,priority,updated_at) ON public.discovery_moderation TO authenticated;
GRANT ALL ON public.discovery_moderation TO service_role;
COMMENT ON POLICY moderation_read ON public.discovery_moderation IS 'Public actionable feed directives only, without calling an authenticated-only role helper. Private moderation columns remain ungranted.';
COMMENT ON POLICY moderation_admin_read ON public.discovery_moderation IS 'Administrator history access uses the authenticated role only; public feed requests never evaluate the protected role helper.';