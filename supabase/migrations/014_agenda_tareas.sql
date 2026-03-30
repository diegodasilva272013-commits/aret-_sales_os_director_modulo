-- ============================================
-- 014: Agenda del Director - Tareas y Reuniones
-- ============================================

-- Tareas / Recordatorios
CREATE TABLE IF NOT EXISTS tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id uuid NOT NULL REFERENCES profiles(id),
  titulo text NOT NULL,
  descripcion text,
  fecha date NOT NULL DEFAULT current_date,
  hora_inicio time,
  hora_fin time,
  tipo text NOT NULL DEFAULT 'tarea' CHECK (tipo IN ('tarea', 'reunion', 'recordatorio', 'llamada')),
  prioridad text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'pospuesta', 'cancelada')),
  -- Reuniones: participantes del equipo
  participantes_ids uuid[] DEFAULT '{}',
  -- Reuniones: enlace externo (Calendly, Google Meet, Zoom)
  enlace_reunion text,
  -- Recurrencia
  recurrente boolean DEFAULT false,
  recurrencia_tipo text CHECK (recurrencia_tipo IN ('diaria', 'semanal', 'mensual')),
  recurrencia_fin date,
  -- Posponer
  fecha_original date,
  veces_pospuesta integer DEFAULT 0,
  -- Notas
  notas text,
  -- Google Calendar sync
  google_event_id text,
  -- Timestamps
  completada_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_tareas_director_fecha ON tareas(director_id, fecha);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(director_id, estado);
CREATE INDEX IF NOT EXISTS idx_tareas_tipo ON tareas(director_id, tipo);

-- RLS
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tareas_director_all" ON tareas
  FOR ALL USING (director_id = auth.uid())
  WITH CHECK (director_id = auth.uid());

-- Configuración de calendario del director
CREATE TABLE IF NOT EXISTS calendario_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id uuid NOT NULL UNIQUE REFERENCES profiles(id),
  google_calendar_connected boolean DEFAULT false,
  google_refresh_token text,
  google_calendar_id text,
  calendly_url text,
  zona_horaria text DEFAULT 'America/Argentina/Buenos_Aires',
  vista_default text DEFAULT 'semana' CHECK (vista_default IN ('dia', 'semana', 'mes')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calendario_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cal_config_director" ON calendario_config
  FOR ALL USING (director_id = auth.uid())
  WITH CHECK (director_id = auth.uid());
