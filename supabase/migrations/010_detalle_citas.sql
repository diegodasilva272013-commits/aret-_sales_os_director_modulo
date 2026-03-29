-- Add detalle_citas JSONB column to reportes_setter
-- Stores agenda details: [{ nombre_lead, horario, comentario }]
alter table reportes_setter add column if not exists detalle_citas jsonb default '[]';
