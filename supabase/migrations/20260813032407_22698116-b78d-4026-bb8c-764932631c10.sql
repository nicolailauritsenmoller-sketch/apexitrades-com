ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trading_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS withdrawals_disabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.outcome_mode IS DISTINCT FROM OLD.outcome_mode
     OR NEW.credit_score IS DISTINCT FROM OLD.credit_score
     OR NEW.referral_rewards_usdt IS DISTINCT FROM OLD.referral_rewards_usdt
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.uid IS DISTINCT FROM OLD.uid
     OR NEW.trading_frozen IS DISTINCT FROM OLD.trading_frozen
     OR NEW.withdrawals_disabled IS DISTINCT FROM OLD.withdrawals_disabled
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify administrative profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_user_notes TO authenticated;
GRANT ALL ON public.admin_user_notes TO service_role;

ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage user notes"
  ON public.admin_user_notes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS admin_user_notes_user_idx ON public.admin_user_notes (user_id, created_at DESC);

CREATE TRIGGER trg_admin_user_notes_updated
  BEFORE UPDATE ON public.admin_user_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();