create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null check (role in ('directeur','reception','chefatelier','technicien','qc','livraison','lecture','DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','TECHNICIEN','QC','LIVRAISON','LECTURE')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  workshop_task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  resource_id uuid references public.technician_resources(id),
  bay_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_positive_slot check (end_at > start_at)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid references public.dossiers(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  role text not null,
  action text not null,
  category text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.file_metadata (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  category text not null,
  file_name text not null,
  mime_type text not null,
  size bigint not null check (size >= 0),
  storage_provider text not null default 'google-drive',
  drive_file_id text,
  drive_folder_id text,
  download_status text not null default 'metadata-only',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function app.normalize_backend_role(role_name text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(role_name, ''))
    when 'directeur' then 'DIRECTEUR_SAV'
    when 'chefatelier' then 'CHEF_ATELIER'
    when 'reception' then 'RECEPTION'
    when 'technicien' then 'TECHNICIEN'
    when 'qc' then 'QC'
    when 'livraison' then 'LIVRAISON'
    when 'lecture' then 'LECTURE'
    else coalesce(role_name, '')
  end;
$$;

create or replace function app.current_backend_role()
returns text
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select coalesce(
    (select app.normalize_backend_role(role) from public.profiles where id = auth.uid() and active = true limit 1),
    (select app.normalize_backend_role(role) from public.users_profile where id = auth.uid() and active = true limit 1),
    ''
  );
$$;

alter table public.profiles enable row level security;
alter table public.dossiers enable row level security;
alter table public.vehicles enable row level security;
alter table public.workshop_tasks enable row level security;
alter table public.reservations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.file_metadata enable row level security;

drop policy if exists profiles_select_self_or_director on public.profiles;
create policy profiles_select_self_or_director on public.profiles
  for select using (id = auth.uid() or app.has_backend_role('DIRECTEUR_SAV'));

drop policy if exists profiles_update_director on public.profiles;
create policy profiles_update_director on public.profiles
  for update using (app.has_backend_role('DIRECTEUR_SAV')) with check (app.has_backend_role('DIRECTEUR_SAV'));

drop policy if exists profiles_insert_director on public.profiles;
create policy profiles_insert_director on public.profiles
  for insert with check (app.has_backend_role('DIRECTEUR_SAV'));

drop policy if exists reservations_select_by_dossier_v2b on public.reservations;
create policy reservations_select_by_dossier_v2b on public.reservations
  for select using (app.can_access_dossier(dossier_id));

drop policy if exists reservations_write_workshop_v2b on public.reservations;
create policy reservations_write_workshop_v2b on public.reservations
  for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']));

drop policy if exists audit_logs_select_business_v2b on public.audit_logs;
create policy audit_logs_select_business_v2b on public.audit_logs
  for select using (app.can_access_dossier(dossier_id) or dossier_id is null);

drop policy if exists audit_logs_no_frontend_insert_v2b on public.audit_logs;
create policy audit_logs_no_frontend_insert_v2b on public.audit_logs
  for insert with check (false);

drop policy if exists audit_logs_no_frontend_update_v2b on public.audit_logs;
create policy audit_logs_no_frontend_update_v2b on public.audit_logs
  for update using (false) with check (false);

drop policy if exists audit_logs_no_frontend_delete_v2b on public.audit_logs;
create policy audit_logs_no_frontend_delete_v2b on public.audit_logs
  for delete using (false);

drop policy if exists file_metadata_select_by_dossier_v2b on public.file_metadata;
create policy file_metadata_select_by_dossier_v2b on public.file_metadata
  for select using (app.can_access_dossier(dossier_id));

drop policy if exists file_metadata_insert_authorized_v2b on public.file_metadata;
create policy file_metadata_insert_authorized_v2b on public.file_metadata
  for insert with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','TECHNICIEN','QC','LIVRAISON']));

drop policy if exists file_metadata_update_metadata_authorized_v2b on public.file_metadata;
create policy file_metadata_update_metadata_authorized_v2b on public.file_metadata
  for update using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC'])) with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC']));

create or replace function app.create_audit_log(
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
  log_id uuid;
begin
  insert into public.audit_logs (dossier_id, actor_id, role, action, category, details)
  values (p_dossier_id, auth.uid(), app.current_backend_role(), p_action, p_category, coalesce(p_details, '{}'::jsonb))
  returning id into log_id;
  return log_id;
end;
$$;

create or replace function app.block_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs are append-only';
end;
$$;

drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function app.block_audit_log_mutation();
