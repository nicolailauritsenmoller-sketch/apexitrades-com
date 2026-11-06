ALTER TABLE public.vip_access ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE public.vip_access ADD COLUMN IF NOT EXISTS agent_joined_at timestamptz;
ALTER TABLE public.vip_access ADD COLUMN IF NOT EXISTS agent_last_seen_at timestamptz;
DROP POLICY IF EXISTS "authenticated read specialists" ON public.vip_specialists;
CREATE POLICY "staff read specialist identities" ON public.vip_specialists FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.accept_vip_queue(p_user_id uuid, p_role_key text, p_agent_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
 IF NOT private.is_staff(p_agent_id) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 UPDATE public.vip_access SET assigned_to=p_agent_id, unlocked=true, thread_status='open', resolved_at=null, accepted_at=now(), agent_joined_at=now(), agent_last_seen_at=now(), updated_at=now() WHERE user_id=p_user_id AND role_key=p_role_key AND (assigned_to IS NULL OR assigned_to=p_agent_id);
 GET DIAGNOSTICS changed = ROW_COUNT;
 RETURN changed=1;
END $$;
REVOKE ALL ON FUNCTION public.accept_vip_queue(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_vip_queue(uuid,text,uuid) TO service_role;