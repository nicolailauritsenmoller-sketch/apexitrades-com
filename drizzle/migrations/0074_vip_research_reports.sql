CREATE TABLE public.vip_research_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL,
  category text NOT NULL DEFAULT 'Market Research',
  published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vip_research_reports TO authenticated;
GRANT ALL ON public.vip_research_reports TO service_role;
ALTER TABLE public.vip_research_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage vip research" ON public.vip_research_reports FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "vip members read published research" ON public.vip_research_reports FOR SELECT TO authenticated
  USING (published AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.vip_tier NOT IN ('regular','vip_pending')));
CREATE TRIGGER vip_research_updated BEFORE UPDATE ON public.vip_research_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();