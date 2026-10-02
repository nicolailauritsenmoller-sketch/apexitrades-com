ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS handover_state text,
  ADD COLUMN IF NOT EXISTS assigned_manager_email text;