-- Adjuntos de tareas
CREATE TABLE IF NOT EXISTS tarea_adjuntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  director_id UUID NOT NULL REFERENCES auth.users(id),
  nombre TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamano_bytes INT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tarea_adjuntos_tarea ON tarea_adjuntos(tarea_id);

ALTER TABLE tarea_adjuntos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adjuntos_select" ON tarea_adjuntos FOR SELECT
  USING (director_id = auth.uid());

CREATE POLICY "adjuntos_insert" ON tarea_adjuntos FOR INSERT
  WITH CHECK (director_id = auth.uid());

CREATE POLICY "adjuntos_delete" ON tarea_adjuntos FOR DELETE
  USING (director_id = auth.uid());

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tarea-adjuntos',
  'tarea-adjuntos',
  true,
  10485760, -- 10MB
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "adjuntos_storage_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tarea-adjuntos' AND auth.uid() IS NOT NULL);

CREATE POLICY "adjuntos_storage_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'tarea-adjuntos');

CREATE POLICY "adjuntos_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'tarea-adjuntos' AND auth.uid() IS NOT NULL);
