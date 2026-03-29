-- =============================================
-- 011: Brief expansion + Audio Notes system
-- SAFE: Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- Run in Supabase SQL Editor: https://supabase.com/dashboard
-- =============================================

-- 1. New brief columns (campos faltantes)
ALTER TABLE project_briefs ADD COLUMN IF NOT EXISTS diferenciadores text;
ALTER TABLE project_briefs ADD COLUMN IF NOT EXISTS motivos_compra text;
ALTER TABLE project_briefs ADD COLUMN IF NOT EXISTS oferta text;
ALTER TABLE project_briefs ADD COLUMN IF NOT EXISTS observaciones_estrategicas text;
ALTER TABLE project_briefs ADD COLUMN IF NOT EXISTS videos text;
ALTER TABLE project_briefs ADD COLUMN IF NOT EXISTS links_importantes text;
ALTER TABLE project_briefs ADD COLUMN IF NOT EXISTS publico_objetivo text;

-- 2. Tabla de notas de audio (genérica, reutilizable para cualquier entidad)
CREATE TABLE IF NOT EXISTS audio_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_tipo text NOT NULL CHECK (entidad_tipo IN ('proyecto', 'cliente', 'venta', 'brief', 'transaccion', 'cartera', 'general')),
  entidad_id uuid,
  audio_url text NOT NULL,
  duracion_segundos integer,
  transcripcion text,
  titulo text,
  usuario_id uuid REFERENCES profiles(id) NOT NULL,
  creado_en timestamptz DEFAULT now(),
  actualizado_en timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audio_notas_entidad ON audio_notas(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_audio_notas_usuario ON audio_notas(usuario_id);

ALTER TABLE audio_notas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "audio_director_full" ON audio_notas;
  DROP POLICY IF EXISTS "audio_own_read" ON audio_notas;
  DROP POLICY IF EXISTS "audio_own_insert" ON audio_notas;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "audio_director_full" ON audio_notas FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director')
);
CREATE POLICY "audio_own_read" ON audio_notas FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "audio_own_insert" ON audio_notas FOR INSERT WITH CHECK (usuario_id = auth.uid());

-- 3. Storage bucket para audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audio-notas', 'audio-notas', false, 52428800, ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "audio_auth_upload" ON storage.objects;
  DROP POLICY IF EXISTS "audio_auth_read" ON storage.objects;
  DROP POLICY IF EXISTS "audio_director_delete" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "audio_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-notas' AND auth.role() = 'authenticated');
CREATE POLICY "audio_auth_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-notas' AND auth.role() = 'authenticated');
CREATE POLICY "audio_director_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'audio-notas' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'director'));
