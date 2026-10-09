ALTER TABLE public.vip_access ADD COLUMN IF NOT EXISTS thread_status text NOT NULL DEFAULT 'open';
ALTER TABLE public.vip_access ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.vip_access ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.vip_messages ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;
ALTER TABLE public.vip_specialists ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'available';
DROP POLICY IF EXISTS "own vip messages read" ON public.vip_messages;
CREATE POLICY "own vip messages read" ON public.vip_messages FOR SELECT TO authenticated USING (auth.uid() = user_id AND is_internal = false);