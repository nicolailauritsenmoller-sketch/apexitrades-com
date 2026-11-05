CREATE TABLE public.scalping_tier_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label text NOT NULL,
 duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 31536000),
 min_trade_amount numeric NOT NULL CHECK (min_trade_amount > 0 AND min_trade_amount <= 100000000),
 roi_pct numeric NOT NULL CHECK (roi_pct >= 0 AND roi_pct <= 10000),
 active boolean NOT NULL DEFAULT true,
 deleted_at timestamptz,
 audit_reason text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.scalping_tier_rules TO authenticated;
GRANT ALL ON public.scalping_tier_rules TO service_role;
ALTER TABLE public.scalping_tier_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Traders read available tiers and admins read all" ON public.scalping_tier_rules FOR SELECT TO authenticated USING ((active AND deleted_at IS NULL) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins create tiers" ON public.scalping_tier_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update tiers" ON public.scalping_tier_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE FUNCTION public.audit_scalping_rule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF length(trim(NEW.audit_reason)) < 5 THEN RAISE EXCEPTION 'Audit reason required'; END IF;
 NEW.updated_at := clock_timestamp();
 IF auth.uid() IS NOT NULL THEN
 INSERT INTO public.admin_audit_logs(actor_id, action, details) VALUES (auth.uid(), CASE WHEN NEW.deleted_at IS NOT NULL THEN 'scalping_tier_removed' ELSE 'scalping_tier_saved' END, jsonb_build_object('tier_id',NEW.id,'label',NEW.label,'duration_seconds',NEW.duration_seconds,'min_trade_amount',NEW.min_trade_amount,'roi_pct',NEW.roi_pct,'active',NEW.active,'reason',NEW.audit_reason));
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER scalping_rule_audit BEFORE INSERT OR UPDATE ON public.scalping_tier_rules FOR EACH ROW EXECUTE FUNCTION public.audit_scalping_rule();
ALTER PUBLICATION supabase_realtime ADD TABLE public.scalping_tier_rules;
ALTER TABLE public.contracts ADD COLUMN tier_id uuid REFERENCES public.scalping_tier_rules(id), ADD COLUMN tier_version timestamptz;
CREATE FUNCTION public.validate_contract_tier() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE rule public.scalping_tier_rules;
BEGIN
 SELECT * INTO rule FROM public.scalping_tier_rules WHERE id = NEW.tier_id FOR SHARE;
 IF NOT FOUND OR NOT rule.active OR rule.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'This duration tier is no longer available'; END IF;
 IF NEW.tier_version IS DISTINCT FROM rule.updated_at OR NEW.duration_seconds <> rule.duration_seconds OR NEW.payout_pct <> rule.roi_pct THEN RAISE EXCEPTION 'Trade configuration changed. Review current terms and submit again'; END IF;
 IF NEW.stake < rule.min_trade_amount THEN RAISE EXCEPTION 'Investment is below the current tier minimum'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER enforce_contract_tier BEFORE INSERT ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.validate_contract_tier();