







CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'authenticated',
  'authenticated',
  'seller@rebites.id',
  extensions.crypt('rebites123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Tini Rahayu","role":"umkm"}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;


INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
VALUES (
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'email',
  'email',
  jsonb_build_object(
    'sub', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'email', 'seller@rebites.id',
    'email_verified', true
  ),
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;


UPDATE public.umkm_profiles
SET user_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
WHERE slug = 'dapur-ibu-tini' AND user_id IS NULL;
