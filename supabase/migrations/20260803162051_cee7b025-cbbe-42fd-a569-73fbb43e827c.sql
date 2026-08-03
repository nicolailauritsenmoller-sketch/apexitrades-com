-- 1. Value integrity: no direct client writes to financial tables
DROP POLICY IF EXISTS "own wallets" ON public.wallets;
DROP POLICY IF EXISTS "admins manage wallets" ON public.wallets;
CREATE POLICY "own wallets read" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read wallets" ON public.wallets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM authenticated, anon;
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

DROP POLICY IF EXISTS "own positions" ON public.positions;
CREATE POLICY "own positions read" ON public.positions FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.positions FROM authenticated, anon;
GRANT SELECT ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;

DROP POLICY IF EXISTS "Users can create their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "admins update contracts" ON public.contracts;
REVOKE INSERT, UPDATE, DELETE ON public.contracts FROM authenticated, anon;
GRANT SELECT ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;

-- 2. SECURITY DEFINER functions should not be callable by app users
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- 3. Owner-scoped delete for KYC documents
DROP POLICY IF EXISTS "kyc owner delete" ON storage.objects;
CREATE POLICY "kyc owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);