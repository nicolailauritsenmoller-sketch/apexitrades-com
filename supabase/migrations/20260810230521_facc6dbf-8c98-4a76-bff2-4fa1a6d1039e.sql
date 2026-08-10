
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tickets read" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own tickets insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff tickets read" ON public.support_tickets FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff tickets update" ON public.support_tickets FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'user',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ticket messages read" ON public.support_ticket_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "own ticket messages insert" ON public.support_ticket_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "staff ticket messages read" ON public.support_ticket_messages FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff ticket messages insert" ON public.support_ticket_messages FOR INSERT TO authenticated
WITH CHECK (private.is_staff(auth.uid()) AND sender_id = auth.uid());

CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX idx_ticket_messages_ticket ON public.support_ticket_messages(ticket_id, created_at);

ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS agent_last_read_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  ADD COLUMN IF NOT EXISTS user_last_read_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z';
