-- Independent, first-class status fields for each individual verification tier.
ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS kyc_level_1_status text NOT NULL DEFAULT 'unsubmitted',
  ADD COLUMN IF NOT EXISTS kyc_level_2_status text NOT NULL DEFAULT 'unsubmitted';

-- Backfill from the legacy tier columns.
UPDATE public.kyc_submissions
SET kyc_level_1_status = COALESCE(status::text, 'unsubmitted'),
    kyc_level_2_status = COALESCE(level2_status, 'unsubmitted');

-- Keep the independent fields authoritative and in step with the legacy columns,
-- so a Level 1 review can never alter Level 2 state and vice versa.
CREATE OR REPLACE FUNCTION public.sync_kyc_level_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.kyc_level_1_status := COALESCE(NEW.status::text, 'unsubmitted');
    NEW.kyc_level_2_status := COALESCE(NEW.level2_status, 'unsubmitted');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.kyc_level_1_status := COALESCE(NEW.status::text, 'unsubmitted');
  ELSIF NEW.kyc_level_1_status IS DISTINCT FROM OLD.kyc_level_1_status THEN
    NEW.status := NEW.kyc_level_1_status::public.request_status;
  END IF;

  IF NEW.level2_status IS DISTINCT FROM OLD.level2_status THEN
    NEW.kyc_level_2_status := COALESCE(NEW.level2_status, 'unsubmitted');
  ELSIF NEW.kyc_level_2_status IS DISTINCT FROM OLD.kyc_level_2_status THEN
    NEW.level2_status := NEW.kyc_level_2_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kyc_sync_level_status ON public.kyc_submissions;
CREATE TRIGGER kyc_sync_level_status
BEFORE INSERT OR UPDATE ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.sync_kyc_level_status();