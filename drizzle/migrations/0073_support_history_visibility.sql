DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['chat_sessions','chat_messages','support_tickets','support_ticket_messages','vip_access','vip_messages'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS hidden_from_customer_at timestamptz, ADD COLUMN IF NOT EXISTS hidden_from_staff_at timestamptz', t);
  EXECUTE format('CREATE POLICY "customer hidden history" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (hidden_from_customer_at IS NULL OR private.is_staff(auth.uid()))', t);
END LOOP; END $$;