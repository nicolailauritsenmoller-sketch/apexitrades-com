CREATE OR REPLACE FUNCTION public.audit_scalping_rule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reason text := nullif(trim(NEW.audit_reason), '');
BEGIN
 IF reason IS NULL THEN
  reason := CASE
   WHEN TG_OP = 'INSERT' THEN 'Confirmed scalping tier creation'
   WHEN NEW.deleted_at IS NOT NULL THEN 'Confirmed scalping tier removal'
   WHEN OLD.active IS DISTINCT FROM NEW.active AND NOT NEW.active THEN 'Confirmed scalping tier deactivation'
   WHEN OLD.active IS DISTINCT FROM NEW.active AND NEW.active THEN 'Confirmed scalping tier activation'
   ELSE 'Confirmed scalping tier update'
  END;
 END IF;
 NEW.updated_at := clock_timestamp();
 IF auth.uid() IS NOT NULL THEN
  INSERT INTO public.admin_audit_logs(actor_id, action, details) VALUES (auth.uid(), CASE WHEN NEW.deleted_at IS NOT NULL THEN 'scalping_tier_removed' ELSE 'scalping_tier_saved' END, jsonb_build_object('tier_id',NEW.id,'label',NEW.label,'duration_seconds',NEW.duration_seconds,'min_trade_amount',NEW.min_trade_amount,'roi_pct',NEW.roi_pct,'active',NEW.active,'reason',reason));
 END IF;
 -- Only the private audit record retains the supplied or automatic reason.
 -- Configuration synchronization never dispatches customer notifications.
 NEW.audit_reason := '';
 RETURN NEW;
END; $$;
COMMENT ON FUNCTION public.audit_scalping_rule() IS 'Records scalping mutations privately; reason-free confirmations generate an automatic action description, with no customer notifications.';