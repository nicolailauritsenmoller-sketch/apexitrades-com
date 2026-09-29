CREATE TABLE IF NOT EXISTS public.user_withdrawal_limits (
  user_id uuid PRIMARY KEY,
  daily_limit_usdt numeric NOT NULL CHECK (daily_limit_usdt >= 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_withdrawal_limits TO authenticated;
GRANT ALL ON public.user_withdrawal_limits TO service_role;
ALTER TABLE public.user_withdrawal_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own limit read" ON public.user_withdrawal_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_logs is append-only';
END;
$$;
DROP TRIGGER IF EXISTS admin_audit_logs_immutable ON public.admin_audit_logs;
CREATE TRIGGER admin_audit_logs_immutable BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();