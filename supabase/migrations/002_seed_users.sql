-- ============================================================
-- SEED: Usuarios de prueba
-- Ejecutar en Supabase → SQL Editor
-- ============================================================
-- Usuarios creados:
--   director@demo.com   / Demo1234!  (director)
--   setter1@demo.com    / Demo1234!  (setter)
--   setter2@demo.com    / Demo1234!  (setter)
--   closer1@demo.com    / Demo1234!  (closer)
--   closer2@demo.com    / Demo1234!  (closer)
-- ============================================================

-- Crear usuarios usando la función oficial de Supabase Auth Admin
DO $$
DECLARE
  uid_director uuid;
  uid_setter1  uuid;
  uid_setter2  uuid;
  uid_closer1  uuid;
  uid_closer2  uuid;

  PROCEDURE create_user(OUT out_id uuid, p_email text, p_password text) AS $inner$
  BEGIN
    SELECT id INTO out_id FROM auth.users WHERE email = p_email;
    IF out_id IS NULL THEN
      out_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        aud, role, confirmation_token, recovery_token, is_sso_user, deleted_at
      ) VALUES (
        out_id,
        '00000000-0000-0000-0000-000000000000',
        p_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        now(), now(),
        'authenticated', 'authenticated', '', '', false, null
      );
    END IF;
  END;
  $inner$ LANGUAGE plpgsql;

BEGIN
  CALL create_user(uid_director, 'director@demo.com', 'Demo1234!');
  INSERT INTO public.profiles (id, nombre, rol, activo)
  VALUES (uid_director, 'Director Demo', 'director', true)
  ON CONFLICT (id) DO NOTHING;

  CALL create_user(uid_setter1, 'setter1@demo.com', 'Demo1234!');
  INSERT INTO public.profiles (id, nombre, rol, activo)
  VALUES (uid_setter1, 'María Setter', 'setter', true)
  ON CONFLICT (id) DO NOTHING;

  CALL create_user(uid_setter2, 'setter2@demo.com', 'Demo1234!');
  INSERT INTO public.profiles (id, nombre, rol, activo)
  VALUES (uid_setter2, 'Carlos Setter', 'setter', true)
  ON CONFLICT (id) DO NOTHING;

  CALL create_user(uid_closer1, 'closer1@demo.com', 'Demo1234!');
  INSERT INTO public.profiles (id, nombre, rol, activo)
  VALUES (uid_closer1, 'Lucas Closer', 'closer', true)
  ON CONFLICT (id) DO NOTHING;

  CALL create_user(uid_closer2, 'closer2@demo.com', 'Demo1234!');
  INSERT INTO public.profiles (id, nombre, rol, activo)
  VALUES (uid_closer2, 'Sofía Closer', 'closer', true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Usuarios creados correctamente. Password de todos: Demo1234!';
END $$;
