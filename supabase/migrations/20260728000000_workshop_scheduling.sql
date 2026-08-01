create extension if not exists btree_gist;

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  site_code text not null,
  timezone text not null default 'Africa/Tunis',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_zones (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workshop_id, code)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  unique (workshop_id, code)
);

create table if not exists public.skill_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  rank smallint not null check (rank between 1 and 100),
  active boolean not null default true
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  active boolean not null default true
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.users_profile(id) on delete set null,
  workshop_id uuid not null references public.workshops(id),
  team_id uuid references public.teams(id) on delete set null,
  employee_number text not null unique,
  display_name text not null,
  job_title text not null,
  active boolean not null default true,
  productive_minutes_per_day integer not null default 420 check (productive_minutes_per_day between 0 and 1440),
  target_productivity numeric(5,2) not null default 100 check (target_productivity between 0 and 500),
  allows_parallel_tasks boolean not null default false,
  restrictions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_skills (
  employee_id uuid not null references public.employees(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  skill_level_id uuid not null references public.skill_levels(id),
  valid_until date,
  created_at timestamptz not null default now(),
  primary key (employee_id, skill_id)
);

create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  valid_from date not null,
  valid_until date,
  start_time time not null,
  end_time time not null,
  break_windows jsonb not null default '[]'::jsonb,
  exceptional_date date,
  overtime boolean not null default false,
  check (end_time > start_time),
  check (valid_until is null or valid_until >= valid_from)
);

create table if not exists public.employee_absences (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  absence_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  approved boolean not null default true,
  check (ends_at > starts_at)
);

create table if not exists public.resource_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  exclusive_by_default boolean not null default true,
  active boolean not null default true
);

create table if not exists public.material_resources (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id),
  zone_id uuid references public.workshop_zones(id) on delete set null,
  resource_type_id uuid not null references public.resource_types(id),
  code text not null,
  name text not null,
  location text,
  state text not null default 'available'
    check (state in ('available','occupied','reserved','maintenance','broken','blocked','out_of_service')),
  active boolean not null default true,
  shareable boolean not null default false,
  simultaneous_capacity integer not null default 1 check (simultaneous_capacity > 0),
  compatible_operation_families text[] not null default '{}',
  compatible_brands text[] not null default '{}',
  compatible_models text[] not null default '{}',
  compatible_energies text[] not null default '{}',
  maximum_weight_kg numeric,
  maximum_height_mm numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, code)
);

create table if not exists public.resource_availability (
  id uuid primary key default gen_random_uuid(),
  material_resource_id uuid not null references public.material_resources(id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  valid_from date not null,
  valid_until date,
  start_time time not null,
  end_time time not null,
  exceptional_date date,
  check (end_time > start_time)
);

create table if not exists public.resource_unavailability (
  id uuid primary key default gen_random_uuid(),
  material_resource_id uuid not null references public.material_resources(id) on delete cascade,
  kind text not null check (kind in ('maintenance','breakdown','blocked','exception')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  resolved_at timestamptz,
  check (ends_at > starts_at)
);

create table if not exists public.work_order_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order integer not null default 0,
  terminal boolean not null default false,
  active boolean not null default true
);

create table if not exists public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order integer not null default 0,
  terminal boolean not null default false,
  active boolean not null default true
);

create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  active boolean not null default true
);

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.task_categories(id),
  code text not null unique,
  label text not null,
  description text,
  standard_duration_minutes integer not null check (standard_duration_minutes > 0),
  preparation_minutes integer not null default 0 check (preparation_minutes >= 0),
  drying_minutes integer not null default 0 check (drying_minutes >= 0),
  immobilization_minutes integer not null default 0 check (immobilization_minutes >= 0),
  quality_control_minutes integer not null default 0 check (quality_control_minutes >= 0),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  splittable boolean not null default false,
  minimum_technicians integer not null default 1 check (minimum_technicians > 0),
  maximum_technicians integer not null default 1 check (maximum_technicians >= minimum_technicians),
  may_start_without_all_parts boolean not null default false,
  checklist jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workshop_tasks
  add column if not exists workshop_id uuid references public.workshops(id),
  add column if not exists assigned_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists task_template_id uuid references public.task_templates(id),
  add column if not exists label text,
  add column if not exists description text,
  add column if not exists priority smallint not null default 3,
  add column if not exists planned_duration_minutes integer,
  add column if not exists actual_duration_minutes integer not null default 0,
  add column if not exists preparation_minutes integer not null default 0,
  add column if not exists drying_minutes integer not null default 0,
  add column if not exists immobilization_minutes integer not null default 0,
  add column if not exists quality_control_minutes integer not null default 0,
  add column if not exists buffer_before_minutes integer not null default 0,
  add column if not exists buffer_after_minutes integer not null default 0,
  add column if not exists splittable boolean not null default false,
  add column if not exists minimum_technicians integer not null default 1,
  add column if not exists maximum_technicians integer not null default 1,
  add column if not exists locked boolean not null default false,
  add column if not exists promised_at timestamptz,
  add column if not exists desired_at timestamptz,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists version integer not null default 1;

create table if not exists public.task_skill_requirements (
  task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  minimum_skill_level_id uuid not null references public.skill_levels(id),
  required boolean not null default true,
  primary key (task_id, skill_id)
);

