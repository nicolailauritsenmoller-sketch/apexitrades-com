CREATE OR REPLACE FUNCTION public.validate_kyc_submission()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE owner_prefix text := NEW.user_id::text || '/';
BEGIN
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
  IF NEW.level2_status IN ('pending','approved') AND (TG_OP = 'INSERT' OR NEW.level2_status IS DISTINCT FROM OLD.level2_status OR NEW.level2_selfie_path IS DISTINCT FROM OLD.level2_selfie_path OR NEW.level2_selfie_capture IS DISTINCT FROM OLD.level2_selfie_capture) THEN
    IF NEW.status IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Lv.1 must be approved before Lv.2 review'; END IF;
    IF NEW.level2_selfie_path IS NULL OR NEW.level2_selfie_path NOT LIKE owner_prefix || 'level2-selfie-%' THEN RAISE EXCEPTION 'A valid live selfie upload is required for Lv.2'; END IF;
    IF NEW.level2_selfie_capture IS NULL OR coalesce(NEW.level2_selfie_capture->>'source','') <> 'camera' OR coalesce(NEW.level2_selfie_capture->>'capturedAt','') = '' THEN RAISE EXCEPTION 'Lv.2 selfie requires in-app camera capture metadata'; END IF;
    IF NEW.level2_status = 'pending' AND NOT private.validate_selfie_capture(NEW.level2_selfie_capture) THEN RAISE EXCEPTION 'Lv.2 selfie must be captured live within the last 30 minutes'; END IF;
    IF NEW.level2_status = 'approved' AND (TG_OP = 'INSERT' OR OLD.level2_status IS DISTINCT FROM 'pending') THEN RAISE EXCEPTION 'Lv.2 must be submitted before approval'; END IF;
  END IF;
  IF NEW.level2_status = 'pending' AND (TG_OP = 'INSERT' OR NEW.level2_status IS DISTINCT FROM OLD.level2_status OR NEW.level2_selfie_path IS DISTINCT FROM OLD.level2_selfie_path OR NEW.level2_selfie_capture IS DISTINCT FROM OLD.level2_selfie_capture) THEN
    NEW.level2_proof_path := NULL;
    NEW.level2_proof_type := NULL;
    NEW.level2_proof_issued_at := NULL;
    NEW.level2_tax_id := NULL;
  END IF;
  RETURN NEW;
END $function$;
COMMENT ON COLUMN public.kyc_submissions.level2_proof_path IS 'DEPRECATED: Lv.2 uses live biometric selfie only; legacy evidence retained but not used for validation or review.';
COMMENT ON COLUMN public.kyc_submissions.level2_proof_type IS 'DEPRECATED: Lv.2 uses live biometric selfie only.';
COMMENT ON COLUMN public.kyc_submissions.level2_proof_issued_at IS 'DEPRECATED: Lv.2 uses live biometric selfie only.';
COMMENT ON COLUMN public.kyc_submissions.level2_tax_id IS 'DEPRECATED: Lv.2 uses live biometric selfie only.';