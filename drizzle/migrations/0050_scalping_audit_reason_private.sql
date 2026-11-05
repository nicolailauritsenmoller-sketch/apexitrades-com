CREATE OR REPLACE FUNCTION public.audit_scalping_rule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reason text := trim(NEW.audit_reason);
BEGIN
 IF reason IS NULL OR length(reason) < 5 OR length(reason) > 400 THEN RAISE EXCEPTION 'Audit reason required (5-400 characters)'; END IF;
 NEW.updated_at := clock_timestamp();
 IF auth.uid() IS NOT NULL THEN
 INSERT INTO public.admin_audit_logs(actor_id, action, details) VALUES (auth.uid(), CASE WHEN NEW.deleted_at IS NOT NULL THEN 'scalping_tier_removed' ELSE 'scalping_tier_saved' END, jsonb_build_object('tier_id',NEW.id,'label',NEW.label,'duration_seconds',NEW.duration_seconds,'min_trade_amount',NEW.min_trade_amount,'roi_pct',NEW.roi_pct,'active',NEW.active,'reason',reason));
 END IF;
 -- The input reason is consumed by the private audit record, never retained
 -- on the configuration row replicated to traders. No notification dispatch.
 NEW.audit_reason := '';
 RETURN NEW;
END; $$;
COMMENT ON COLUMN public.scalping_tier_rules.audit_reason IS 'Transient write-only audit input consumed by audit_scalping_rule; persisted reasons belong exclusively to admin_audit_logs. Stored value must be empty.';
ALTER TABLE public.scalping_tier_rules ADD CONSTRAINT scalping_reason_not_retained CHECK (audit_reason = '') NOT VALID;