ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'support';
DROP POLICY IF EXISTS "own messages read" ON public.chat_messages;
CREATE POLICY "own messages read" ON public.chat_messages FOR SELECT TO authenticated
USING (is_internal = false AND EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "own messages insert" ON public.chat_messages;
CREATE POLICY "own messages insert" ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND is_internal = false AND EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()));