ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS level2_status text NOT NULL DEFAULT 'unsubmitted',
  ADD COLUMN IF NOT EXISTS level2_selfie_path text,
  ADD COLUMN IF NOT EXISTS level2_proof_path text,
  ADD COLUMN IF NOT EXISTS level2_proof_type text,
  ADD COLUMN IF NOT EXISTS level2_tax_id text,
  ADD COLUMN IF NOT EXISTS level2_admin_note text,
  ADD COLUMN IF NOT EXISTS level2_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS level2_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS level2_reviewed_by uuid;

ALTER TABLE public.kyc_submissions
  DROP CONSTRAINT IF EXISTS kyc_level2_status_check;
ALTER TABLE public.kyc_submissions
  ADD CONSTRAINT kyc_level2_status_check
  CHECK (level2_status IN ('unsubmitted','pending','approved','rejected'));

CREATE OR REPLACE FUNCTION public.guard_kyc_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Members may only move a level into review, never approve or reject it.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending'::request_status THEN
    RAISE EXCEPTION 'Not allowed to change verification status';
  END IF;

  IF NEW.level2_status IS DISTINCT FROM OLD.level2_status AND NEW.level2_status <> 'pending' THEN
    RAISE EXCEPTION 'Not allowed to change verification status';
  END IF;

  IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.level2_reviewed_by IS DISTINCT FROM OLD.level2_reviewed_by
     OR NEW.level2_admin_note IS DISTINCT FROM OLD.level2_admin_note THEN
    RAISE EXCEPTION 'Not allowed to modify review fields';
  END IF;

  -- Level 2 requires an approved Level 1.
  IF NEW.level2_status = 'pending'
     AND NEW.level2_status IS DISTINCT FROM OLD.level2_status
     AND OLD.status <> 'approved'::request_status THEN
    RAISE EXCEPTION 'Level 1 verification must be approved first';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_kyc_user_update ON public.kyc_submissions;
CREATE TRIGGER guard_kyc_user_update
BEFORE UPDATE ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_kyc_user_update();

DROP POLICY IF EXISTS "own kyc update resubmit" ON public.kyc_submissions;
CREATE POLICY "own kyc update resubmit"
ON public.kyc_submissions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (status = 'pending'::request_status OR level2_status = 'pending')
);