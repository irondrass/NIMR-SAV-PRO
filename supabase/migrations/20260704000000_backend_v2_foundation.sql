create extension if not exists pgcrypto;
create schema if not exists app;

create table if not exists public.users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null check (role in ('DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','TECHNICIEN','QC','LIVRAISON','LECTURE')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','TECHNICIEN','QC','LIVRAISON','LECTURE')),
  site text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vin text not null,
  immatriculation text not null,
  marque text not null,
  modele text not null,
  kilometrage integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dossiers (
  id uuid primary key default gen_random_uuid(),
  dossier_number text not null unique,
  client_id uuid not null references public.clients(id),
  vehicle_id uuid not null references public.vehicles(id),
  status text not null,
  qc_status text not null default 'pending',
  delivery_status text not null default 'not_ready',
  eta timestamptz,
  created_by uuid references auth.users(id),
  assigned_site text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repair_order_lines (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  label text not null,
  source text not null,
  stage text not null,
  estimated_hours numeric not null default 0,
  is_qc_line boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.technician_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null,
  active boolean not null default true,
  bay_compatibility jsonb not null default '[]'::jsonb,
  work_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_tasks (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  repair_order_line_id uuid references public.repair_order_lines(id) on delete set null,
  stage text not null,
  specialty text not null,
  status text not null default 'pending',
  assigned_resource_id uuid references public.technician_resources(id) on delete set null,
  estimated_hours numeric not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_reservations (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  resource_id uuid not null references public.technician_resources(id),
  bay_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_reservation_positive_slot check (end_at > start_at)
);

create table if not exists public.quality_controls (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  status text not null,
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  controlled_by uuid references auth.users(id),
  controlled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  status text not null,
  delivered_by uuid references auth.users(id),
  delivered_at timestamptz,
  blocking_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid references public.dossiers(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  role text not null,
  action text not null,
  category text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  category text not null,
  file_name text not null,
  mime_type text not null,
  size bigint not null,
  storage_provider text not null default 'google-drive',
  drive_file_id text,
  drive_folder_id text,
  download_status text not null default 'metadata-only',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function app.current_backend_role()
returns text
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select coalesce(
    (select role from public.users_profile where id = auth.uid() and active = true limit 1),
    ''
  );
$$;

create or replace function app.has_backend_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = role_name
      and active = true
  ) or app.current_backend_role() = role_name;
$$;

create or replace function app.has_any_backend_role(role_names text[])
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select exists (select 1 from unnest(role_names) role_name where app.has_backend_role(role_name));
$$;

create or replace function app.can_access_dossier(target_dossier_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app, pg_temp
as $$
begin
  if app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC','LIVRAISON','LECTURE']) then
    return true;
  end if;

  if app.has_backend_role('TECHNICIEN') then
    return exists (
      select 1
      from public.workshop_tasks task
      where task.dossier_id = target_dossier_id
        and task.assigned_resource_id is not null
    );
  end if;

  return false;
end;
$$;

alter table public.users_profile enable row level security;
alter table public.user_roles enable row level security;
alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.dossiers enable row level security;
alter table public.repair_order_lines enable row level security;
alter table public.workshop_tasks enable row level security;
alter table public.technician_resources enable row level security;
alter table public.workshop_reservations enable row level security;
alter table public.quality_controls enable row level security;
alter table public.deliveries enable row level security;
alter table public.audit_events enable row level security;
alter table public.file_attachments enable row level security;
alter table public.app_settings enable row level security;

create policy users_profile_select_self_or_director on public.users_profile
  for select using (id = auth.uid() or app.has_backend_role('DIRECTEUR_SAV'));
create policy users_profile_update_director on public.users_profile
  for update using (app.has_backend_role('DIRECTEUR_SAV')) with check (app.has_backend_role('DIRECTEUR_SAV'));

create policy user_roles_select_director on public.user_roles
  for select using (app.has_backend_role('DIRECTEUR_SAV'));
create policy user_roles_write_director on public.user_roles
  for all using (app.has_backend_role('DIRECTEUR_SAV')) with check (app.has_backend_role('DIRECTEUR_SAV'));

create policy clients_select_business on public.clients
  for select using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC','LIVRAISON','LECTURE']));
create policy clients_write_reception_or_director on public.clients
  for insert with check (app.has_any_backend_role(array['DIRECTEUR_SAV','RECEPTION']));
create policy clients_update_reception_or_director on public.clients
  for update using (app.has_any_backend_role(array['DIRECTEUR_SAV','RECEPTION'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','RECEPTION']));

create policy vehicles_select_business on public.vehicles
  for select using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC','LIVRAISON','LECTURE']));
create policy vehicles_write_reception_or_director on public.vehicles
  for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','RECEPTION'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','RECEPTION']));

create policy dossiers_select_by_role on public.dossiers
  for select using (app.can_access_dossier(id));
create policy dossiers_insert_reception on public.dossiers
  for insert with check (app.has_any_backend_role(array['DIRECTEUR_SAV','RECEPTION']));
create policy dossiers_update_business on public.dossiers
  for update using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION']));

create policy repair_lines_select_by_dossier on public.repair_order_lines
  for select using (app.can_access_dossier(dossier_id));
create policy repair_lines_write_workshop on public.repair_order_lines
  for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']));

create policy tasks_select_by_role on public.workshop_tasks
  for select using (app.can_access_dossier(dossier_id));
create policy tasks_write_workshop on public.workshop_tasks
  for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']));

create policy technicians_select_workshop on public.technician_resources
  for select using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','TECHNICIEN','LECTURE']));
create policy technicians_write_workshop on public.technician_resources
  for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']));

create policy reservations_select_by_dossier on public.workshop_reservations
  for select using (app.can_access_dossier(dossier_id));
create policy reservations_write_workshop on public.workshop_reservations
  for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']));

create policy qc_select_by_dossier on public.quality_controls
  for select using (app.can_access_dossier(dossier_id));
create policy qc_write_qc_role on public.quality_controls
  for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','QC'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','QC']));

create policy deliveries_select_by_dossier on public.deliveries
  for select using (app.can_access_dossier(dossier_id));
create policy deliveries_write_delivery_role on public.deliveries
  for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','LIVRAISON'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','LIVRAISON']));

