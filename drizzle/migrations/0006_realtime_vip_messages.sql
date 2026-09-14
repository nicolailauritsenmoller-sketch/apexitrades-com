ALTER TABLE public.vip_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vip_messages;