ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS announcements_target_user_idx ON public.announcements(target_user_id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name_updated_at timestamptz;