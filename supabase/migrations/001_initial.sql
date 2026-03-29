-- Enable RLS
create table if not exists profiles (
  id uuid references auth.users primary key,
  nombre text,
  rol text check (rol in ('setter', 'closer', 'director')),
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists reportes_setter (
  id uuid primary key default gen_random_uuid(),
  setter_id uuid references profiles(id),
  fecha date default current_date,
  leads_recibidos integer default 0,
  intentos_contacto integer default 0,
  contactados integer default 0,
  citas_agendadas integer default 0,
  citas_show integer default 0,
  citas_noshow integer default 0,
  citas_reprogramadas integer default 0,
  citas_calificadas integer default 0,
  motivos_noshow text,
  comentario text,
  enviado_at timestamptz default now(),
  unique(setter_id, fecha)
);

create table if not exists reportes_closer (
  id uuid primary key default gen_random_uuid(),
  closer_id uuid references profiles(id),
  fecha date default current_date,
  citas_recibidas integer default 0,
  citas_show integer default 0,
  citas_noshow integer default 0,
  ventas_cerradas integer default 0,
  ventas_no_cerradas integer default 0,
  pagos_completos integer default 0,
  pagos_parciales integer default 0,
  pagos_nulo integer default 0,
  monto_total_cerrado numeric(12,2) default 0,
  monto_cobrado numeric(12,2) default 0,
  monto_pendiente numeric(12,2) default 0,
  detalle_ventas jsonb default '[]',
  motivo_precio integer default 0,
  motivo_consultar integer default 0,
  motivo_momento integer default 0,
  motivo_competencia integer default 0,
  motivo_otro integer default 0,
  ticket_promedio numeric(12,2),
  comentario text,
  enviado_at timestamptz default now(),
  unique(closer_id, fecha)
);

create table if not exists configuracion_comisiones (
  id uuid primary key default gen_random_uuid(),
  rol text,
  concepto text,
  valor numeric,
  tipo text check (tipo in ('fijo', 'porcentaje')),
  condicion text,
  activo boolean default true
);

-- RLS Policies
alter table profiles enable row level security;
alter table reportes_setter enable row level security;
alter table reportes_closer enable row level security;

create policy "profiles_read_all" on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_director" on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);

create policy "setter_own_reports" on reportes_setter for all using (
  setter_id = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);

create policy "closer_own_reports" on reportes_closer for all using (
  closer_id = auth.uid() or
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);

-- Default commission config
insert into configuracion_comisiones (rol, concepto, valor, tipo, condicion) values
('setter', 'cita_show_calificada', 25, 'fijo', 'por cita show calificada'),
('setter', 'venta_cerrada', 75, 'fijo', 'por cada venta cerrada de sus citas'),
('setter', 'base_mensual', 500, 'fijo', 'base fija mensual'),
('closer', 'comision_cobrado', 8, 'porcentaje', 'sobre monto cobrado'),
('closer', 'bonus_cierre', 500, 'fijo', 'tasa cierre >= 40% en el mes'),
('closer', 'penalidad_impago', 50, 'porcentaje', 'penalidad en ventas sin cobrar 30 dias')
on conflict do nothing;
