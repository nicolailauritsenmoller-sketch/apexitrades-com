ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

ALTER TABLE public.support_ticket_messages
  ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "own ticket messages read" ON public.support_ticket_messages;
CREATE POLICY "own ticket messages read" ON public.support_ticket_messages
FOR SELECT TO authenticated
USING (
  internal = false
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_ticket_messages.ticket_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "own tickets read" ON public.support_tickets;
CREATE POLICY "own tickets read" ON public.support_tickets
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS support_tickets_assigned_agent_idx ON public.support_tickets(assigned_agent_id);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;