create policy audit_events_select_business on public.audit_events
  for select using (app.can_access_dossier(dossier_id) or dossier_id is null);
create policy audit_events_no_frontend_insert on public.audit_events
  for insert with check (false);
create policy audit_events_no_frontend_update on public.audit_events
  for update using (false) with check (false);
create policy audit_events_no_frontend_delete on public.audit_events
  for delete using (false);

create policy file_attachments_select_by_dossier on public.file_attachments
  for select using (app.can_access_dossier(dossier_id));
create policy file_attachments_insert_authorized on public.file_attachments
  for insert with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','TECHNICIEN','QC','LIVRAISON']));
create policy file_attachments_update_metadata_authorized on public.file_attachments
  for update using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC']));

create policy app_settings_select_director on public.app_settings
  for select using (app.has_backend_role('DIRECTEUR_SAV'));
create policy app_settings_write_director on public.app_settings
  for all using (app.has_backend_role('DIRECTEUR_SAV')) with check (app.has_backend_role('DIRECTEUR_SAV'));

create or replace function app.create_audit_event(
  p_dossier_id uuid,
  p_action text,
  p_category text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  event_id uuid;
begin
  insert into public.audit_events (dossier_id, actor_id, role, action, category, details)
  values (p_dossier_id, auth.uid(), app.current_backend_role(), p_action, p_category, coalesce(p_details, '{}'::jsonb))
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function app.validate_qc(
  p_dossier_id uuid,
  p_status text,
  p_checklist jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  qc_id uuid;
  open_tasks integer;
begin
  if not app.has_any_backend_role(array['DIRECTEUR_SAV','QC']) then
    raise exception 'QC role required';
  end if;

  select count(*) into open_tasks
  from public.workshop_tasks
  where dossier_id = p_dossier_id
    and status not in ('completed','cancelled');

  if p_status = 'conforme' and open_tasks > 0 then
    raise exception 'QC conforme forbidden while workshop tasks are open';
  end if;

  insert into public.quality_controls (dossier_id, status, checklist, notes, controlled_by)
  values (p_dossier_id, p_status, coalesce(p_checklist, '{}'::jsonb), p_notes, auth.uid())
  returning id into qc_id;

  update public.dossiers
  set qc_status = p_status, updated_at = now()
  where id = p_dossier_id;

  perform app.create_audit_event(p_dossier_id, 'validate_qc', 'quality_control', jsonb_build_object('status', p_status));
  return qc_id;
end;
$$;

create or replace function app.create_delivery(
  p_dossier_id uuid,
  p_status text,
  p_blocking_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  delivery_id uuid;
  open_tasks integer;
  current_qc text;
begin
  if not app.has_any_backend_role(array['DIRECTEUR_SAV','LIVRAISON']) then
    raise exception 'Delivery role required';
  end if;

  select count(*) into open_tasks
  from public.workshop_tasks
  where dossier_id = p_dossier_id
    and status not in ('completed','cancelled');

  select qc_status into current_qc from public.dossiers where id = p_dossier_id;

  if open_tasks > 0 then
    raise exception 'Delivery forbidden while workshop tasks are open';
  end if;
  if current_qc <> 'conforme' then
    raise exception 'Delivery forbidden before conforming QC';
  end if;

  insert into public.deliveries (dossier_id, status, delivered_by, delivered_at, blocking_reason)
  values (p_dossier_id, p_status, auth.uid(), now(), p_blocking_reason)
  returning id into delivery_id;

  update public.dossiers
  set delivery_status = p_status, updated_at = now()
  where id = p_dossier_id;

  perform app.create_audit_event(p_dossier_id, 'create_delivery', 'delivery', jsonb_build_object('status', p_status));
  return delivery_id;
end;
$$;

create or replace function app.assign_task_resource(
  p_task_id uuid,
  p_resource_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  task_record public.workshop_tasks%rowtype;
  resource_record public.technician_resources%rowtype;
begin
  if not app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']) then
    raise exception 'Workshop role required';
  end if;

  select * into task_record from public.workshop_tasks where id = p_task_id;
  select * into resource_record from public.technician_resources where id = p_resource_id and active = true;

  if task_record.id is null or resource_record.id is null then
    raise exception 'Task or technician not found';
  end if;
  if lower(task_record.specialty) <> lower(resource_record.specialty) then
    raise exception 'Technician incompatible with task specialty';
  end if;

  update public.workshop_tasks
  set assigned_resource_id = p_resource_id, updated_at = now()
  where id = p_task_id;

  perform app.create_audit_event(task_record.dossier_id, 'assign_task_resource', 'workshop', jsonb_build_object('task_id', p_task_id, 'resource_id', p_resource_id));
  return p_task_id;
end;
$$;

create or replace function app.reserve_workshop_tasks(
  p_task_id uuid,
  p_resource_id uuid,
  p_bay_id text,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  reservation_id uuid;
  task_record public.workshop_tasks%rowtype;
  collisions integer;
begin
  if not app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']) then
    raise exception 'Workshop role required';
  end if;
  if p_end_at <= p_start_at then
    raise exception 'Invalid reservation slot';
  end if;

  select * into task_record from public.workshop_tasks where id = p_task_id;
  if task_record.id is null then
    raise exception 'Task not found';
  end if;

  select count(*) into collisions
  from public.workshop_reservations
  where status in ('reserved','active')
    and (resource_id = p_resource_id or bay_id = p_bay_id)
    and tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)');

  if collisions > 0 then
    raise exception 'Planning collision detected';
  end if;

  insert into public.workshop_reservations (dossier_id, task_id, resource_id, bay_id, start_at, end_at, status)
  values (task_record.dossier_id, p_task_id, p_resource_id, p_bay_id, p_start_at, p_end_at, 'reserved')
  returning id into reservation_id;

  update public.workshop_tasks
  set assigned_resource_id = p_resource_id, updated_at = now()
  where id = p_task_id;

  perform app.create_audit_event(task_record.dossier_id, 'reserve_workshop_tasks', 'planning', jsonb_build_object('task_id', p_task_id, 'reservation_id', reservation_id));
  return reservation_id;
end;
$$;

create or replace function app.block_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events are append-only';
end;
$$;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function app.block_audit_event_mutation();