create table if not exists public.task_resource_requirements (
  task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  resource_type_id uuid not null references public.resource_types(id),
  required boolean not null default true,
  quantity integer not null default 1 check (quantity > 0),
  primary key (task_id, resource_type_id)
);

create table if not exists public.task_dependencies (
  task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  predecessor_task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  dependency_type text not null check (dependency_type in ('finish_start','start_start','finish_finish')),
  required boolean not null default true,
  minimum_lag_minutes integer not null default 0 check (minimum_lag_minutes >= 0),
  maximum_lag_minutes integer,
  primary key (task_id, predecessor_task_id),
  check (task_id <> predecessor_task_id),
  check (maximum_lag_minutes is null or maximum_lag_minutes >= minimum_lag_minutes)
);

create table if not exists public.task_parts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  part_reference text not null,
  quantity numeric not null check (quantity > 0),
  availability_status text not null default 'unknown'
    check (availability_status in ('available','reserved','ordered','partial','unavailable','unknown')),
  expected_at timestamptz,
  required_before_planning boolean not null default false,
  required_before_start boolean not null default true,
  unique (task_id, part_reference)
);

create table if not exists public.workshop_bookings (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booking_range tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  status text not null default 'confirmed'
    check (status in ('confirmed','in_progress','paused','completed','cancelled','overbooked')),
  locked boolean not null default false,
  overbooked boolean not null default false,
  reason text,
  server_version integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (not overbooked or nullif(btrim(reason), '') is not null)
);

