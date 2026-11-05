CREATE OR REPLACE FUNCTION public.validate_kyc_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_prefix text := NEW.user_id::text || '/';
BEGIN
  IF (NEW.status = 'pending' AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.selfie_path IS DISTINCT FROM OLD.selfie_path OR NEW.document_path IS DISTINCT FROM OLD.document_path OR NEW.document_back_path IS DISTINCT FROM OLD.document_back_path))
     OR (NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')) THEN
    IF coalesce(trim(NEW.full_name), '') = '' OR coalesce(trim(NEW.country), '') = '' THEN
      RAISE EXCEPTION 'All Level 1 identity fields are required';
    END IF;
    IF NEW.document_type NOT IN ('passport','id_card','drivers_license') THEN
      RAISE EXCEPTION 'Unsupported identity document type';
    END IF;
    IF NEW.date_of_birth IS NULL OR coalesce(trim(NEW.address), '') = '' OR coalesce(trim(NEW.document_number), '') = '' OR NEW.document_expires_at IS NULL THEN
      RAISE EXCEPTION 'All Level 1 identity fields are required';
    END IF;
    IF NEW.document_path IS NULL OR NEW.document_path NOT LIKE owner_prefix || 'document-front-%' THEN
      RAISE EXCEPTION 'A valid document front image is required';
    END IF;
    IF NEW.document_back_path IS NULL OR NEW.document_back_path NOT LIKE owner_prefix || 'document-back-%' THEN
      RAISE EXCEPTION 'A valid document back image is required';
    END IF;
    IF NEW.status = 'pending' AND NEW.selfie_path IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.selfie_path IS DISTINCT FROM OLD.selfie_path) THEN
      IF NEW.selfie_path NOT LIKE owner_prefix || 'selfie-%' OR NOT private.validate_selfie_capture(NEW.selfie_capture) THEN
        RAISE EXCEPTION 'Selfie must be captured live with the in-app camera';
      END IF;
    END IF;
  END IF;
  IF NEW.level2_status = 'pending' AND (TG_OP = 'INSERT' OR OLD.level2_status IS DISTINCT FROM 'pending') THEN
    IF NEW.level2_proof_path IS NULL OR NEW.level2_proof_path NOT LIKE owner_prefix || '%' THEN
      RAISE EXCEPTION 'A valid proof of address upload is required';
    END IF;
    IF NEW.level2_selfie_path IS NULL OR NEW.level2_selfie_path NOT LIKE owner_prefix || 'level2-selfie-%' THEN
      RAISE EXCEPTION 'A valid liveness selfie upload is required';
    END IF;
    IF NOT private.validate_selfie_capture(NEW.level2_selfie_capture) THEN
      RAISE EXCEPTION 'Liveness selfie must be captured live with the in-app camera';
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON COLUMN public.kyc_submissions.full_name IS 'Level 1: full legal name';
COMMENT ON COLUMN public.kyc_submissions.country IS 'Level 1: country of residence';
COMMENT ON COLUMN public.kyc_submissions.address IS 'Level 1: residential address';
COMMENT ON COLUMN public.kyc_submissions.document_expires_at IS 'Level 1: document expiry date';
COMMENT ON COLUMN public.kyc_submissions.document_path IS 'Level 1: document front image storage reference';
COMMENT ON COLUMN public.kyc_submissions.document_back_path IS 'Level 1: document back image storage reference';