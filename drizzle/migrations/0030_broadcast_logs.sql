CREATE TABLE public.broadcast_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  template_key text,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience_label text NOT NULL,
  channels text[] NOT NULL DEFAULT '{}',
  recipients integer NOT NULL DEFAULT 0,
  delivered integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  skipped_channels text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'sent',
  is_test boolean NOT NULL DEFAULT false,
  emergency boolean NOT NULL DEFAULT false,
  actor_id uuid NOT NULL,
  actor_name text,
  actor_staff_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcast_logs TO authenticated;
GRANT ALL ON public.broadcast_logs TO service_role;
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read broadcast logs" ON public.broadcast_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX broadcast_logs_created_idx ON public.broadcast_logs (created_at DESC);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS broadcast_id uuid;
CREATE INDEX IF NOT EXISTS notifications_broadcast_idx ON public.notifications (broadcast_id) WHERE broadcast_id IS NOT NULL;