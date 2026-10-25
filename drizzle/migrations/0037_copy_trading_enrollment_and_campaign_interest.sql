CREATE TABLE public.copy_leader_applications (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  public_name text NOT NULL CHECK (char_length(public_name) BETWEEN 2 AND 60),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 400),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.copy_leader_applications TO authenticated;
GRANT ALL ON public.copy_leader_applications TO service_role;
ALTER TABLE public.copy_leader_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own copy leader application" ON public.copy_leader_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Apply as consenting copy leader" ON public.copy_leader_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE TABLE public.trading_program_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  program text NOT NULL CHECK (program IN ('copy_trading','tournament','liquidity')),
  leader_id uuid REFERENCES public.copy_leader_applications(user_id),
  requested_budget numeric NOT NULL DEFAULT 0 CHECK (requested_budget >= 0),
  leverage integer NOT NULL DEFAULT 1 CHECK (leverage IN (1,2,5,10)),
  status text NOT NULL DEFAULT 'pending' CHECK (status = 'pending'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_program_requests TO authenticated;
GRANT ALL ON public.trading_program_requests TO service_role;
ALTER TABLE public.trading_program_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trading program requests" ON public.trading_program_requests FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND status = 'pending' AND (leader_id IS NULL OR EXISTS (SELECT 1 FROM public.copy_leader_applications l WHERE l.user_id = leader_id AND l.status = 'approved')));

CREATE FUNCTION public.copy_leader_directory()
RETURNS TABLE (leader_id uuid, public_name text, bio text, closed_trades bigint, roi_pct numeric, win_rate_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.user_id, l.public_name, l.bio, COUNT(p.id),
    CASE WHEN SUM(p.entry_price * p.quantity / p.leverage) > 0 THEN
      100 * SUM((p.exit_price-p.entry_price)*p.quantity*(CASE WHEN p.side='long' THEN 1 ELSE -1 END)-p.fees_paid) / SUM(p.entry_price*p.quantity/p.leverage)
    ELSE NULL END,
    CASE WHEN COUNT(p.id)>0 THEN 100.0*COUNT(p.id) FILTER (WHERE (p.exit_price-p.entry_price)*p.quantity*(CASE WHEN p.side='long' THEN 1 ELSE -1 END)-p.fees_paid > 0)/COUNT(p.id) ELSE NULL END
  FROM public.copy_leader_applications l
  JOIN public.profiles pr ON pr.id = l.user_id AND pr.outcome_mode = 'normal' AND NOT pr.trading_frozen AND NOT pr.account_frozen
  LEFT JOIN public.positions p ON p.user_id = l.user_id AND p.status = 'closed' AND p.exit_price IS NOT NULL AND p.closed_at >= now()-interval '30 days'
  WHERE l.status = 'approved' AND auth.uid() IS NOT NULL
  GROUP BY l.user_id, l.public_name, l.bio;
$$;
REVOKE ALL ON FUNCTION public.copy_leader_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_leader_directory() TO authenticated;
COMMENT ON FUNCTION public.copy_leader_directory() IS 'Consenting approved leaders only. Historical closed-position return on committed margin, net of recorded fees; no contracts, balance claims or execution authorization.';
COMMENT ON TABLE public.trading_program_requests IS 'Non-executing enrollment requests only. Budget is a preference, never reserved or debited. All programs remain pending until financial execution and approved terms exist.';