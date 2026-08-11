-- Personal notifications must always name their single recipient.
ALTER TABLE public.notifications ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS "own or broadcast read" ON public.notifications;
DROP POLICY IF EXISTS "admins manage notifications" ON public.notifications;

CREATE POLICY "own notifications read"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins insert targeted notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) AND user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);