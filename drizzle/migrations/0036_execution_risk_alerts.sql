CREATE OR REPLACE FUNCTION public.notify_contract_settled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pnl numeric;
BEGIN
  IF NEW.result IS NOT NULL AND OLD.result IS NULL THEN
    pnl := COALESCE(NEW.payout, 0) - NEW.stake;
    INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (NEW.user_id,
      CASE WHEN pnl >= 0 THEN 'Scalp trade closed in profit' ELSE 'Scalp trade closed at a loss' END,
      NEW.display_symbol || ' ' || upper(NEW.direction) || ' ' || NEW.leverage::text || 'x settled at ' || COALESCE(NEW.exit_price::text, '-') ||
      '. Stake ' || round(NEW.stake, 2)::text || ' ' || NEW.currency || ', P/L ' || CASE WHEN pnl >= 0 THEN '+' ELSE '' END || round(pnl, 2)::text || ' ' || NEW.currency || '.',
      'trade_execution');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contracts_notify_settled ON public.contracts;
CREATE TRIGGER contracts_notify_settled AFTER UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.notify_contract_settled();

CREATE OR REPLACE FUNCTION public.notify_position_closed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (NEW.user_id, 'Position closed',
      NEW.display_symbol || ' ' || upper(NEW.side::text) || ' ' || NEW.leverage::text || 'x closed at ' || COALESCE(NEW.exit_price::text, '-') ||
      '. Realized P/L ' || COALESCE(round(NEW.realized_pnl, 2)::text, '0') || ' ' || NEW.currency || '.',
      'trade_execution');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS positions_notify_closed ON public.positions;
CREATE TRIGGER positions_notify_closed AFTER UPDATE ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.notify_position_closed();

CREATE OR REPLACE FUNCTION public.record_self_alert(p_kind text, p_title text, p_body text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR p_kind NOT IN ('price_alert', 'margin_risk') THEN RETURN false; END IF;
  IF length(p_title) > 120 OR length(p_body) > 400 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = uid AND kind = p_kind AND title = p_title
             AND created_at > now() - interval '30 minutes') THEN RETURN false; END IF;
  INSERT INTO public.notifications (user_id, title, body, kind) VALUES (uid, p_title, p_body, p_kind);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_self_alert(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_self_alert(text, text, text) TO authenticated;