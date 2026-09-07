ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS withdrawal_password_hash TEXT,
ADD COLUMN IF NOT EXISTS withdrawal_password_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_withdrawal_password(
  p_user_id UUID,
  p_password_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_updated TIMESTAMPTZ;
  v_working_days_passed INT;
  v_days_needed INT := 7;
BEGIN
  SELECT withdrawal_password_updated_at INTO v_last_updated
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_last_updated IS NOT NULL THEN
    SELECT COUNT(*)::INT INTO v_working_days_passed
    FROM generate_series(
      v_last_updated::date + INTERVAL '1 day',
      now()::date,
      INTERVAL '1 day'
    ) AS g(day)
    WHERE EXTRACT(DOW FROM g.day) NOT IN (0, 6);

    IF v_working_days_passed < v_days_needed THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Withdrawal password can only be updated after 7 working days. %s working day(s) remaining.', v_days_needed - v_working_days_passed)
      );
    END IF;
  END IF;

  UPDATE public.profiles
  SET withdrawal_password_hash = p_password_hash,
      withdrawal_password_updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Withdrawal password updated successfully.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_withdrawal_password(
  p_user_id UUID,
  p_provided_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_hash TEXT;
BEGIN
  SELECT withdrawal_password_hash INTO v_stored_hash
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_stored_hash IS NULL OR v_stored_hash <> p_provided_hash THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_withdrawal_password(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_withdrawal_password(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_withdrawal_password(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_withdrawal_password(UUID, TEXT) TO service_role;