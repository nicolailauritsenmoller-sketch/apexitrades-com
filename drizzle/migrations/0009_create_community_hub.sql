CREATE TABLE public.community_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_key TEXT NOT NULL UNIQUE CHECK (channel_key IN ('telegram', 'discord', 'x', 'vip')),
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  action_label TEXT NOT NULL,
  invite_url TEXT,
  member_count INTEGER NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  status TEXT NOT NULL DEFAULT 'maintenance' CHECK (status IN ('active', 'maintenance')),
  vip_only BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_channels TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.community_channels TO authenticated;
GRANT ALL ON public.community_channels TO service_role;
ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Community channels are publicly readable" ON public.community_channels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage community channels" ON public.community_channels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_community_channels_updated BEFORE UPDATE ON public.community_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.community_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 2 AND 4000),
  category TEXT NOT NULL CHECK (category IN ('signal', 'event', 'security', 'maintenance')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.community_announcements TO authenticated;
GRANT ALL ON public.community_announcements TO service_role;
ALTER TABLE public.community_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published community announcements are public" ON public.community_announcements FOR SELECT TO anon, authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage community announcements" ON public.community_announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_community_announcements_updated BEFORE UPDATE ON public.community_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.community_vip_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  request_note TEXT,
  review_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.community_vip_requests TO authenticated;
GRANT ALL ON public.community_vip_requests TO service_role;
ALTER TABLE public.community_vip_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own community requests" ON public.community_vip_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "VIP members request community access" ON public.community_vip_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.vip_tier = 'vip1'));
CREATE POLICY "Admins review community requests" ON public.community_vip_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_community_vip_requests_updated BEFORE UPDATE ON public.community_vip_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.community_channels REPLICA IDENTITY FULL;
ALTER TABLE public.community_announcements REPLICA IDENTITY FULL;
ALTER TABLE public.community_vip_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_channels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_channels;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_announcements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_announcements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_vip_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_vip_requests;
  END IF;
END $$;