-- Extended profiles
alter table profiles add column if not exists apellido text;
alter table profiles add column if not exists telefono text;
alter table profiles add column if not exists foto_url text;
alter table profiles add column if not exists horario_inicio time default '09:00';
alter table profiles add column if not exists horario_fin time default '18:00';
alter table profiles add column if not exists dias_trabajo text[] default '{lunes,martes,miercoles,jueves,viernes}';
alter table profiles add column if not exists notas text;

-- Payment methods for commissions
create table if not exists metodos_pago (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  tipo text check (tipo in ('cbu', 'alias', 'paypal', 'usdt', 'transferencia', 'otro')),
  datos text not null,
  titular text,
  principal boolean default false,
  created_at timestamptz default now()
);

alter table metodos_pago enable row level security;
create policy "metodos_pago_director" on metodos_pago for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
create policy "metodos_pago_own" on metodos_pago for select using (user_id = auth.uid());

-- Project briefs
create table if not exists project_briefs (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references proyectos(id) on delete cascade unique,
  -- Producto/Servicio
  nombre_producto text,
  descripcion_producto text,
  precio_desde numeric(12,2),
  precio_hasta numeric(12,2),
  -- Online presence
  pagina_web text,
  instagram text,
  facebook text,
  youtube text,
  linkedin text,
  tiktok text,
  -- Avatar
  avatar_nombre text,
  avatar_edad_rango text,
  avatar_ocupacion text,
  avatar_dolores text,
  avatar_deseos text,
  avatar_objeciones text,
  -- Experto
  experto_nombre text,
  experto_bio text,
  experto_logros text,
  experto_foto_url text,
  -- Sales content
  mensajes_apertura text,
  preguntas_frecuentes text,
  argumentos_cierre text,
  manejo_objeciones text,
  -- Proceso de venta
  proceso_setter text,
  proceso_closer text,
  -- Extra
  notas_adicionales text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table project_briefs enable row level security;
create policy "briefs_read_members" on project_briefs for select using (
  exists (
    select 1 from proyecto_miembros where proyecto_id = project_briefs.proyecto_id and user_id = auth.uid()
  ) or exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
create policy "briefs_director" on project_briefs for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
create policy "briefs_public_read" on project_briefs for select using (true);
