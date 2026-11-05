CREATE TABLE public.leaderboard_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL UNIQUE REFERENCES public.positions(id) ON DELETE CASCADE,
  display_name text,
  commentary text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','rejected')),
  review_note text,
  created_by uuid NOT NULL,
  reviewed_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 3 AND 32),
  CHECK (commentary IS NULL OR char_length(commentary) <= 280)
);
GRANT SELECT ON public.leaderboard_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaderboard_posts TO authenticated;
GRANT ALL ON public.leaderboard_posts TO service_role;
ALTER TABLE public.leaderboard_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published leaderboard posts are public" ON public.leaderboard_posts FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Admins manage leaderboard posts" ON public.leaderboard_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER leaderboard_posts_updated_at BEFORE UPDATE ON public.leaderboard_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX leaderboard_posts_status_idx ON public.leaderboard_posts(status);