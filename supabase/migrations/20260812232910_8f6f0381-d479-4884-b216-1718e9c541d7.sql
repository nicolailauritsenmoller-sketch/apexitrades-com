CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.outcome_mode IS DISTINCT FROM OLD.outcome_mode
     OR NEW.credit_score IS DISTINCT FROM OLD.credit_score
     OR NEW.referral_rewards_usdt IS DISTINCT FROM OLD.referral_rewards_usdt
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.uid IS DISTINCT FROM OLD.uid
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify administrative profile fields';
  END IF;

  RETURN NEW;
END;
$$;