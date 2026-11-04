CREATE TABLE public.discovery_moderation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_kind text NOT NULL CHECK (content_kind IN ('listing','alpha','news')), content_id text NOT NULL,
 status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','hidden','featured')), priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 100), reason text NOT NULL DEFAULT '', reviewed_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(content_kind,content_id)
);
GRANT INSERT, UPDATE ON public.discovery_moderation TO authenticated;
GRANT SELECT (id,content_kind,content_id,status,priority,updated_at) ON public.discovery_moderation TO authenticated;
GRANT SELECT (content_kind,content_id,status,priority) ON public.discovery_moderation TO anon;
GRANT ALL ON public.discovery_moderation TO service_role;
ALTER TABLE public.discovery_moderation ENABLE ROW LEVEL SECURITY;
CREATE POLICY moderation_read ON public.discovery_moderation FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY moderation_insert ON public.discovery_moderation FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND reviewed_by = auth.uid());
CREATE POLICY moderation_update ON public.discovery_moderation FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND reviewed_by = auth.uid());
CREATE TABLE public.discovery_articles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, excerpt text NOT NULL,
 category text NOT NULL DEFAULT 'crypto' CHECK (category IN ('stocks','crypto','defi','commodities','forex','macro','regulation')), tickers text[] NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','withdrawn')), published_at timestamptz, created_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.discovery_articles TO authenticated;
GRANT SELECT ON public.discovery_articles TO anon;
GRANT ALL ON public.discovery_articles TO service_role;
ALTER TABLE public.discovery_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY articles_public ON public.discovery_articles FOR SELECT TO anon, authenticated USING (status = 'published' AND published_at <= now() AND published_at > now() - interval '48 hours');
CREATE POLICY articles_admin ON public.discovery_articles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY articles_insert ON public.discovery_articles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND created_by = auth.uid());
CREATE POLICY articles_update ON public.discovery_articles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE FUNCTION public.audit_discovery_edit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 NEW.updated_at := now();
 IF TG_TABLE_NAME = 'discovery_articles' THEN
  IF NEW.status = 'published' THEN
   IF TG_OP = 'INSERT' THEN NEW.published_at := now();
   ELSIF OLD.status <> 'published' THEN NEW.published_at := now(); END IF;
  END IF;
 END IF;
 INSERT INTO public.admin_audit_logs(actor_id,action,details) VALUES(auth.uid(),'discovery.' || TG_TABLE_NAME || '.' || lower(TG_OP),jsonb_build_object('id',NEW.id,'status',NEW.status));
 RETURN NEW;
END $$;
CREATE TRIGGER moderation_audit BEFORE INSERT OR UPDATE ON public.discovery_moderation FOR EACH ROW EXECUTE FUNCTION public.audit_discovery_edit();
CREATE TRIGGER article_audit BEFORE INSERT OR UPDATE ON public.discovery_articles FOR EACH ROW EXECUTE FUNCTION public.audit_discovery_edit();
CREATE TABLE public.desk_performance_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), leader_id uuid NOT NULL, public_name text NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(), bucket_at timestamptz NOT NULL,
 trades_30d bigint NOT NULL, volume_30d numeric NOT NULL, pnl_30d numeric NOT NULL, margin_30d numeric NOT NULL, sharpe numeric, sortino numeric, max_drawdown_pct numeric, UNIQUE(leader_id,bucket_at)
);
GRANT SELECT ON public.desk_performance_snapshots TO authenticated;
GRANT ALL ON public.desk_performance_snapshots TO service_role;
ALTER TABLE public.desk_performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_admin ON public.desk_performance_snapshots FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE FUNCTION public.capture_desk_performance() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
 INSERT INTO public.desk_performance_snapshots(leader_id,public_name,bucket_at,trades_30d,volume_30d,pnl_30d,margin_30d,sharpe,sortino,max_drawdown_pct)
 SELECT leader_id,public_name,to_timestamp(floor(extract(epoch FROM now()) / 300) * 300),trades_30d,volume_30d,pnl_30d,margin_30d,sharpe,sortino,max_drawdown_pct FROM public.leaderboard_desks(NULL)
 ON CONFLICT (leader_id,bucket_at) DO UPDATE SET captured_at = now(),trades_30d = EXCLUDED.trades_30d,volume_30d = EXCLUDED.volume_30d,pnl_30d = EXCLUDED.pnl_30d,margin_30d = EXCLUDED.margin_30d,sharpe = EXCLUDED.sharpe,sortino = EXCLUDED.sortino,max_drawdown_pct = EXCLUDED.max_drawdown_pct;
 GET DIAGNOSTICS affected = ROW_COUNT;
 RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.capture_desk_performance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_desk_performance() TO service_role;
CREATE FUNCTION public.snapshot_closed_desk_position() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status = 'closed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.realized_pnl IS DISTINCT FROM NEW.realized_pnl) THEN PERFORM public.capture_desk_performance(); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER closed_desk_snapshot AFTER INSERT OR UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.snapshot_closed_desk_position();