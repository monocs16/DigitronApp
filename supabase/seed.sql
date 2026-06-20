-- Local development seed
-- Creates a super-admin user so `supabase db reset` leaves the stack ready to use.
--
-- Credentials: admin@digitron.local / Admin1234!
--
-- The migration trigger (handle_new_user) fires on INSERT INTO auth.users and:
--   · auto-creates the profile row
--   · assigns 'super' role because this is the first user (user_roles count = 0)

DO $$
DECLARE
  _id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@digitron.local') THEN
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    _id,
    'authenticated', 'authenticated',
    'admin@digitron.local',
    crypt('Admin1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin Digitron"}',
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    _id::TEXT,
    _id,
    jsonb_build_object('sub', _id, 'email', 'admin@digitron.local', 'email_verified', true),
    'email',
    now(), now(), now()
  );

  -- Ensure super role regardless of trigger count (seed user is always super)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_id, 'super')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id = _id AND role <> 'super';
END $$;
