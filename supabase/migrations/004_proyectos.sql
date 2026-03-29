-- Tabla de proyectos
create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  empresa text,
  descripcion text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Miembros de proyectos (un user puede estar en varios proyectos)
create table if not exists proyecto_miembros (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references proyectos(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  rol text check (rol in ('setter', 'closer')),
  activo boolean default true,
  created_at timestamptz default now(),
  unique(proyecto_id, user_id)
);

-- Comisiones por proyecto (editables por el director)
create table if not exists comisiones_proyecto (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references proyectos(id) on delete cascade,
  -- Setter
  setter_base_mensual numeric(12,2) default 500,
  setter_por_cita_show_calificada numeric(12,2) default 25,
  setter_por_venta_cerrada numeric(12,2) default 75,
  -- Closer
  closer_comision_porcentaje numeric(5,2) default 8,
  closer_bonus_cierre numeric(12,2) default 500,
  closer_bonus_tasa_minima numeric(5,2) default 40,
  closer_penalidad_impago_porcentaje numeric(5,2) default 50,
  closer_dias_penalidad integer default 30,
  updated_at timestamptz default now(),
  unique(proyecto_id)
);

-- Agregar proyecto_id a reportes
alter table reportes_setter add column if not exists proyecto_id uuid references proyectos(id);
alter table reportes_closer add column if not exists proyecto_id uuid references proyectos(id);

-- RLS
alter table proyectos enable row level security;
alter table proyecto_miembros enable row level security;
alter table comisiones_proyecto enable row level security;

create policy "proyectos_read" on proyectos for select using (true);
create policy "proyectos_director" on proyectos for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);

create policy "miembros_read" on proyecto_miembros for select using (true);
create policy "miembros_director" on proyecto_miembros for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);

create policy "comisiones_read" on comisiones_proyecto for select using (true);
create policy "comisiones_director" on comisiones_proyecto for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
