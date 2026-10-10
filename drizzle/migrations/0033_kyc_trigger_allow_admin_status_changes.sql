CREATE OR REPLACE FUNCTION public.validate_kyc_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_prefix text := NEW.user_id::text || '/';
BEGIN
  -- Validate documents only when they are submitted or replaced. Status-only
  -- transitions (e.g. admin unverify back to pending) must not re-validate.
  IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR NEW.selfie_path IS DISTINCT FROM OLD.selfie_path OR NEW.document_path IS DISTINCT FROM OLD.document_path) THEN
    IF NEW.document_type NOT IN ('passport','id_card','drivers_license') THEN
      RAISE EXCEPTION 'Unsupported identity document type';
    END IF;
    IF NEW.document_path IS NULL OR NEW.document_path NOT LIKE owner_prefix || '%' THEN
      RAISE EXCEPTION 'A valid identity document upload is required';
    END IF;
    IF NEW.selfie_path IS NULL OR NEW.selfie_path NOT LIKE owner_prefix || 'selfie-%' THEN
      RAISE EXCEPTION 'A valid selfie upload is required';
    END IF;
    IF NOT private.validate_selfie_capture(NEW.selfie_capture) THEN
      RAISE EXCEPTION 'Selfie must be captured live with the in-app camera';
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