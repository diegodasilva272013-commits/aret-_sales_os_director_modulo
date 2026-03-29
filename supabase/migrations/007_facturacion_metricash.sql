-- =============================================
-- MÓDULO FACTURACIÓN Y COMISIONES (Metricash)
-- =============================================

-- 1. Metas mensuales
create table if not exists metas_mes (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique, -- primer día del mes, ej: 2026-03-01
  meta_objetivo numeric(14,2) not null default 0,
  facturacion_alcanzada numeric(14,2) not null default 0,
  costos_ads numeric(14,2) not null default 0,
  costos_operativos numeric(14,2) not null default 0,
  creado_en timestamptz default now()
);

-- 2. Cartera de clientes
create table if not exists clientes_cartera (
  id uuid primary key default gen_random_uuid(),
  nombre_cliente text not null,
  documento text,
  closer_id uuid references profiles(id),
  setter_id uuid references profiles(id),
  monto_referencia numeric(14,2) not null default 0,
  estado text check (estado in ('activo', 'vencido', 'pagado')) default 'activo',
  notas text,
  creado_en timestamptz default now()
);

-- 3. Cuotas por cliente
create table if not exists cuotas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes_cartera(id) on delete cascade,
  numero_cuota integer not null,
  monto numeric(14,2) not null,
  fecha_vencimiento date not null,
  fecha_pago date,
  estado text check (estado in ('pendiente', 'pagada', 'vencida')) default 'pendiente',
  comprobante_url text,
  creado_en timestamptz default now()
);

-- 4. Transacciones
create table if not exists transacciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes_cartera(id) on delete set null,
  cuota_id uuid references cuotas(id) on delete set null,
  monto numeric(14,2) not null,
  fecha timestamptz default now(),
  tipo text check (tipo in ('ingreso', 'egreso')) not null,
  descripcion text,
  creado_en timestamptz default now()
);

-- 5. Liquidaciones de comisiones
create table if not exists liquidaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references profiles(id),
  fecha_desde date not null,
  fecha_hasta date not null,
  total_comision numeric(14,2) not null default 0,
  detalle jsonb default '[]',
  generado_en timestamptz default now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

alter table metas_mes enable row level security;
alter table clientes_cartera enable row level security;
alter table cuotas enable row level security;
alter table transacciones enable row level security;
alter table liquidaciones enable row level security;

-- Metas: solo director lee y escribe
create policy "metas_read" on metas_mes for select using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
create policy "metas_write" on metas_mes for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);

-- Clientes cartera: director lee/escribe, closers y setters leen los suyos
create policy "cartera_director" on clientes_cartera for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
create policy "cartera_read_own" on clientes_cartera for select using (
  closer_id = auth.uid() or setter_id = auth.uid()
);

-- Cuotas: director lee/escribe, closers/setters leen las de sus clientes
create policy "cuotas_director" on cuotas for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
create policy "cuotas_read_own" on cuotas for select using (
  exists (
    select 1 from clientes_cartera
    where clientes_cartera.id = cuotas.cliente_id
    and (clientes_cartera.closer_id = auth.uid() or clientes_cartera.setter_id = auth.uid())
  )
);

-- Transacciones: director lee/escribe
create policy "transacciones_director" on transacciones for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
create policy "transacciones_read_own" on transacciones for select using (
  exists (
    select 1 from clientes_cartera
    where clientes_cartera.id = transacciones.cliente_id
    and (clientes_cartera.closer_id = auth.uid() or clientes_cartera.setter_id = auth.uid())
  )
);

-- Liquidaciones: director puede todo, usuarios leen las propias
create policy "liquidaciones_director" on liquidaciones for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'director')
);
create policy "liquidaciones_read_own" on liquidaciones for select using (
  usuario_id = auth.uid()
);

-- =============================================
-- Storage bucket para comprobantes (ejecutar desde Supabase Dashboard si no existe)
-- insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', true);
-- =============================================
