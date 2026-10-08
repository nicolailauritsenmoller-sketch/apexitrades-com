CREATE TABLE public.access_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ip','device')),
  value text NOT NULL,
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  lifted_by uuid,
  lifted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX access_bans_active_uniq ON public.access_bans (kind, value) WHERE active;
GRANT SELECT ON public.access_bans TO authenticated;
GRANT ALL ON public.access_bans TO service_role;
ALTER TABLE public.access_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bans" ON public.access_bans FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));