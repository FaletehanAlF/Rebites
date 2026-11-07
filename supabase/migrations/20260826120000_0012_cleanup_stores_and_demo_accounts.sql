





















CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;




DELETE FROM public.umkm_profiles
WHERE slug NOT IN ('warung-nusantara', 'dapur-ibu-tini', 'warkop-pak-iman');




INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'authenticated',
  'authenticated',
  'warungnusantara@rebites.id',
  extensions.crypt('rebites123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Ratna Sari","role":"umkm"}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;




INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
SELECT
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'email',
  jsonb_build_object(
    'sub', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    'email', 'warungnusantara@rebites.id',
    'email_verified', true
  ),
  now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities
  WHERE provider = 'email'
    AND provider_id IN ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e')
);

UPDATE public.umkm_profiles
SET user_id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    owner_name = COALESCE(owner_name, 'Ratna Sari')
WHERE slug = 'warung-nusantara'
  AND (user_id IS NULL OR user_id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e');




INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
  'authenticated',
  'authenticated',
  'pakiman@rebites.id',
  extensions.crypt('rebites123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Iman Suherman","role":"umkm"}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
SELECT
  'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
  'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
  'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
  'email',
  jsonb_build_object(
    'sub', 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
    'email', 'pakiman@rebites.id',
    'email_verified', true
  ),
  now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities
  WHERE provider = 'email'
    AND provider_id IN ('c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f')
);

UPDATE public.umkm_profiles
SET user_id = 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
    owner_name = COALESCE(owner_name, 'Iman Suherman')
WHERE slug = 'warkop-pak-iman'
  AND (user_id IS NULL OR user_id = 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f');




INSERT INTO public.subscriptions (
  umkm_id, plan_id, status, billing, price_paid, payment_method_id,
  current_period_start, current_period_end
)
SELECT
  u.id, p.id, 'active', 'yearly', p.price_yearly, NULL,
  now(), now() + interval '1 year'
FROM public.umkm_profiles u
JOIN public.plans p ON p.slug = 'premium'
WHERE u.slug IN ('warung-nusantara', 'warkop-pak-iman')
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.umkm_id = u.id
      AND s.plan_id = p.id
      AND s.status = 'active'
      AND s.current_period_end > now()
  );




UPDATE public.products
SET slug = 'roti-kopi'
WHERE slug = '/makanan14.jpg';
