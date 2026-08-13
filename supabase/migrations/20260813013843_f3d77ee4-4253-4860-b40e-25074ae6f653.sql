ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS admin_last_read_at timestamptz NOT NULL DEFAULT 'epoch'::timestamptz;