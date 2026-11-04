ALTER TABLE public.leaderboard_engagement DROP CONSTRAINT IF EXISTS leaderboard_engagement_kind_check;
ALTER TABLE public.leaderboard_engagement ADD CONSTRAINT leaderboard_engagement_kind_check CHECK (kind IN ('like','repost','view','share'));

-- Desk metrics derived only from each consenting approved leader's closed positions in the last 30 days.
CREATE OR REPLACE FUNCTION public.leaderboard_desks(p_asset text DEFAULT NULL)
RETURNS TABLE(position_id uuid, leader_id uuid, public_name text, bio text, avatar_url text,
  symbol text, display_symbol text, asset_class text, side text, leverage numeric, entry_price numeric, exit_price numeric,
  realized_pnl numeric, pnl_pct numeric, closed_at timestamptz,
  trades_30d bigint, volume_30d numeric, pnl_30d numeric, margin_30d numeric,
  sharpe numeric, sortino numeric, max_drawdown_pct numeric,
  kyc_verified boolean, vip_level integer, copy_traders bigint, views bigint, shares bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH leaders AS (
    SELECT a.user_id, a.public_name, a.bio FROM copy_leader_applications a
    WHERE a.status = 'approved' AND a.consent_at IS NOT NULL
  ), pos AS (
    SELECT p.*, p.quantity * p.entry_price AS notional,
      nullif(p.quantity * p.entry_price / greatest(p.leverage, 1), 0) AS margin
    FROM positions p JOIN leaders l ON l.user_id = p.user_id
    WHERE p.status = 'closed' AND p.realized_pnl IS NOT NULL AND p.closed_at > now() - interval '30 days'
      AND (p_asset IS NULL OR p.display_symbol ILIKE p_asset || '%')
  ), ret AS (
    SELECT pos.*, realized_pnl / margin AS r,
      sum(realized_pnl) OVER (PARTITION BY user_id ORDER BY closed_at) AS cum
    FROM pos
  ), dd AS (
    SELECT user_id, max(peak - cum) AS max_dd FROM (
      SELECT user_id, cum, greatest(0, max(cum) OVER (PARTITION BY user_id ORDER BY closed_at)) AS peak FROM ret
    ) x GROUP BY user_id
  ), stats AS (
    SELECT user_id, count(*) AS n, sum(notional) AS vol, sum(realized_pnl) AS pnl, sum(margin) AS mg,
      avg(r) AS mean_r, stddev_samp(r) AS sd_r,
      sqrt(avg(CASE WHEN r < 0 THEN r * r ELSE 0 END)) AS dsd_r
    FROM ret GROUP BY user_id
  ), best AS (
    SELECT DISTINCT ON (user_id) * FROM pos ORDER BY user_id, realized_pnl DESC
  )
  SELECT b.id, b.user_id, l.public_name, l.bio, pr.avatar_url,
    b.symbol, b.display_symbol, b.asset_class::text, b.side::text, b.leverage, b.entry_price, b.exit_price,
    b.realized_pnl, round(b.realized_pnl / b.margin * 100, 2), b.closed_at,
    s.n, round(s.vol, 2), round(s.pnl, 2), round(s.mg, 2),
    CASE WHEN s.n >= 2 AND s.sd_r > 0 THEN round(s.mean_r / s.sd_r, 2) END,
    CASE WHEN s.n >= 2 AND s.dsd_r > 0 THEN round(s.mean_r / s.dsd_r, 2) END,
    CASE WHEN s.mg > 0 THEN round(coalesce(d.max_dd, 0) / s.mg * 100, 2) END,
    EXISTS (SELECT 1 FROM kyc_submissions k WHERE k.user_id = b.user_id AND k.status = 'approved'),
    coalesce((SELECT v.level FROM vip_accounts v WHERE v.user_id = b.user_id), 0),
    (SELECT count(*) FROM trading_program_requests t WHERE t.leader_id = b.user_id AND t.status = 'approved'),
    (SELECT count(*) FROM leaderboard_engagement e WHERE e.position_id = b.id AND e.kind = 'view'),
    (SELECT count(*) FROM leaderboard_engagement e WHERE e.position_id = b.id AND e.kind IN ('share','repost'))
  FROM best b
  JOIN leaders l ON l.user_id = b.user_id
  JOIN stats s ON s.user_id = b.user_id
  LEFT JOIN dd d ON d.user_id = b.user_id
  LEFT JOIN profiles pr ON pr.id = b.user_id
  ORDER BY s.pnl DESC
  LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.leaderboard_desks(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard_desks(text) TO authenticated;