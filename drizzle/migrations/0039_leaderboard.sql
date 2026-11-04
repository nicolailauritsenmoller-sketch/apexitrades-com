CREATE TABLE public.leaderboard_follows (
  user_id uuid NOT NULL,
  leader_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, leader_id)
);
GRANT SELECT, INSERT, DELETE ON public.leaderboard_follows TO authenticated;
GRANT ALL ON public.leaderboard_follows TO service_role;
ALTER TABLE public.leaderboard_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own follows read" ON public.leaderboard_follows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own follows insert" ON public.leaderboard_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND leader_id <> auth.uid());
CREATE POLICY "own follows delete" ON public.leaderboard_follows FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.leaderboard_engagement (
  user_id uuid NOT NULL,
  position_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('like','repost','view')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, position_id, kind)
);
GRANT SELECT, INSERT, DELETE ON public.leaderboard_engagement TO authenticated;
GRANT ALL ON public.leaderboard_engagement TO service_role;
ALTER TABLE public.leaderboard_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own engagement read" ON public.leaderboard_engagement FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own engagement insert" ON public.leaderboard_engagement FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own engagement delete" ON public.leaderboard_engagement FOR DELETE TO authenticated USING (auth.uid() = user_id AND kind <> 'view');

-- Public feed: only consenting approved copy leaders, best closed position in the last 30 days.
CREATE OR REPLACE FUNCTION public.leaderboard_feed(p_asset text DEFAULT NULL)
RETURNS TABLE(position_id uuid, leader_id uuid, public_name text, bio text, avatar_url text,
  symbol text, display_symbol text, asset_class text, side text, leverage numeric, entry_price numeric, exit_price numeric,
  realized_pnl numeric, pnl_pct numeric, closed_at timestamptz,
  likes bigint, reposts bigint, views bigint, followers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH best AS (
    SELECT DISTINCT ON (p.user_id) p.*
    FROM positions p
    JOIN copy_leader_applications a ON a.user_id = p.user_id AND a.status = 'approved' AND a.consent_at IS NOT NULL
    WHERE p.status = 'closed' AND p.realized_pnl IS NOT NULL AND p.closed_at > now() - interval '30 days'
      AND (p_asset IS NULL OR p.display_symbol ILIKE p_asset || '%')
    ORDER BY p.user_id, p.realized_pnl DESC
  )
  SELECT b.id, b.user_id, a.public_name, a.bio, pr.avatar_url,
    b.symbol, b.display_symbol, b.asset_class::text, b.side::text, b.leverage, b.entry_price, b.exit_price,
    b.realized_pnl,
    CASE WHEN b.quantity * b.entry_price > 0 THEN round(b.realized_pnl / (b.quantity * b.entry_price / greatest(b.leverage,1)) * 100, 2) END,
    b.closed_at,
    (SELECT count(*) FROM leaderboard_engagement e WHERE e.position_id = b.id AND e.kind='like'),
    (SELECT count(*) FROM leaderboard_engagement e WHERE e.position_id = b.id AND e.kind='repost'),
    (SELECT count(*) FROM leaderboard_engagement e WHERE e.position_id = b.id AND e.kind='view'),
    (SELECT count(*) FROM leaderboard_follows f WHERE f.leader_id = b.user_id)
  FROM best b
  JOIN copy_leader_applications a ON a.user_id = b.user_id
  LEFT JOIN profiles pr ON pr.id = b.user_id
  ORDER BY b.realized_pnl DESC
  LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.leaderboard_feed(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard_feed(text) TO authenticated;