CREATE TABLE public.compliance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.kyc_submissions(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  user_name text NOT NULL,
  kind text NOT NULL DEFAULT 'kyc_level2_submitted' CHECK (kind = 'kyc_level2_submitted'),
  priority text NOT NULL DEFAULT 'high' CHECK (priority = 'high'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.compliance_alerts TO authenticated;
GRANT ALL ON public.compliance_alerts TO service_role;
ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators read compliance alerts" ON public.compliance_alerts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX compliance_alerts_created_idx ON public.compliance_alerts(created_at DESC);
CREATE OR REPLACE FUNCTION public.notify_level2_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kyc_level_2_status = 'pending' AND (TG_OP = 'INSERT' OR OLD.kyc_level_2_status IS DISTINCT FROM 'pending') THEN
    INSERT INTO public.compliance_alerts(submission_id, user_id, user_name)
    VALUES (NEW.id, NEW.user_id, COALESCE(NULLIF(btrim(NEW.full_name), ''), 'User'));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_level2_submission() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_level2_submission AFTER INSERT OR UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.notify_level2_submission();
ALTER PUBLICATION supabase_realtime ADD TABLE public.compliance_alerts;