-- ═══════════════════════════════════════════════════════════════════
-- 009: COMISIONES AVANZADAS — diferidas, reasignaciones, escalonadas,
--      auditoría, distribución, categorías de cartera vencida
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. COMISIONES DIFERIDAS ─────────────────────────────────────
-- Cada cuota cobrada genera un registro aquí con 7 días de garantía.
-- Pasado el período → 'disponible'. Si hay charge-back → 'revertida'.
CREATE TABLE IF NOT EXISTS comisiones_pendientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuota_id UUID REFERENCES cuotas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  rol TEXT NOT NULL CHECK (rol IN ('closer','setter','director')),
  monto_base NUMERIC NOT NULL DEFAULT 0,
  porcentaje_aplicado NUMERIC NOT NULL DEFAULT 0,
  monto_comision NUMERIC NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','disponible','revertida','liquidada')),
  disponible_en TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  revertida_en TIMESTAMPTZ,
  liquidada_en TIMESTAMPTZ,
  liquidacion_id UUID REFERENCES liquidaciones(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comisiones_pendientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comisiones_pendientes_director" ON comisiones_pendientes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
  );

-- ─── 2. REASIGNACIONES (trazabilidad) ───────────────────────────
CREATE TABLE IF NOT EXISTS reasignaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes_cartera(id) ON DELETE CASCADE,
  campo TEXT NOT NULL CHECK (campo IN ('closer_id','setter_id')),
  usuario_anterior UUID REFERENCES auth.users(id),
  usuario_nuevo UUID REFERENCES auth.users(id),
  razon TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (razon IN ('MANUAL','REORG','USER_LEFT')),
  notas TEXT,
  -- Cuotas afectadas: futuras pasan al nuevo, en garantía se quedan con anterior
  cuotas_reasignadas INT DEFAULT 0,
  cuotas_en_garantia INT DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  creado_por UUID REFERENCES auth.users(id)
);

ALTER TABLE reasignaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reasignaciones_director" ON reasignaciones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
  );

-- ─── 3. AJUSTES DE COMISIÓN (post-pago) ─────────────────────────
-- Cuando se edita el monto de una cuota ya pagada, se genera un ajuste
-- que se aplica en la siguiente liquidación (nunca se reabre la anterior).
CREATE TABLE IF NOT EXISTS ajustes_comision (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuota_id UUID REFERENCES cuotas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  monto_anterior NUMERIC NOT NULL,
  monto_nuevo NUMERIC NOT NULL,
  delta_comision NUMERIC NOT NULL,
  aplicado BOOLEAN DEFAULT FALSE,
  liquidacion_id UUID REFERENCES liquidaciones(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ajustes_comision ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ajustes_comision_director" ON ajustes_comision
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
  );

-- ─── 4. REGLAS DE COMISIÓN ESCALONADAS ──────────────────────────
-- El director define tramos: "0-50k → 5%, 50-100k → 7%, 100k+ → 10%"
CREATE TABLE IF NOT EXISTS reglas_comision (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('closer','setter')),
  tramos JSONB NOT NULL DEFAULT '[]',
  -- tramos = [{ "desde": 0, "hasta": 50000, "porcentaje": 5 }, ...]
  activa BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reglas_comision ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reglas_comision_director" ON reglas_comision
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
  );

-- Snapshot de regla aplicada al generar liquidación
ALTER TABLE liquidaciones
  ADD COLUMN IF NOT EXISTS regla_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS total_facturado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reembolsado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ajustes_aplicados NUMERIC DEFAULT 0;

