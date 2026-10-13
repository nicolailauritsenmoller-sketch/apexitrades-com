CREATE TABLE public.market_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  source text NOT NULL CHECK (length(source) BETWEEN 2 AND 80),
  category text NOT NULL CHECK (category IN ('crypto','macro','regulation','equities','forex','commodities','desk')),
  content text NOT NULL CHECK (length(content) BETWEEN 5 AND 2000),
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.market_insights TO authenticated;
GRANT ALL ON public.market_insights TO service_role;
ALTER TABLE public.market_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read active insights" ON public.market_insights FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins publish insights" ON public.market_insights FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());
CREATE POLICY "Admins update insights" ON public.market_insights FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_insights;