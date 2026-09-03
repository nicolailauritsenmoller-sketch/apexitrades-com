ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS reference text;

CREATE OR REPLACE FUNCTION public.set_ticket_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  IF NEW.reference IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := 'VT-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE reference = candidate);
    tries := tries + 1;
    EXIT WHEN tries > 20;
  END LOOP;
  NEW.reference := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ticket_reference_trg ON public.support_tickets;
CREATE TRIGGER set_ticket_reference_trg
BEFORE INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_reference();

UPDATE public.support_tickets
SET reference = 'VT-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0')
WHERE reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_reference_key ON public.support_tickets (reference);

ALTER TABLE public.support_ticket_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text;