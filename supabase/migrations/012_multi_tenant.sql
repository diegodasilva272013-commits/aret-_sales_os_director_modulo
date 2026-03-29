-- ============================================================
-- MULTI-TENANT: Aislamiento por director
-- Cada director solo ve sus propios equipos, proyectos y datos
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. profiles: cada setter/closer pertenece a un director
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_director ON profiles(director_id);

-- 2. proyectos: cada proyecto pertenece a un director
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_proyectos_director ON proyectos(director_id);

-- 3. metas_mes: metas por director
ALTER TABLE metas_mes ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES profiles(id);
ALTER TABLE metas_mes DROP CONSTRAINT IF EXISTS metas_mes_mes_key;
ALTER TABLE metas_mes ADD CONSTRAINT metas_mes_director_mes_key UNIQUE (director_id, mes);

-- 4. clientes_cartera: cartera por director
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_cartera_director ON clientes_cartera(director_id);

-- 5. reglas_comision: reglas por director
ALTER TABLE reglas_comision ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_reglas_director ON reglas_comision(director_id);

-- 6. ventas: ventas por director
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_ventas_director ON ventas(director_id);

-- 7. transacciones: transacciones por director (necesario para egresos manuales sin cliente)
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_transacciones_director ON transacciones(director_id);

-- ============================================================
-- UPDATE RLS POLICIES: Director solo ve lo suyo
-- ============================================================

-- profiles: director ve solo su equipo + a sí mismo
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_own_team" ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR director_id = auth.uid()
    OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'director' AND director_id = auth.uid()
  );

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own_or_team" ON profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR director_id = auth.uid()
  );

