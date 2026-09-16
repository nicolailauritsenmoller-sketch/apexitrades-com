// auto-generated and intentionally left blank, do not edit
DO $$ 
DECLARE 
  u_id uuid;
BEGIN
  -- Get your user ID from auth.users
  SELECT id INTO u_id FROM auth.users WHERE email = 'nicolailauritsenmoller@gmail.com';

  -- Update auth user metadata
  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"status": "active", "is_frozen": false}'::jsonb,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"status": "active", "is_frozen": false}'::jsonb
  WHERE id = u_id;

  -- Attempt updates across all standard profile table names
  BEGIN
    UPDATE public.profiles SET status = 'active', is_frozen = false WHERE id = u_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.user_profiles SET status = 'active', is_frozen = false WHERE id = u_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.users SET status = 'active', is_frozen = false WHERE id = u_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
