-- Fix: crear usuarios con identities correctas para login email/password
-- Ejecutar en Supabase → SQL Editor

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT * FROM (VALUES
      ('director@demo.com', 'Director Demo', 'director'),
      ('setter1@demo.com',  'María Setter',  'setter'),
      ('setter2@demo.com',  'Carlos Setter', 'setter'),
      ('closer1@demo.com',  'Lucas Closer',  'closer'),
      ('closer2@demo.com',  'Sofía Closer',  'closer')
    ) AS t(email, nombre, rol)
  ) LOOP

    -- Insertar en auth.users si no existe
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, confirmation_sent_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      aud, role,
      confirmation_token, recovery_token,
      email_change_token_new, email_change,
      is_sso_user, deleted_at
    )
    SELECT
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      r.email,
      crypt('Demo1234!', gen_salt('bf')),
      now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      format('{"nombre":"%s"}', r.nombre)::jsonb,
      now(), now(),
      'authenticated', 'authenticated',
      '', '', '', '',
      false, null
    WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = r.email);

    -- Insertar identity (necesario para login)
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at, provider_id
    )
    SELECT
      gen_random_uuid(),
      u.id,
      format('{"sub":"%s","email":"%s"}', u.id, u.email)::jsonb,
      'email',
      now(), now(), now(),
      u.email
    FROM auth.users u
    WHERE u.email = r.email
      AND NOT EXISTS (
        SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
      );

    -- Insertar profile
    INSERT INTO public.profiles (id, nombre, rol, activo)
    SELECT u.id, r.nombre, r.rol, true
    FROM auth.users u
    WHERE u.email = r.email
    ON CONFLICT (id) DO NOTHING;

  END LOOP;

  RAISE NOTICE 'Listo. Usuarios con login habilitado. Password: Demo1234!';
END $$;