create table if not exists public.booking_resources (
  booking_id uuid not null references public.workshop_bookings(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('employee','material')),
  resource_id uuid not null,
  capacity_slot smallint not null default 1 check (capacity_slot > 0),
  conflict_guard boolean not null default true,
  booking_range tstzrange not null,
  primary key (booking_id, resource_kind, resource_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workshop_booking_task_no_overlap') then
    alter table public.workshop_bookings add constraint workshop_booking_task_no_overlap
      exclude using gist (task_id with =, booking_range with &&)
      where (status in ('confirmed','in_progress','paused'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workshop_booking_vehicle_no_overlap') then
    alter table public.workshop_bookings add constraint workshop_booking_vehicle_no_overlap
      exclude using gist (vehicle_id with =, booking_range with &&)
      where (vehicle_id is not null and status in ('confirmed','in_progress','paused'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workshop_booking_resource_no_overlap') then
    alter table public.booking_resources add constraint workshop_booking_resource_no_overlap
      exclude using gist (resource_kind with =, resource_id with =, capacity_slot with =, booking_range with &&)
      where (conflict_guard);
  end if;
end $$;

create table if not exists public.task_time_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  event_type text not null check (event_type in ('start','pause','resume','finish','block','unblock')),
  reason text,
  occurred_at timestamptz not null default now(),
  actor_id uuid not null default auth.uid() references auth.users(id),
  device_or_session text
);

create table if not exists public.quality_check_templates (
  id uuid primary key default gen_random_uuid(),
  task_category_id uuid references public.task_categories(id),
  code text not null unique,
  label text not null,
  items jsonb not null default '[]'::jsonb,
  active boolean not null default true
);

create table if not exists public.quality_checks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.workshop_tasks(id) on delete cascade,
  template_id uuid references public.quality_check_templates(id),
  status text not null check (status in ('pending','compliant','non_compliant')),
  observation text,
  controlled_by uuid not null default auth.uid() references auth.users(id),
  controlled_at timestamptz not null default now(),
  reopened_task_id uuid references public.workshop_tasks(id)
);

create table if not exists public.quality_check_items (
  id uuid primary key default gen_random_uuid(),
  quality_check_id uuid not null references public.quality_checks(id) on delete cascade,
  item_code text not null,
  label text not null,
  compliant boolean,
  observation text,
  photo_attachment_id uuid references public.file_attachments(id),
  unique (quality_check_id, item_code)
);

create table if not exists public.workshop_settings (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  category text not null,
  key text not null,
  value jsonb not null,
  version integer not null default 1,
  updated_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (workshop_id, category, key)
);

create table if not exists public.planning_rules (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  code text not null,
  value jsonb not null,
  active boolean not null default true,
  updated_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (workshop_id, code)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  recipient_role text,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_id is not null or recipient_role is not null)
);

create table if not exists public.sync_operations (
  id uuid primary key,
  actor_id uuid not null default auth.uid() references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  operation_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','applied','conflict','failed')),
  attempts integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  server_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.sync_operations(id) on delete cascade,
  local_value jsonb not null,
  server_value jsonb not null,
  resolution text check (resolution in ('local','server','merged')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists employee_skills_skill_idx on public.employee_skills(skill_id, skill_level_id);
create index if not exists employee_absences_period_idx on public.employee_absences using gist(tstzrange(starts_at, ends_at, '[)'));
create index if not exists material_resources_lookup_idx on public.material_resources(workshop_id, resource_type_id, state) where active;
create index if not exists resource_unavailability_period_idx on public.resource_unavailability using gist(material_resource_id, tstzrange(starts_at, ends_at, '[)'));
create index if not exists workshop_tasks_dossier_status_idx on public.workshop_tasks(dossier_id, status, promised_at);
create index if not exists workshop_bookings_period_idx on public.workshop_bookings using gist(booking_range);
create index if not exists workshop_bookings_task_status_idx on public.workshop_bookings(task_id, status);
create index if not exists task_time_events_task_date_idx on public.task_time_events(task_id, occurred_at desc);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;
create index if not exists sync_operations_retry_idx on public.sync_operations(status, next_retry_at) where status in ('pending','failed');

create or replace function app.skill_level_rank(p_level_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select coalesce((select rank from public.skill_levels where id = p_level_id and active), 0);
$$;

create or replace function app.find_next_workshop_slot(
  p_task_id uuid,
  p_start_at timestamptz,
  p_duration_minutes integer
)
returns timestamptz
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select greatest(
    p_start_at,
    coalesce(max(ends_at), p_start_at)
  )
  from public.workshop_bookings
  where status in ('confirmed','in_progress','paused')
    and (task_id = p_task_id or dossier_id = (select dossier_id from public.workshop_tasks where id = p_task_id))
    and ends_at > p_start_at;
$$;

create or replace function app.employee_is_available(
  p_employee_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  with employee_context as (
    select employee.id, workshop.timezone
    from public.employees employee
    join public.workshops workshop on workshop.id = employee.workshop_id
    where employee.id = p_employee_id and employee.active
  ),
  local_slot as (
    select
      context.id,
      (p_start_at at time zone context.timezone)::date as start_date,
      (p_end_at at time zone context.timezone)::date as end_date,
      (p_start_at at time zone context.timezone)::time as start_time,
      (p_end_at at time zone context.timezone)::time as end_time
    from employee_context context
  )
  select exists (
    select 1
    from local_slot slot
    where slot.start_date = slot.end_date
      and not exists (
        select 1
        from public.employee_absences absence
        where absence.employee_id = slot.id
          and absence.approved
          and tstzrange(absence.starts_at, absence.ends_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
      )
      and exists (
        select 1
        from public.employee_shifts shift
        where shift.employee_id = slot.id
          and slot.start_date between shift.valid_from and coalesce(shift.valid_until, 'infinity'::date)
          and (
            shift.exceptional_date = slot.start_date
            or (shift.exceptional_date is null and shift.weekday = extract(dow from slot.start_date)::smallint)
          )
          and shift.start_time <= slot.start_time
          and shift.end_time >= slot.end_time
          and not exists (
            select 1
            from jsonb_to_recordset(shift.break_windows) as break_window(start text, "end" text)
            where tsrange(
              (slot.start_date + break_window.start::time)::timestamp,
              (slot.start_date + break_window."end"::time)::timestamp,
              '[)'
            ) && tsrange(
              (slot.start_date + slot.start_time)::timestamp,
              (slot.start_date + slot.end_time)::timestamp,
              '[)'
            )
          )
      )
  );
$$;

create or replace function app.material_resource_is_available(
  p_resource_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  with resource_context as (
    select resource.id, workshop.timezone
    from public.material_resources resource
    join public.workshops workshop on workshop.id = resource.workshop_id
    where resource.id = p_resource_id
      and resource.active
      and resource.state = 'available'
  ),
  local_slot as (
    select
      context.id,
      (p_start_at at time zone context.timezone)::date as start_date,
      (p_end_at at time zone context.timezone)::date as end_date,
      (p_start_at at time zone context.timezone)::time as start_time,
      (p_end_at at time zone context.timezone)::time as end_time
    from resource_context context
  )
  select exists (
    select 1
    from local_slot slot
    where slot.start_date = slot.end_date
      and not exists (
        select 1
        from public.resource_unavailability unavailable
        where unavailable.material_resource_id = slot.id
          and unavailable.resolved_at is null
          and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
      )
      and (
        not exists (
          select 1 from public.resource_availability configured
          where configured.material_resource_id = slot.id
        )
        or exists (
          select 1
          from public.resource_availability available
          where available.material_resource_id = slot.id
            and slot.start_date between available.valid_from and coalesce(available.valid_until, 'infinity'::date)
            and (
              available.exceptional_date = slot.start_date
              or (available.exceptional_date is null and available.weekday = extract(dow from slot.start_date)::smallint)
            )
            and available.start_time <= slot.start_time
            and available.end_time >= slot.end_time
        )
      )
  );
$$;

create or replace function app.can_access_dossier(target_dossier_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app, pg_temp
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC','LIVRAISON','LECTURE']) then
    return true;
  end if;
  if app.has_backend_role('TECHNICIEN') then
    return exists (
      select 1
      from public.workshop_tasks task
      join public.employees employee on employee.id = task.assigned_employee_id
      where task.dossier_id = target_dossier_id
        and employee.profile_id = auth.uid()
        and employee.active
    );
  end if;
  return false;
end;
$$;

create or replace function app.confirm_workshop_booking(
  p_task_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_employee_ids uuid[],
  p_material_resource_ids uuid[],
  p_operation_id uuid,
  p_overbook boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_task public.workshop_tasks%rowtype;
  v_booking_id uuid;
  v_existing public.workshop_bookings%rowtype;
  v_resource_id uuid;
  v_capacity_slot integer;
  v_required_count integer;
  v_next_slot timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']) then
    raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED';
  end if;
  if p_end_at <= p_start_at then
    raise exception using errcode = '22007', message = 'INVALID_TIME_RANGE';
  end if;
  if coalesce(array_length(p_employee_ids, 1), 0) = 0 then
    raise exception using errcode = '23514', message = 'EMPLOYEE_REQUIRED';
  end if;
  if p_overbook and (
    not app.has_backend_role('DIRECTEUR_SAV')
    or nullif(btrim(p_reason), '') is null
  ) then
    raise exception using errcode = '42501', message = 'OVERBOOK_AUTHORIZATION_AND_REASON_REQUIRED';
  end if;
  if coalesce(array_length(p_employee_ids, 1), 0) <> coalesce((
    select count(distinct employee_id) from unnest(p_employee_ids) requested(employee_id)
  ), 0) or coalesce(array_length(p_material_resource_ids, 1), 0) <> coalesce((
    select count(distinct resource_id) from unnest(p_material_resource_ids) requested(resource_id)
  ), 0) then
    raise exception using errcode = '23514', message = 'DUPLICATE_RESOURCE_ID';
  end if;

  select * into v_existing from public.workshop_bookings where operation_id = p_operation_id;
  if found then
    if v_existing.task_id <> p_task_id
      or v_existing.starts_at <> p_start_at
      or v_existing.ends_at <> p_end_at
      or v_existing.overbooked <> p_overbook
      or coalesce(v_existing.reason, '') <> coalesce(p_reason, '')
      or (select array_agg(resource_id order by resource_id)
          from public.booking_resources
          where booking_id = v_existing.id and resource_kind = 'employee')
         is distinct from (select array_agg(employee_id order by employee_id) from unnest(p_employee_ids) requested(employee_id))
      or (select array_agg(resource_id order by resource_id)
          from public.booking_resources
          where booking_id = v_existing.id and resource_kind = 'material')
         is distinct from (select array_agg(resource_id order by resource_id) from unnest(p_material_resource_ids) requested(resource_id))
    then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return jsonb_build_object(
      'bookingId', v_existing.id,
      'status', 'server_confirmed',
      'serverVersion', v_existing.server_version,
      'idempotentReplay', true
    );
  end if;

  select * into v_task from public.workshop_tasks where id = p_task_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TASK_NOT_FOUND';
  end if;
  if v_task.workshop_id is null then
    raise exception using errcode = '23514', message = 'TASK_WORKSHOP_REQUIRED';
  end if;
  if v_task.locked and exists (select 1 from public.workshop_bookings where task_id = p_task_id and status <> 'cancelled') then
    raise exception using errcode = '55000', message = 'TASK_LOCKED';
  end if;

  select count(*) into v_required_count
  from public.task_parts
  where task_id = p_task_id
    and required_before_planning
    and availability_status not in ('available','reserved');
  if v_required_count > 0 then
    raise exception using errcode = '55000', message = 'REQUIRED_PARTS_UNAVAILABLE';
  end if;
  if exists (
    select 1
    from public.task_dependencies dependency
    left join public.workshop_tasks predecessor on predecessor.id = dependency.predecessor_task_id
    where dependency.task_id = p_task_id
      and dependency.required
      and (
        predecessor.id is null
        or (dependency.dependency_type = 'start_start' and predecessor.started_at is null)
        or (dependency.dependency_type in ('finish_start','finish_finish') and predecessor.completed_at is null)
        or (
          dependency.dependency_type = 'start_start'
          and p_start_at < predecessor.started_at + make_interval(mins => dependency.minimum_lag_minutes)
        )
        or (
          dependency.dependency_type in ('finish_start','finish_finish')
          and p_start_at < predecessor.completed_at + make_interval(mins => dependency.minimum_lag_minutes)
        )
      )
  ) then
    raise exception using errcode = '55000', message = 'TASK_DEPENDENCY_NOT_READY';
  end if;

  if coalesce(array_length(p_employee_ids, 1), 0) < greatest(v_task.minimum_technicians, 1) then
    raise exception using errcode = '23514', message = 'MINIMUM_TECHNICIANS_NOT_MET';
  end if;
  if coalesce(array_length(p_employee_ids, 1), 0) > greatest(v_task.maximum_technicians, 1) then
    raise exception using errcode = '23514', message = 'MAXIMUM_TECHNICIANS_EXCEEDED';
  end if;

  if exists (
    select 1
    from unnest(p_employee_ids) requested(employee_id)
    left join public.employees employee on employee.id = requested.employee_id
    where employee.id is null
      or employee.workshop_id <> v_task.workshop_id
      or not app.employee_is_available(requested.employee_id, p_start_at, p_end_at)
  ) then
    raise exception using errcode = '23514', message = 'EMPLOYEE_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from public.task_skill_requirements requirement
    where requirement.task_id = p_task_id
      and requirement.required
      and not exists (
        select 1
        from unnest(p_employee_ids) requested(employee_id)
        join public.employee_skills employee_skill
          on employee_skill.employee_id = requested.employee_id
         and employee_skill.skill_id = requirement.skill_id
        where (employee_skill.valid_until is null or employee_skill.valid_until >= current_date)
          and app.skill_level_rank(employee_skill.skill_level_id) >= app.skill_level_rank(requirement.minimum_skill_level_id)
      )
  ) then
    raise exception using errcode = '23514', message = 'REQUIRED_SKILL_MISSING';
  end if;

  if exists (
    select 1
    from unnest(p_material_resource_ids) requested(resource_id)
    left join public.material_resources resource on resource.id = requested.resource_id
    where resource.id is null
      or resource.workshop_id <> v_task.workshop_id
      or not app.material_resource_is_available(requested.resource_id, p_start_at, p_end_at)
  ) then
    raise exception using errcode = '23514', message = 'MATERIAL_RESOURCE_UNAVAILABLE';
  end if;
  if exists (
    select 1
    from public.task_resource_requirements requirement
    where requirement.task_id = p_task_id
      and requirement.required
      and (
        select count(*)
        from unnest(p_material_resource_ids) requested(resource_id)
        join public.material_resources resource on resource.id = requested.resource_id
        where resource.resource_type_id = requirement.resource_type_id
      ) < requirement.quantity
  ) then
    raise exception using errcode = '23514', message = 'REQUIRED_MATERIAL_QUANTITY_NOT_MET';
  end if;

  foreach v_resource_id in array p_employee_ids loop
    perform pg_advisory_xact_lock(hashtext('employee:' || v_resource_id::text));
  end loop;
  foreach v_resource_id in array p_material_resource_ids loop
    perform pg_advisory_xact_lock(hashtext('material:' || v_resource_id::text));
  end loop;

  if not p_overbook and exists (
    select 1
    from public.booking_resources resource
    where resource.booking_range && tstzrange(p_start_at, p_end_at, '[)')
      and resource.resource_kind = 'employee'
      and resource.resource_id = any(p_employee_ids)
  ) then
    v_next_slot := app.find_next_workshop_slot(p_task_id, p_start_at, extract(epoch from (p_end_at - p_start_at))::integer / 60);
    return jsonb_build_object(
      'status', 'conflict',
      'code', 'RESOURCE_ALREADY_BOOKED',
      'message', 'Ce creneau vient d''etre reserve. Une autre proposition est necessaire.',
      'alternatives', jsonb_build_array(jsonb_build_object(
        'start', v_next_slot,
        'end', v_next_slot + (p_end_at - p_start_at)
      ))
    );
  end if;

  insert into public.workshop_bookings (
    operation_id, task_id, dossier_id, vehicle_id, starts_at, ends_at,
    status, overbooked, reason, created_by
  )
  select
    p_operation_id, v_task.id, v_task.dossier_id, dossier.vehicle_id,
    p_start_at, p_end_at,
    case when p_overbook then 'overbooked' else 'confirmed' end,
    p_overbook, p_reason, auth.uid()
  from public.dossiers dossier
  where dossier.id = v_task.dossier_id
  returning id into v_booking_id;
  if v_booking_id is null then
    raise exception using errcode = 'P0002', message = 'DOSSIER_NOT_FOUND';
  end if;

  foreach v_resource_id in array p_employee_ids loop
    insert into public.booking_resources(booking_id, resource_kind, resource_id, capacity_slot, conflict_guard, booking_range)
    values (v_booking_id, 'employee', v_resource_id, 1, not p_overbook, tstzrange(p_start_at, p_end_at, '[)'));
  end loop;
  foreach v_resource_id in array p_material_resource_ids loop
    select slot into v_capacity_slot
    from generate_series(
      1,
      (select case when shareable then simultaneous_capacity else 1 end from public.material_resources where id = v_resource_id)
    ) slot
    where not exists (
      select 1
      from public.booking_resources existing
      where existing.resource_kind = 'material'
        and existing.resource_id = v_resource_id
        and existing.capacity_slot = slot
        and existing.booking_range && tstzrange(p_start_at, p_end_at, '[)')
    )
    order by slot
    limit 1;
    if v_capacity_slot is null and not p_overbook then
      raise exception using errcode = '23P01', message = 'MATERIAL_CAPACITY_EXHAUSTED';
    end if;
    insert into public.booking_resources(booking_id, resource_kind, resource_id, capacity_slot, conflict_guard, booking_range)
    values (v_booking_id, 'material', v_resource_id, coalesce(v_capacity_slot, 32767), not p_overbook, tstzrange(p_start_at, p_end_at, '[)'));
  end loop;

  update public.workshop_tasks
  set status = 'planned', updated_at = now(), version = version + 1
  where id = p_task_id;

  perform app.create_audit_event(
    v_task.dossier_id,
    'confirm_workshop_booking',
    'planning',
    jsonb_build_object(
      'booking_id', v_booking_id,
      'task_id', p_task_id,
      'starts_at', p_start_at,
      'ends_at', p_end_at,
      'employee_ids', p_employee_ids,
      'material_resource_ids', p_material_resource_ids,
      'overbooked', p_overbook,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'bookingId', v_booking_id,
    'status', 'server_confirmed',
    'serverVersion', 1,
    'idempotentReplay', false
  );
exception
  when exclusion_violation then
    return jsonb_build_object(
      'status', 'conflict',
      'code', 'CONCURRENT_BOOKING_CONFLICT',
      'message', 'Une ressource a ete reservee simultanement. La transaction a ete annulee.'
    );
end;
$$;

create or replace function app.record_task_time_event(
  p_task_id uuid,
  p_event_type text,
  p_reason text default null,
  p_operation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_event_id uuid;
  v_dossier_id uuid;
begin
  if not app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','TECHNICIEN','QC']) then
    raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED';
  end if;
  if p_event_type in ('pause','block') and nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '23514', message = 'REASON_REQUIRED';
  end if;
  select dossier_id into v_dossier_id from public.workshop_tasks where id = p_task_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'TASK_NOT_FOUND'; end if;
  if not app.can_access_dossier(v_dossier_id) then
    raise exception using errcode = '42501', message = 'DOSSIER_ACCESS_DENIED';
  end if;
  if app.has_backend_role('TECHNICIEN') and not exists (
    select 1
    from public.workshop_tasks task
    join public.employees employee on employee.id = task.assigned_employee_id
    where task.id = p_task_id
      and employee.profile_id = auth.uid()
      and employee.active
  ) then
    raise exception using errcode = '42501', message = 'TASK_ASSIGNMENT_REQUIRED';
  end if;

  insert into public.task_time_events(task_id, event_type, reason)
  values (p_task_id, p_event_type, p_reason)
  returning id into v_event_id;

  update public.workshop_tasks
  set
    status = case p_event_type
      when 'start' then 'in_progress'
      when 'pause' then 'paused'
      when 'resume' then 'in_progress'
      when 'finish' then 'quality_control'
      when 'block' then 'blocked'
      when 'unblock' then 'ready_to_plan'
      else status
    end,
    started_at = case when p_event_type = 'start' then coalesce(started_at, now()) else started_at end,
    completed_at = case when p_event_type = 'finish' then now() else completed_at end,
    version = version + 1,
    updated_at = now()
  where id = p_task_id;

  perform app.create_audit_event(v_dossier_id, 'task_' || p_event_type, 'execution',
    jsonb_build_object('task_id', p_task_id, 'event_id', v_event_id, 'reason', p_reason, 'operation_id', p_operation_id));
  return jsonb_build_object('eventId', v_event_id, 'status', 'applied');
end;
$$;

create or replace function public.confirm_workshop_booking(
  p_task_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_employee_ids uuid[],
  p_material_resource_ids uuid[],
  p_operation_id uuid,
  p_overbook boolean default false,
  p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.confirm_workshop_booking(
    p_task_id, p_start_at, p_end_at, p_employee_ids, p_material_resource_ids,
    p_operation_id, p_overbook, p_reason
  );
$$;

create or replace function public.record_task_time_event(
  p_task_id uuid,
  p_event_type text,
  p_reason text default null,
  p_operation_id uuid default gen_random_uuid()
)
returns jsonb
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.record_task_time_event(p_task_id, p_event_type, p_reason, p_operation_id);
$$;

create or replace function public.save_workshop_scheduling_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if not app.has_backend_role('DIRECTEUR_SAV') then
    raise exception using errcode = '42501', message = 'ROLE_NOT_ALLOWED';
  end if;
  insert into public.app_settings(key, value, updated_at)
  values ('workshop_scheduling.default', p_settings, now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  perform app.create_audit_event(
    null,
    'save_workshop_scheduling_settings',
    'workshop_configuration',
    jsonb_build_object('key', 'workshop_scheduling.default', 'new_value', p_settings)
  );
  return jsonb_build_object('status', 'saved', 'updatedAt', now());
end;
$$;

create or replace function app.audit_workshop_configuration()
returns trigger
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_entity_id uuid;
begin
  v_entity_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
  insert into public.audit_events(actor_id, role, action, category, details)
  values (
    auth.uid(),
    coalesce(app.current_backend_role(), 'UNKNOWN'),
    lower(tg_op),
    'workshop_configuration',
    jsonb_build_object(
      'table', tg_table_name,
      'entity_id', v_entity_id,
      'old_value', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new_value', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end;
$$;

alter table public.workshops enable row level security;
alter table public.workshop_zones enable row level security;
alter table public.teams enable row level security;
alter table public.skill_levels enable row level security;
alter table public.skills enable row level security;
alter table public.employees enable row level security;
alter table public.employee_skills enable row level security;
alter table public.employee_shifts enable row level security;
alter table public.employee_absences enable row level security;
alter table public.resource_types enable row level security;
alter table public.material_resources enable row level security;
alter table public.resource_availability enable row level security;
alter table public.resource_unavailability enable row level security;
alter table public.work_order_statuses enable row level security;
alter table public.task_statuses enable row level security;
alter table public.task_categories enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_skill_requirements enable row level security;
alter table public.task_resource_requirements enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_parts enable row level security;
alter table public.workshop_bookings enable row level security;
alter table public.booking_resources enable row level security;
alter table public.task_time_events enable row level security;
alter table public.quality_check_templates enable row level security;
alter table public.quality_checks enable row level security;
alter table public.quality_check_items enable row level security;
alter table public.workshop_settings enable row level security;
alter table public.planning_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.sync_operations enable row level security;
alter table public.sync_conflicts enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'workshops','workshop_zones','teams','skill_levels','skills','employees',
    'employee_skills','employee_shifts','employee_absences','resource_types',
    'material_resources','resource_availability','resource_unavailability',
    'work_order_statuses','task_statuses','task_categories','task_templates',
    'task_skill_requirements','task_resource_requirements','task_dependencies',
    'task_parts','workshop_bookings','booking_resources','task_time_events',
    'quality_check_templates','quality_checks','quality_check_items',
    'workshop_settings','planning_rules','notifications','sync_operations','sync_conflicts'
  ] loop
    execute format('drop policy if exists workshop_read on public.%I', v_table);
  end loop;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'workshops','workshop_zones','teams','skill_levels','skills','resource_types',
    'material_resources','resource_availability','resource_unavailability',
    'work_order_statuses','task_statuses','task_categories','task_templates',
    'quality_check_templates'
  ] loop
    execute format('drop policy if exists workshop_reference_read on public.%I', v_table);
    execute format(
      'create policy workshop_reference_read on public.%I for select using (app.has_any_backend_role(array[''DIRECTEUR_SAV'',''CHEF_ATELIER'',''RECEPTION'',''TECHNICIEN'',''QC'',''LIVRAISON'',''LECTURE'']))',
      v_table
    );
    execute format('drop policy if exists workshop_config_manage on public.%I', v_table);
    execute format(
      'create policy workshop_config_manage on public.%I for all using (app.has_backend_role(''DIRECTEUR_SAV'')) with check (app.has_backend_role(''DIRECTEUR_SAV''))',
      v_table
    );
  end loop;
end $$;

drop policy if exists employees_read_scoped on public.employees;
create policy employees_read_scoped on public.employees
for select using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']) or profile_id = auth.uid());

drop policy if exists employee_skills_read_scoped on public.employee_skills;
create policy employee_skills_read_scoped on public.employee_skills
for select using (
  app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER'])
  or exists (select 1 from public.employees employee where employee.id = employee_skills.employee_id and employee.profile_id = auth.uid())
);

drop policy if exists employee_shifts_read_scoped on public.employee_shifts;
create policy employee_shifts_read_scoped on public.employee_shifts
for select using (
  app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER'])
  or exists (select 1 from public.employees employee where employee.id = employee_shifts.employee_id and employee.profile_id = auth.uid())
);

drop policy if exists employee_absences_read_scoped on public.employee_absences;
create policy employee_absences_read_scoped on public.employee_absences
for select using (
  app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER'])
  or exists (select 1 from public.employees employee where employee.id = employee_absences.employee_id and employee.profile_id = auth.uid())
);

do $$
declare
  v_table text;
begin
  foreach v_table in array array['employees','employee_skills','employee_shifts','employee_absences'] loop
    execute format('drop policy if exists employee_config_manage on public.%I', v_table);
    execute format(
      'create policy employee_config_manage on public.%I for all using (app.has_backend_role(''DIRECTEUR_SAV'')) with check (app.has_backend_role(''DIRECTEUR_SAV''))',
      v_table
    );
  end loop;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['task_skill_requirements','task_resource_requirements','task_dependencies','task_parts'] loop
    execute format('drop policy if exists workshop_task_read on public.%I', v_table);
    execute format(
      'create policy workshop_task_read on public.%I for select using (exists (select 1 from public.workshop_tasks task where task.id = %I.task_id and app.can_access_dossier(task.dossier_id)))',
      v_table, v_table
    );
    execute format('drop policy if exists workshop_task_manage on public.%I', v_table);
    execute format(
      'create policy workshop_task_manage on public.%I for all using (app.has_any_backend_role(array[''DIRECTEUR_SAV'',''CHEF_ATELIER'']) and exists (select 1 from public.workshop_tasks task where task.id = %I.task_id and app.can_access_dossier(task.dossier_id))) with check (app.has_any_backend_role(array[''DIRECTEUR_SAV'',''CHEF_ATELIER'']) and exists (select 1 from public.workshop_tasks task where task.id = %I.task_id and app.can_access_dossier(task.dossier_id)))',
      v_table, v_table, v_table
    );
  end loop;
end $$;

drop policy if exists workshop_bookings_read_scoped on public.workshop_bookings;
create policy workshop_bookings_read_scoped on public.workshop_bookings
for select using (app.can_access_dossier(dossier_id));

drop policy if exists booking_resources_read_scoped on public.booking_resources;
create policy booking_resources_read_scoped on public.booking_resources
for select using (
  exists (
    select 1 from public.workshop_bookings booking
    where booking.id = booking_resources.booking_id and app.can_access_dossier(booking.dossier_id)
  )
);

drop policy if exists task_time_events_read_scoped on public.task_time_events;
create policy task_time_events_read_scoped on public.task_time_events
for select using (
  exists (
    select 1 from public.workshop_tasks task
    where task.id = task_time_events.task_id and app.can_access_dossier(task.dossier_id)
  )
);

drop policy if exists quality_checks_manage on public.quality_checks;
create policy quality_checks_manage on public.quality_checks
for all using (
  app.has_any_backend_role(array['DIRECTEUR_SAV','QC'])
  and exists (select 1 from public.workshop_tasks task where task.id = quality_checks.task_id and app.can_access_dossier(task.dossier_id))
)
with check (
  app.has_any_backend_role(array['DIRECTEUR_SAV','QC'])
  and exists (select 1 from public.workshop_tasks task where task.id = quality_checks.task_id and app.can_access_dossier(task.dossier_id))
);

drop policy if exists quality_checks_read_scoped on public.quality_checks;
create policy quality_checks_read_scoped on public.quality_checks
for select using (
  exists (select 1 from public.workshop_tasks task where task.id = quality_checks.task_id and app.can_access_dossier(task.dossier_id))
);

drop policy if exists quality_check_items_manage on public.quality_check_items;
create policy quality_check_items_manage on public.quality_check_items
for all using (
  app.has_any_backend_role(array['DIRECTEUR_SAV','QC'])
  and exists (
    select 1 from public.quality_checks quality
    join public.workshop_tasks task on task.id = quality.task_id
    where quality.id = quality_check_items.quality_check_id and app.can_access_dossier(task.dossier_id)
  )
)
with check (
  app.has_any_backend_role(array['DIRECTEUR_SAV','QC'])
  and exists (
    select 1 from public.quality_checks quality
    join public.workshop_tasks task on task.id = quality.task_id
    where quality.id = quality_check_items.quality_check_id and app.can_access_dossier(task.dossier_id)
  )
);

drop policy if exists quality_check_items_read_scoped on public.quality_check_items;
create policy quality_check_items_read_scoped on public.quality_check_items
for select using (
  exists (
    select 1 from public.quality_checks quality
    join public.workshop_tasks task on task.id = quality.task_id
    where quality.id = quality_check_items.quality_check_id and app.can_access_dossier(task.dossier_id)
  )
);

drop policy if exists workshop_config_write on public.workshop_settings;
create policy workshop_config_write on public.workshop_settings
for all using (app.has_backend_role('DIRECTEUR_SAV'))
with check (app.has_backend_role('DIRECTEUR_SAV'));

drop policy if exists workshop_settings_read on public.workshop_settings;
create policy workshop_settings_read on public.workshop_settings
for select using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','LECTURE']));

drop policy if exists planning_rules_write on public.planning_rules;
create policy planning_rules_write on public.planning_rules
for all using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']))
with check (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER']));

drop policy if exists planning_rules_read on public.planning_rules;
create policy planning_rules_read on public.planning_rules
for select using (app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','LECTURE']));

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
for select using (recipient_id = auth.uid() or recipient_role = app.current_backend_role());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists sync_operations_own on public.sync_operations;
create policy sync_operations_own on public.sync_operations
for all using (actor_id = auth.uid()) with check (actor_id = auth.uid());

drop policy if exists sync_conflicts_own on public.sync_conflicts;
create policy sync_conflicts_own on public.sync_conflicts
for all using (
  exists (select 1 from public.sync_operations operation where operation.id = sync_conflicts.operation_id and operation.actor_id = auth.uid())
)
with check (
  exists (select 1 from public.sync_operations operation where operation.id = sync_conflicts.operation_id and operation.actor_id = auth.uid())
);

drop policy if exists audit_events_select_business on public.audit_events;
create policy audit_events_select_business on public.audit_events
for select using (
  app.has_backend_role('DIRECTEUR_SAV')
  or (
    dossier_id is not null
    and app.can_access_dossier(dossier_id)
    and app.has_any_backend_role(array['CHEF_ATELIER','RECEPTION','TECHNICIEN','QC','LIVRAISON','LECTURE'])
  )
);

drop policy if exists qc_write_qc_role on public.quality_controls;
create policy qc_write_qc_role on public.quality_controls
for all using (
  app.has_any_backend_role(array['DIRECTEUR_SAV','QC'])
  and app.can_access_dossier(dossier_id)
)
with check (
  app.has_any_backend_role(array['DIRECTEUR_SAV','QC'])
  and app.can_access_dossier(dossier_id)
);

drop policy if exists file_attachments_insert_authorized on public.file_attachments;
create policy file_attachments_insert_authorized on public.file_attachments
for insert with check (
  app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','TECHNICIEN','QC','LIVRAISON'])
  and app.can_access_dossier(dossier_id)
);

drop policy if exists file_attachments_update_metadata_authorized on public.file_attachments;
create policy file_attachments_update_metadata_authorized on public.file_attachments
for update using (
  app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC'])
  and app.can_access_dossier(dossier_id)
)
with check (
  app.has_any_backend_role(array['DIRECTEUR_SAV','CHEF_ATELIER','RECEPTION','QC'])
  and app.can_access_dossier(dossier_id)
);

revoke all on function app.confirm_workshop_booking(uuid,timestamptz,timestamptz,uuid[],uuid[],uuid,boolean,text) from public;
revoke all on function app.record_task_time_event(uuid,text,text,uuid) from public;
revoke all on function app.employee_is_available(uuid,timestamptz,timestamptz) from public;
revoke all on function app.material_resource_is_available(uuid,timestamptz,timestamptz) from public;
revoke all on function public.confirm_workshop_booking(uuid,timestamptz,timestamptz,uuid[],uuid[],uuid,boolean,text) from public;
grant execute on function public.confirm_workshop_booking(uuid,timestamptz,timestamptz,uuid[],uuid[],uuid,boolean,text) to authenticated;
revoke all on function public.record_task_time_event(uuid,text,text,uuid) from public;
grant execute on function public.record_task_time_event(uuid,text,text,uuid) to authenticated;
revoke all on function public.save_workshop_scheduling_settings(jsonb) from public;
grant execute on function public.save_workshop_scheduling_settings(jsonb) to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'workshops','workshop_zones','teams','skill_levels','skills','employees',
    'employee_shifts','employee_absences','resource_types','material_resources',
    'resource_availability','resource_unavailability','work_order_statuses',
    'task_statuses','task_categories','task_templates','workshop_settings','planning_rules'
  ] loop
    execute format('drop trigger if exists audit_workshop_configuration on public.%I', v_table);
    execute format(
      'create trigger audit_workshop_configuration after insert or update or delete on public.%I for each row execute function app.audit_workshop_configuration()',
      v_table
    );
  end loop;
end $$;
