-- =============================================
-- 008: Correcciones Metricash — Reembolsos, Parciales, Campañas, Estado Liquidaciones
-- =============================================

-- 1. Transacciones: agregar tipo 'reembolso'
ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_tipo_check;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_tipo_check
  CHECK (tipo IN ('ingreso', 'egreso', 'reembolso'));

-- 2. Cuotas: agregar soporte de pagos parciales
ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS monto_pagado numeric(14,2) NOT NULL DEFAULT 0;

-- 3. Clientes cartera: agregar tracking de campaña/canal/fuente
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS fuente text;
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS campana text;
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS canal text;

-- 4. Liquidaciones: agregar estado de pago
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS estado text
  CHECK (estado IN ('pendiente', 'pagada')) DEFAULT 'pendiente';

-- 5. Función para auto-marcar cuotas vencidas (ejecutar periódicamente o en cada consulta)
CREATE OR REPLACE FUNCTION marcar_cuotas_vencidas()
RETURNS void AS $$
BEGIN
  -- Marcar cuotas cuyo vencimiento ya pasó
  UPDATE cuotas
  SET estado = 'vencida'
  WHERE estado = 'pendiente'
    AND fecha_vencimiento < CURRENT_DATE;

  -- Marcar clientes con cuotas vencidas
  UPDATE clientes_cartera
  SET estado = 'vencido'
  WHERE estado = 'activo'
    AND id IN (
      SELECT DISTINCT cliente_id FROM cuotas WHERE estado = 'vencida'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger: auto-vencimiento al consultar (cron alternativo)
-- Se puede llamar desde la API antes de cada consulta de cartera/cuotas
