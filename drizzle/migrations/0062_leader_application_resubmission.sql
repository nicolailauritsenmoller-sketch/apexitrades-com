ALTER TABLE public.copy_leader_applications ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.copy_leader_applications SET updated_at = created_at;
GRANT UPDATE ON public.copy_leader_applications TO authenticated;
CREATE POLICY "Revise own rejected application" ON public.copy_leader_applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'rejected')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');