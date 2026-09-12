CREATE OR REPLACE FUNCTION public.purge_old_session_replays()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.session_replays
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_session_replays() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_session_replays() TO service_role;

CREATE INDEX IF NOT EXISTS session_replays_created_at_idx
  ON public.session_replays (created_at);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('purge-session-replays');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'purge-session-replays',
    '30 3 * * *',
    $cron$SELECT public.purge_old_session_replays();$cron$
  );
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;