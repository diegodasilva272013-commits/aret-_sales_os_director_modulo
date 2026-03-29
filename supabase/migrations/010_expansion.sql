-- =============================================
-- 010: Ampliación — Ventas formales, Comprobantes, Audio Notas, Roles, Medios de pago
-- ADDITIVE ONLY: No elimina columnas ni tablas existentes
-- =============================================

-- 1. Ampliar roles disponibles (sin romper los existentes)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('setter', 'closer', 'director', 'lider_ventas', 'cold_caller', 'trasher'));

-- 2. Tabla de ventas formales (registradas desde formularios diarios)
CREATE TABLE IF NOT EXISTS ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT current_date,
  proyecto_id uuid REFERENCES proyectos(id),
  closer_id uuid REFERENCES profiles(id),
  setter_id uuid REFERENCES profiles(id),
  -- Cliente (puede ser nuevo o existente)
  cliente_nombre text NOT NULL,
  cliente_documento text,
  cliente_id uuid REFERENCES clientes_cartera(id),
  -- Detalles de la venta
  producto text,
  monto numeric(14,2) NOT NULL,
  medio_pago text CHECK (medio_pago IN ('hotmart', 'paypal', 'transferencia', 'stripe', 'mercadopago', 'efectivo', 'crypto', 'otro')),
  tipo_pago text CHECK (tipo_pago IN ('contado', 'cuotas')) DEFAULT 'contado',
  cantidad_cuotas integer DEFAULT 1,
  observaciones text,
  -- Comprobante
  comprobante_url text,
  comprobante_validado boolean DEFAULT false,
  validado_por uuid REFERENCES profiles(id),
  validado_en timestamptz,
  -- Estado
  estado text CHECK (estado IN ('pendiente_comprobante', 'pendiente_validacion', 'validada', 'rechazada')) DEFAULT 'pendiente_comprobante',
  -- Trazabilidad
  reporte_closer_id uuid REFERENCES reportes_closer(id),
  reporte_setter_id uuid REFERENCES reportes_setter(id),
  creado_en timestamptz DEFAULT now(),
  actualizado_en timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_closer ON ventas(closer_id);
CREATE INDEX IF NOT EXISTS idx_ventas_setter ON ventas(setter_id);
CREATE INDEX IF NOT EXISTS idx_ventas_proyecto ON ventas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);

-- RLS
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ventas_director_full" ON ventas FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
);
CREATE POLICY "ventas_own_read" ON ventas FOR SELECT USING (
  closer_id = auth.uid() OR setter_id = auth.uid()
);
CREATE POLICY "ventas_own_insert" ON ventas FOR INSERT WITH CHECK (
  closer_id = auth.uid() OR setter_id = auth.uid()
);

-- 3. Tabla de notas de audio (genérica, reutilizable para cualquier entidad)
CREATE TABLE IF NOT EXISTS audio_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Entidad polimórfica
  entidad_tipo text NOT NULL CHECK (entidad_tipo IN ('proyecto', 'cliente', 'venta', 'brief', 'transaccion', 'cartera', 'general')),
  entidad_id uuid,
  -- Audio
  audio_url text NOT NULL,
  duracion_segundos integer,
  -- Transcripción
  transcripcion text,
  -- Metadata
  titulo text,
  usuario_id uuid REFERENCES profiles(id) NOT NULL,
  creado_en timestamptz DEFAULT now(),
  actualizado_en timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audio_notas_entidad ON audio_notas(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_audio_notas_usuario ON audio_notas(usuario_id);

ALTER TABLE audio_notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audio_director_full" ON audio_notas FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
);
CREATE POLICY "audio_own_read" ON audio_notas FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "audio_own_insert" ON audio_notas FOR INSERT WITH CHECK (usuario_id = auth.uid());

-- 4. Ampliar clientes_cartera con campos faltantes
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS producto text;
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS fecha_acuerdo date;
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS medio_pago text;
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS tipo_pago text CHECK (tipo_pago IN ('contado', 'cuotas')) DEFAULT 'cuotas';
ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS responsable_id uuid REFERENCES profiles(id);

-- 5. Ampliar transacciones con medio de pago
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS medio_pago text;
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS venta_id uuid REFERENCES ventas(id);

-- 6. Storage bucket para comprobantes y audio (via SQL - Supabase)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('comprobantes', 'comprobantes', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('audio-notas', 'audio-notas', false, 52428800, ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "comprobantes_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprobantes' AND auth.role() = 'authenticated');
CREATE POLICY "comprobantes_auth_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'comprobantes' AND auth.role() = 'authenticated');
CREATE POLICY "comprobantes_director_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'comprobantes' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director'));

CREATE POLICY "audio_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-notas' AND auth.role() = 'authenticated');
CREATE POLICY "audio_auth_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-notas' AND auth.role() = 'authenticated');
CREATE POLICY "audio_director_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'audio-notas' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director'));
