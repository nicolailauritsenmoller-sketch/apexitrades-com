ALTER TABLE public.kyc_submissions ADD COLUMN IF NOT EXISTS level2_selfie_deleted_at timestamptz;
COMMENT ON COLUMN public.kyc_submissions.level2_selfie_deleted_at IS 'Officer-authorized biometric purge timestamp; approval and review history remain unchanged.';
CREATE OR REPLACE FUNCTION public.validate_kyc_submission()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE owner_prefix text := NEW.user_id::text || '/'; authorized_purge boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    authorized_purge := current_setting('app.kyc_biometric_purge', true) = OLD.id::text
      AND OLD.level2_status = 'approved' AND NEW.level2_status = OLD.level2_status
      AND NEW.status = OLD.status AND NEW.user_id = OLD.user_id
      AND NEW.level2_selfie_path IS NULL AND NEW.level2_selfie_capture IS NULL
      AND NEW.level2_selfie_deleted_at IS NOT NULL;
    IF NEW.level2_selfie_deleted_at IS DISTINCT FROM OLD.level2_selfie_deleted_at AND NOT coalesce(authorized_purge, false) THEN
      IF NEW.level2_selfie_deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Biometric purge metadata is officer-managed'; END IF;
    END IF;
  ELSIF NEW.level2_selfie_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Biometric purge metadata is officer-managed';
  END IF;
  IF (NEW.status = 'pending' AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.selfie_path IS DISTINCT FROM OLD.selfie_path OR NEW.document_path IS DISTINCT FROM OLD.document_path OR NEW.document_back_path IS DISTINCT FROM OLD.document_back_path))
     OR (NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')) THEN
    IF coalesce(trim(NEW.full_name), '') = '' OR coalesce(trim(NEW.country), '') = '' THEN RAISE EXCEPTION 'All Level 1 identity fields are required'; END IF;
    IF NEW.document_type NOT IN ('passport','id_card','drivers_license') THEN RAISE EXCEPTION 'Unsupported identity document type'; END IF;
    IF NEW.date_of_birth IS NULL OR coalesce(trim(NEW.address), '') = '' OR coalesce(trim(NEW.document_number), '') = '' OR NEW.document_expires_at IS NULL THEN RAISE EXCEPTION 'All Level 1 identity fields are required'; END IF;
    IF NEW.document_path IS NULL OR NEW.document_path NOT LIKE owner_prefix || 'document-front-%' THEN RAISE EXCEPTION 'A valid document front image is required'; END IF;
    IF NEW.document_back_path IS NULL OR NEW.document_back_path NOT LIKE owner_prefix || 'document-back-%' THEN RAISE EXCEPTION 'A valid document back image is required'; END IF;
    IF NEW.status = 'pending' AND NEW.selfie_path IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.selfie_path IS DISTINCT FROM OLD.selfie_path) THEN
      IF NEW.selfie_path NOT LIKE owner_prefix || 'selfie-%' OR NOT private.validate_selfie_capture(NEW.selfie_capture) THEN RAISE EXCEPTION 'Selfie must be captured live with the in-app camera'; END IF;
    END IF;
  END IF;
  IF NEW.level2_status IN ('pending','approved') AND (TG_OP = 'INSERT' OR NEW.level2_status IS DISTINCT FROM OLD.level2_status OR NEW.level2_selfie_path IS DISTINCT FROM OLD.level2_selfie_path OR NEW.level2_selfie_capture IS DISTINCT FROM OLD.level2_selfie_capture) AND NOT coalesce(authorized_purge, false) THEN
    IF NEW.status IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Lv.1 must be approved before Lv.2 review'; END IF;
    IF NEW.level2_selfie_path IS NULL OR NEW.level2_selfie_path NOT LIKE owner_prefix || 'level2-selfie-%' THEN RAISE EXCEPTION 'A valid live selfie upload is required for Lv.2'; END IF;
    IF NEW.level2_selfie_capture IS NULL OR coalesce(NEW.level2_selfie_capture->>'source','') <> 'camera' OR coalesce(NEW.level2_selfie_capture->>'capturedAt','') = '' THEN RAISE EXCEPTION 'Lv.2 selfie requires in-app camera capture metadata'; END IF;
    IF NEW.level2_status = 'pending' AND NOT private.validate_selfie_capture(NEW.level2_selfie_capture) THEN RAISE EXCEPTION 'Lv.2 selfie must be captured live within the last 30 minutes'; END IF;
    IF NEW.level2_status = 'approved' AND (TG_OP = 'INSERT' OR OLD.level2_status IS DISTINCT FROM 'pending') THEN RAISE EXCEPTION 'Lv.2 must be submitted before approval'; END IF;
  END IF;
  IF NEW.level2_status = 'pending' AND (TG_OP = 'INSERT' OR NEW.level2_status IS DISTINCT FROM OLD.level2_status OR NEW.level2_selfie_path IS DISTINCT FROM OLD.level2_selfie_path OR NEW.level2_selfie_capture IS DISTINCT FROM OLD.level2_selfie_capture) THEN
    NEW.level2_selfie_deleted_at := NULL;
    NEW.level2_proof_path := NULL; NEW.level2_proof_type := NULL; NEW.level2_proof_issued_at := NULL; NEW.level2_tax_id := NULL;
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.finalize_kyc_biometric_purge(p_id uuid, p_actor uuid, p_expected_path text, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r public.kyc_submissions%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF length(trim(p_reason)) < 5 OR length(p_reason) > 400 THEN RAISE EXCEPTION 'An audit reason is required'; END IF;
  SELECT * INTO r FROM public.kyc_submissions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification record not found'; END IF;
  IF r.level2_status <> 'approved' THEN RAISE EXCEPTION 'Only approved Lv.2 captures can be deleted'; END IF;
  IF r.level2_selfie_path IS NULL AND r.level2_selfie_deleted_at IS NOT NULL THEN RETURN true; END IF;
  IF r.level2_selfie_path IS DISTINCT FROM p_expected_path OR p_expected_path NOT LIKE r.user_id::text || '/level2-selfie-%' THEN RAISE EXCEPTION 'Biometric evidence changed; reopen the review'; END IF;
  PERFORM set_config('app.kyc_biometric_purge', r.id::text, true);
  UPDATE public.kyc_submissions SET level2_selfie_path = NULL, level2_selfie_capture = NULL, level2_selfie_deleted_at = now() WHERE id = r.id;
  INSERT INTO public.admin_audit_logs (actor_id, action, target_user_id, details)
    VALUES (p_actor, 'kyc.level2.biometric_deleted', r.user_id, jsonb_build_object('submission_id', r.id, 'note', trim(p_reason), 'approval_preserved', true));
  PERFORM set_config('app.kyc_biometric_purge', '', true);
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.finalize_kyc_biometric_purge(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_kyc_biometric_purge(uuid, uuid, text, text) TO service_role;