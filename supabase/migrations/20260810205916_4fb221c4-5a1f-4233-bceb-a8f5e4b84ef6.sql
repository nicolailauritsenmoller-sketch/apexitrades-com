-- 1. Restrict public config reads to the single non-sensitive homepage stats key
DROP POLICY IF EXISTS "public read settings" ON public.platform_settings;
CREATE POLICY "public read membership stats" ON public.platform_settings
  FOR SELECT TO anon, authenticated
  USING (key = 'membership');

-- 2. Hard-block direct client writes to value-bearing financial tables
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.positions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.contracts FROM anon, authenticated;
REVOKE SELECT ON public.wallets FROM anon;
REVOKE SELECT ON public.positions FROM anon;
REVOKE SELECT ON public.contracts FROM anon;
GRANT SELECT ON public.wallets TO authenticated;
GRANT SELECT ON public.positions TO authenticated;
GRANT SELECT ON public.contracts TO authenticated;
GRANT ALL ON public.wallets TO service_role;
GRANT ALL ON public.positions TO service_role;
GRANT ALL ON public.contracts TO service_role;