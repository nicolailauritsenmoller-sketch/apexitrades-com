CREATE TABLE public.careers_openings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
 business_group text NOT NULL,
 country text NOT NULL,
 location text NOT NULL,
 employment_type text NOT NULL DEFAULT 'Full-time' CHECK (employment_type IN ('Full-time','Part-time','Contract','Internship')),
 work_mode text NOT NULL DEFAULT 'Remote' CHECK (work_mode IN ('Remote','Hybrid','On-site')),
 duration text NOT NULL DEFAULT '',
 tags text[] NOT NULL DEFAULT '{}',
 description text NOT NULL,
 requirements text NOT NULL DEFAULT '',
 application_url text NOT NULL DEFAULT '' CHECK (application_url = '' OR application_url ~ '^https://[^[:space:]]+$'),
 featured boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT careers_publish_content CHECK (status <> 'published' OR (length(trim(description)) >= 20 AND application_url <> '' AND length(trim(business_group)) > 0 AND length(trim(country)) > 0 AND length(trim(location)) > 0))
);
GRANT SELECT ON public.careers_openings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.careers_openings TO authenticated;
GRANT ALL ON public.careers_openings TO service_role;
ALTER TABLE public.careers_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY careers_public_read ON public.careers_openings FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY careers_admin_manage ON public.careers_openings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX careers_openings_public_idx ON public.careers_openings (status, published_at DESC);
CREATE FUNCTION public.prepare_careers_opening() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.updated_at := now();
 IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status <> 'published') THEN NEW.published_at := now();
 ELSIF TG_OP = 'UPDATE' THEN NEW.published_at := OLD.published_at;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER careers_prepare BEFORE INSERT OR UPDATE ON public.careers_openings FOR EACH ROW EXECUTE FUNCTION public.prepare_careers_opening();
CREATE FUNCTION public.audit_careers_opening() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
 INSERT INTO public.admin_audit_logs (actor_id, action, details)
 VALUES (auth.uid(), 'careers_' || lower(TG_OP), jsonb_build_object('opening_id', COALESCE(NEW.id, OLD.id), 'before', CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END, 'after', CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END));
 END IF;
 RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_careers_opening() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_careers_opening() FROM PUBLIC;
CREATE TRIGGER careers_audit AFTER INSERT OR UPDATE OR DELETE ON public.careers_openings FOR EACH ROW EXECUTE FUNCTION public.audit_careers_opening();