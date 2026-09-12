ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspension_note text,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_suspension_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_suspension_status_check
  CHECK (suspension_status IN ('active', 'suspended', 'permanently_banned'));

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
     OR NEW.account_frozen IS DISTINCT FROM OLD.account_frozen
     OR NEW.suspension_status IS DISTINCT FROM OLD.suspension_status
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
     OR NEW.suspension_note IS DISTINCT FROM OLD.suspension_note
     OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify administrative profile fields';
  END IF;

  RETURN NEW;
END;
$function$;