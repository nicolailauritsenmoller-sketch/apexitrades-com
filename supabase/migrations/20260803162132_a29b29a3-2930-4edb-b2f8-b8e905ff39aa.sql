CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','agent'))
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;

-- Repoint every policy that used the public wrappers
DROP POLICY IF EXISTS "admins read wallets" ON public.wallets;
CREATE POLICY "admins read wallets" ON public.wallets FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins read contracts" ON public.contracts;
CREATE POLICY "admins read contracts" ON public.contracts FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins manage addresses" ON public.deposit_addresses;
CREATE POLICY "admins manage addresses" ON public.deposit_addresses FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "signed in read addresses" ON public.deposit_addresses;
CREATE POLICY "signed in read addresses" ON public.deposit_addresses FOR SELECT TO authenticated USING (active OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins read deposits" ON public.deposits;
CREATE POLICY "admins read deposits" ON public.deposits FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admins update deposits" ON public.deposits;
CREATE POLICY "admins update deposits" ON public.deposits FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins read withdrawals" ON public.withdrawals;
CREATE POLICY "admins read withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admins update withdrawals" ON public.withdrawals;
CREATE POLICY "admins update withdrawals" ON public.withdrawals FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins read kyc" ON public.kyc_submissions;
CREATE POLICY "admins read kyc" ON public.kyc_submissions FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admins update kyc" ON public.kyc_submissions;
CREATE POLICY "admins update kyc" ON public.kyc_submissions FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins manage notifications" ON public.notifications;
CREATE POLICY "admins manage notifications" ON public.notifications FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins read swaps" ON public.swaps;
CREATE POLICY "admins read swaps" ON public.swaps FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins update profiles" ON public.profiles;
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "staff read profiles" ON public.profiles;
CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "admins read roles" ON public.user_roles;
CREATE POLICY "admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "staff sessions read" ON public.chat_sessions;
CREATE POLICY "staff sessions read" ON public.chat_sessions FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff sessions update" ON public.chat_sessions;
CREATE POLICY "staff sessions update" ON public.chat_sessions FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff messages read" ON public.chat_messages;
CREATE POLICY "staff messages read" ON public.chat_messages FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff messages insert" ON public.chat_messages;
CREATE POLICY "staff messages insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()) AND sender_id = auth.uid());

-- Storage policies that referenced public.has_role
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, cmd, qual, with_check FROM pg_policies
           WHERE schemaname='storage' AND tablename='objects'
             AND (coalesce(qual,'') LIKE '%has_role%' OR coalesce(with_check,'') LIKE '%has_role%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "kyc admin read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND private.has_role(auth.uid(), 'admin'::app_role));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_staff(uuid);