-- ─── 5. DISTRIBUCIÓN POR BOLSILLOS ─────────────────────────────
-- Para cada cuota cobrada, se calcula a dónde va cada centavo.
CREATE TABLE IF NOT EXISTS distribucion_pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuota_id UUID REFERENCES cuotas(id) ON DELETE CASCADE,
  transaccion_id UUID REFERENCES transacciones(id) ON DELETE SET NULL,
  monto_bruto NUMERIC NOT NULL DEFAULT 0,
  comision_closer NUMERIC NOT NULL DEFAULT 0,
  comision_setter NUMERIC NOT NULL DEFAULT 0,
  costos_ads NUMERIC NOT NULL DEFAULT 0,
  costos_operativos NUMERIC NOT NULL DEFAULT 0,
  ganancia_empresa NUMERIC NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE distribucion_pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "distribucion_pagos_director" ON distribucion_pagos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
  );

-- ─── 6. CARTERA VENCIDA: categorías ─────────────────────────────
-- Agregar columna de categoría de vencimiento a cuotas
ALTER TABLE cuotas
  ADD COLUMN IF NOT EXISTS categoria_vencimiento TEXT DEFAULT NULL
    CHECK (categoria_vencimiento IS NULL OR categoria_vencimiento IN ('ligera','pesada','default')),
  ADD COLUMN IF NOT EXISTS comision_retenida BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dias_vencida INT DEFAULT 0;

-- ─── 7. AUDITORÍA ───────────────────────────────────────────────
-- Tabla genérica para audit trail de operaciones financieras
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id UUID NOT NULL,
  accion TEXT NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_id UUID,
  ip TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_director" ON audit_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
  );

-- ─── 8. FUNCIÓN: Categorizar cuotas vencidas ────────────────────
CREATE OR REPLACE FUNCTION categorizar_cuotas_vencidas()
RETURNS void AS $$
BEGIN
  -- Actualizar dias_vencida para cuotas vencidas
  UPDATE cuotas
  SET dias_vencida = EXTRACT(DAY FROM NOW() - fecha_vencimiento)::int
  WHERE estado = 'vencida';

  -- Ligera: 1-7 días
  UPDATE cuotas
  SET categoria_vencimiento = 'ligera', comision_retenida = false
  WHERE estado = 'vencida' AND dias_vencida BETWEEN 1 AND 7;

  -- Pesada: 8-30 días → retener comisión del closer
  UPDATE cuotas
  SET categoria_vencimiento = 'pesada', comision_retenida = true
  WHERE estado = 'vencida' AND dias_vencida BETWEEN 8 AND 30;

  -- Default: >30 días → caso de cobranza, sin comisión
  UPDATE cuotas
  SET categoria_vencimiento = 'default', comision_retenida = true
  WHERE estado = 'vencida' AND dias_vencida > 30;
END;
$$ LANGUAGE plpgsql;

-- ─── 9. FUNCIÓN: Liberar comisiones diferidas ───────────────────
CREATE OR REPLACE FUNCTION liberar_comisiones_disponibles()
RETURNS void AS $$
BEGIN
  UPDATE comisiones_pendientes
  SET estado = 'disponible'
  WHERE estado = 'pendiente'
    AND disponible_en <= NOW();
END;
$$ LANGUAGE plpgsql;

-- ─── 10. FUNCIÓN: Revertir comisiones por charge-back ───────────
CREATE OR REPLACE FUNCTION revertir_comision_cuota(p_cuota_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE comisiones_pendientes
  SET estado = 'revertida', revertida_en = NOW()
  WHERE cuota_id = p_cuota_id
    AND estado IN ('pendiente', 'disponible');
END;
$$ LANGUAGE plpgsql;

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_comisiones_pend_estado ON comisiones_pendientes(estado);
CREATE INDEX IF NOT EXISTS idx_comisiones_pend_usuario ON comisiones_pendientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_pend_disponible ON comisiones_pendientes(disponible_en);
CREATE INDEX IF NOT EXISTS idx_reasignaciones_cliente ON reasignaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_comision_cuota ON ajustes_comision(cuota_id);
CREATE INDEX IF NOT EXISTS idx_distribucion_cuota ON distribucion_pagos(cuota_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabla ON audit_log(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_categoria ON cuotas(categoria_vencimiento) WHERE categoria_vencimiento IS NOT NULL;
