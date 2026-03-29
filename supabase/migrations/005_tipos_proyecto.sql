-- Tipo de proyecto
alter table proyectos add column if not exists tipo text check (tipo in ('evergreen', 'lanzamiento')) default 'evergreen';

-- Asistencia a reuniones (campo en reportes diarios)
alter table reportes_setter add column if not exists asistio_reunion boolean default false;
alter table reportes_setter add column if not exists nota_reunion text;
alter table reportes_closer add column if not exists asistio_reunion boolean default false;
alter table reportes_closer add column if not exists nota_reunion text;

-- Métricas de lanzamiento para SETTER (mensajes/texto)
alter table reportes_setter add column if not exists tipo_proyecto text default 'evergreen';
-- Métricas extra setter lanzamiento:
alter table reportes_setter add column if not exists mensajes_enviados integer default 0;
alter table reportes_setter add column if not exists respuestas_obtenidas integer default 0;
alter table reportes_setter add column if not exists conversaciones_activas integer default 0;
alter table reportes_setter add column if not exists leads_calificados_chat integer default 0;
alter table reportes_setter add column if not exists llamadas_agendadas_dm integer default 0;

-- Métricas extra closer lanzamiento:
alter table reportes_closer add column if not exists tipo_proyecto text default 'evergreen';
alter table reportes_closer add column if not exists propuestas_enviadas integer default 0;
alter table reportes_closer add column if not exists seguimientos_realizados integer default 0;
alter table reportes_closer add column if not exists conversaciones_cerradas integer default 0;
alter table reportes_closer add column if not exists tiempo_respuesta_avg integer default 0; -- en horas
alter table reportes_closer add column if not exists objeciones_resueltas integer default 0;
