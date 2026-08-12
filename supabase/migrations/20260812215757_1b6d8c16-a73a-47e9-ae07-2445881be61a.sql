CREATE TABLE public.certificates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  issuer text not null default '',
  category text not null default 'security',
  badge_key text not null default 'iso',
  badge_url text,
  document_url text,
  summary text not null default '',
  issue_date date,
  expiry_date date,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.certificates TO anon;
GRANT SELECT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active certificates"
  ON public.certificates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Staff can read all certificates"
  ON public.certificates FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

CREATE TRIGGER update_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.certificates (title, issuer, category, badge_key, summary, issue_date, expiry_date, sort_order) VALUES
('ISO 27001 Certified','BSI Group','security','iso','Our information security management system is audited against the ISO/IEC 27001 international standard.','2024-03-11','2027-03-10',1),
('SOC 2 Type II Compliant','Prescient Assurance','security','soc2','Independent auditors verify our security, availability and confidentiality controls over an extended observation period.','2025-01-20','2026-01-19',2),
('GDPR Data Protection','EU Data Protection Authority','compliance','gdpr','Personal data is processed lawfully under the EU General Data Protection Regulation, with full access and erasure rights.','2024-06-01',NULL,3),
('256-Bit SSL Encryption','DigiCert','security','ssl','All traffic between your device and our platform is encrypted end-to-end with 256-bit TLS.','2025-05-02','2026-05-02',4),
('Multi-Sig Cold Storage','Fireblocks Custody','custody','custody','Client funds are custodied in multi-signature cold wallets that require several independent approvals to move.','2024-11-15',NULL,5);