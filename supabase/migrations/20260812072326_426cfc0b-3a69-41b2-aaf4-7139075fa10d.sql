DROP POLICY IF EXISTS "Signed-in users can view agent profiles" ON public.agent_profiles;

CREATE POLICY "Users view agent profiles they interact with"
ON public.agent_profiles
FOR SELECT
TO authenticated
USING (
  private.is_staff(auth.uid())
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.user_id = auth.uid() AND s.active_agent_id = agent_profiles.user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.chat_messages m
    JOIN public.chat_sessions s2 ON s2.id = m.session_id
    WHERE s2.user_id = auth.uid() AND m.sender_id = agent_profiles.user_id
  )
);

DROP POLICY IF EXISTS "Staff update their own agent profile" ON public.agent_profiles;

CREATE POLICY "Staff update their own agent profile"
ON public.agent_profiles
FOR UPDATE
TO authenticated
USING ((auth.uid() = user_id) AND private.is_staff(auth.uid()))
WITH CHECK ((auth.uid() = user_id) AND private.is_staff(auth.uid()));