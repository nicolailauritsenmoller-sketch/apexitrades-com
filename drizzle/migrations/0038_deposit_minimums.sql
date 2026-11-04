CREATE TABLE public.deposit_minimums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  coin text NOT NULL,
  min_amount numeric NOT NULL CHECK (min_amount >= 0),
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX deposit_minimums_scope_coin ON public.deposit_minimums (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(coin));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_minimums TO authenticated;
GRANT ALL ON public.deposit_minimums TO service_role;
ALTER TABLE public.deposit_minimums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read global or own minimums" ON public.deposit_minimums FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));
CREATE POLICY "Admins manage minimums" ON public.deposit_minimums FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));