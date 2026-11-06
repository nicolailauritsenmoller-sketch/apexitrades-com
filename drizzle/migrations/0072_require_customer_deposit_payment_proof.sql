CREATE OR REPLACE FUNCTION public.validate_customer_deposit_proof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NEW.user_id = auth.uid() THEN
    IF NEW.receipt_path IS NULL OR btrim(NEW.receipt_path) = '' THEN
      RAISE EXCEPTION 'Attach proof of payment / a transaction screenshot before submitting your deposit.';
    END IF;
    IF split_part(NEW.receipt_path, '/', 1) <> NEW.user_id::text OR NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'deposit-proofs' AND name = NEW.receipt_path
        AND coalesce((metadata->>'size')::bigint, 0) > 0
        AND metadata->>'mimetype' LIKE 'image/%'
    ) THEN
      RAISE EXCEPTION 'Upload a valid payment screenshot to your account before submitting your deposit.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER require_customer_deposit_proof
BEFORE INSERT ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.validate_customer_deposit_proof();