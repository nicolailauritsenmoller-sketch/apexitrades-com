CREATE TABLE public.trade_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ref_type text NOT NULL,
  ref_id uuid,
  symbol text NOT NULL,
  side text,
  requested_qty numeric NOT NULL DEFAULT 0,
  filled_qty numeric NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  filled_at timestamptz,
  ack_latency_ms integer,
  fill_latency_ms integer,
  status text NOT NULL DEFAULT 'filled',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trade_executions_user_created_idx ON public.trade_executions (user_id, created_at DESC);

GRANT SELECT ON public.trade_executions TO authenticated;
GRANT ALL ON public.trade_executions TO service_role;

ALTER TABLE public.trade_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own executions"
ON public.trade_executions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));