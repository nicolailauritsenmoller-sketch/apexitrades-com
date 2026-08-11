CREATE TABLE public.security_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  attachment_path text,
  attachment_name text,
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.security_reports TO authenticated;
GRANT ALL ON public.security_reports TO service_role;
ALTER TABLE public.security_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own security reports read" ON public.security_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "staff security reports read" ON public.security_reports
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "own security reports insert" ON public.security_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_security_reports_updated BEFORE UPDATE ON public.security_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vip_specialists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE,
  role_label text NOT NULL,
  full_name text NOT NULL,
  title text NOT NULL,
  staff_id text NOT NULL,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vip_specialists TO authenticated;
GRANT ALL ON public.vip_specialists TO service_role;
ALTER TABLE public.vip_specialists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read specialists" ON public.vip_specialists
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_vip_specialists_updated BEFORE UPDATE ON public.vip_specialists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vip_specialists (role_key, role_label, full_name, title, staff_id) VALUES
  ('financial_advisor','Financial Advisor','Daniel Reyes','Senior Financial Advisor','#FA-1042'),
  ('treasury_ops','Treasury Operations Analyst','Amara Okafor','Treasury Operations Analyst','#TO-2210'),
  ('fraud_risk','Fraud Risk Analyst','Marcus Feld','Fraud Risk Analyst','#FR-3318'),
  ('billing_settlements','Billing and Settlements Specialist','Priya Nandan','Billing & Settlements Specialist','#BS-4471'),
  ('tax_compliance','Tax and Compliance Advisor','Helena Vogt','Tax & Compliance Advisor','#TC-5509'),
  ('crypto_derivatives','Crypto Derivatives Strategist','Kenji Sato','Crypto Derivatives Strategist','#CD-6182'),
  ('security_architecture','Security Architecture Consultant','Noah Bergstrom','Security Architecture Consultant','#SA-7734'),
  ('kyc_aml','KYC/AML Verification Officer','Sofia Marchetti','KYC/AML Verification Officer','#KA-8890');

CREATE TABLE public.vip_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  unlocked boolean NOT NULL DEFAULT false,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_key)
);
GRANT SELECT ON public.vip_access TO authenticated;
GRANT ALL ON public.vip_access TO service_role;
ALTER TABLE public.vip_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vip access read" ON public.vip_access
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "staff vip access read" ON public.vip_access
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE TRIGGER trg_vip_access_updated BEFORE UPDATE ON public.vip_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vip_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  sender_role text NOT NULL,
  sender_id uuid,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vip_messages_thread ON public.vip_messages (user_id, role_key, created_at);
GRANT SELECT ON public.vip_messages TO authenticated;
GRANT ALL ON public.vip_messages TO service_role;
ALTER TABLE public.vip_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vip messages read" ON public.vip_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "staff vip messages read" ON public.vip_messages
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));