-- reportes_setter: setter ve propio, director ve de su equipo
DROP POLICY IF EXISTS "setter_read_own_or_director" ON reportes_setter;
CREATE POLICY "setter_read_own_or_director" ON reportes_setter FOR SELECT
  USING (
    setter_id = auth.uid()
    OR setter_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

DROP POLICY IF EXISTS "setter_insert_own" ON reportes_setter;
CREATE POLICY "setter_insert_own" ON reportes_setter FOR INSERT
  WITH CHECK (setter_id = auth.uid());

DROP POLICY IF EXISTS "setter_update_own_or_director" ON reportes_setter;
CREATE POLICY "setter_update_own_or_director" ON reportes_setter FOR UPDATE
  USING (
    setter_id = auth.uid()
    OR setter_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

-- reportes_closer: closer ve propio, director ve de su equipo
DROP POLICY IF EXISTS "closer_read_own_or_director" ON reportes_closer;
CREATE POLICY "closer_read_own_or_director" ON reportes_closer FOR SELECT
  USING (
    closer_id = auth.uid()
    OR closer_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

DROP POLICY IF EXISTS "closer_insert_own" ON reportes_closer;
CREATE POLICY "closer_insert_own" ON reportes_closer FOR INSERT
  WITH CHECK (closer_id = auth.uid());

DROP POLICY IF EXISTS "closer_update_own_or_director" ON reportes_closer;
CREATE POLICY "closer_update_own_or_director" ON reportes_closer FOR UPDATE
  USING (
    closer_id = auth.uid()
    OR closer_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

-- proyectos: director ve solo sus proyectos, miembros ven proyectos donde participan
DROP POLICY IF EXISTS "proyectos_read" ON proyectos;
CREATE POLICY "proyectos_read_own" ON proyectos FOR SELECT
  USING (
    director_id = auth.uid()
    OR id IN (SELECT proyecto_id FROM proyecto_miembros WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "proyectos_insert" ON proyectos;
CREATE POLICY "proyectos_insert_director" ON proyectos FOR INSERT
  WITH CHECK (director_id = auth.uid());

DROP POLICY IF EXISTS "proyectos_update" ON proyectos;
CREATE POLICY "proyectos_update_director" ON proyectos FOR UPDATE
  USING (director_id = auth.uid());

-- clientes_cartera: director ve su cartera
DROP POLICY IF EXISTS "cartera_select" ON clientes_cartera;
CREATE POLICY "cartera_select_own" ON clientes_cartera FOR SELECT
  USING (
    director_id = auth.uid()
    OR closer_id = auth.uid()
    OR setter_id = auth.uid()
  );

DROP POLICY IF EXISTS "cartera_insert" ON clientes_cartera;
CREATE POLICY "cartera_insert_director" ON clientes_cartera FOR INSERT
  WITH CHECK (director_id = auth.uid());

DROP POLICY IF EXISTS "cartera_update" ON clientes_cartera;
CREATE POLICY "cartera_update_director" ON clientes_cartera FOR UPDATE
  USING (director_id = auth.uid());

DROP POLICY IF EXISTS "cartera_delete" ON clientes_cartera;
CREATE POLICY "cartera_delete_director" ON clientes_cartera FOR DELETE
  USING (director_id = auth.uid());

-- metas_mes: cada director ve solo sus metas
DROP POLICY IF EXISTS "metas_select" ON metas_mes;
CREATE POLICY "metas_select_own" ON metas_mes FOR SELECT
  USING (director_id = auth.uid());

DROP POLICY IF EXISTS "metas_insert" ON metas_mes;
CREATE POLICY "metas_insert_own" ON metas_mes FOR INSERT
  WITH CHECK (director_id = auth.uid());

DROP POLICY IF EXISTS "metas_update" ON metas_mes;
CREATE POLICY "metas_update_own" ON metas_mes FOR UPDATE
  USING (director_id = auth.uid());

-- reglas_comision: cada director ve solo sus reglas
DROP POLICY IF EXISTS "reglas_select" ON reglas_comision;
CREATE POLICY "reglas_select_own" ON reglas_comision FOR SELECT
  USING (director_id = auth.uid());

DROP POLICY IF EXISTS "reglas_insert" ON reglas_comision;
CREATE POLICY "reglas_insert_own" ON reglas_comision FOR INSERT
  WITH CHECK (director_id = auth.uid());

DROP POLICY IF EXISTS "reglas_update" ON reglas_comision;
CREATE POLICY "reglas_update_own" ON reglas_comision FOR UPDATE
  USING (director_id = auth.uid());

DROP POLICY IF EXISTS "reglas_delete" ON reglas_comision;
CREATE POLICY "reglas_delete_own" ON reglas_comision FOR DELETE
  USING (director_id = auth.uid());

-- ventas: director ve ventas de su equipo
DROP POLICY IF EXISTS "ventas_select" ON ventas;
CREATE POLICY "ventas_select_own" ON ventas FOR SELECT
  USING (
    director_id = auth.uid()
    OR closer_id = auth.uid()
    OR setter_id = auth.uid()
  );

-- liquidaciones: director ve de su equipo
DROP POLICY IF EXISTS "liquidaciones_select" ON liquidaciones;
CREATE POLICY "liquidaciones_select_own" ON liquidaciones FOR SELECT
  USING (
    usuario_id = auth.uid()
    OR usuario_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

-- comisiones_pendientes: director ve de su equipo
DROP POLICY IF EXISTS "comisiones_pendientes_select" ON comisiones_pendientes;
CREATE POLICY "comisiones_pendientes_select_own" ON comisiones_pendientes FOR SELECT
  USING (
    usuario_id = auth.uid()
    OR usuario_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

-- audio_notas: director ve las de su equipo
DROP POLICY IF EXISTS "audio_notas_select" ON audio_notas;
CREATE POLICY "audio_notas_select_own" ON audio_notas FOR SELECT
  USING (
    usuario_id = auth.uid()
    OR usuario_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

-- transacciones: director ve las de su equipo/clientes
DROP POLICY IF EXISTS "transacciones_select" ON transacciones;
CREATE POLICY "transacciones_select_own" ON transacciones FOR SELECT
  USING (
    director_id = auth.uid()
    OR cliente_id IN (SELECT id FROM clientes_cartera WHERE director_id = auth.uid())
  );

DROP POLICY IF EXISTS "transacciones_insert" ON transacciones;
CREATE POLICY "transacciones_insert_own" ON transacciones FOR INSERT
  WITH CHECK (director_id = auth.uid());

DROP POLICY IF EXISTS "transacciones_delete" ON transacciones;
CREATE POLICY "transacciones_delete_own" ON transacciones FOR DELETE
  USING (director_id = auth.uid());

-- cuotas: director ve cuotas de sus clientes
DROP POLICY IF EXISTS "cuotas_select" ON cuotas;
CREATE POLICY "cuotas_select_own" ON cuotas FOR SELECT
  USING (
    cliente_id IN (SELECT id FROM clientes_cartera WHERE director_id = auth.uid())
    OR cliente_id IN (SELECT id FROM clientes_cartera WHERE closer_id = auth.uid() OR setter_id = auth.uid())
  );

-- liquidaciones: director puede hacer CRUD de liquidaciones de su equipo
DROP POLICY IF EXISTS "liquidaciones_insert" ON liquidaciones;
CREATE POLICY "liquidaciones_insert_own" ON liquidaciones FOR INSERT
  WITH CHECK (
    usuario_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

DROP POLICY IF EXISTS "liquidaciones_update" ON liquidaciones;
CREATE POLICY "liquidaciones_update_own" ON liquidaciones FOR UPDATE
  USING (
    usuario_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );

DROP POLICY IF EXISTS "liquidaciones_delete" ON liquidaciones;
CREATE POLICY "liquidaciones_delete_own" ON liquidaciones FOR DELETE
  USING (
    usuario_id IN (SELECT id FROM profiles WHERE director_id = auth.uid())
  );
