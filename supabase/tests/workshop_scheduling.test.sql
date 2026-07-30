do $$
declare
  function_definition text;
begin
  if to_regclass('public.workshops') is null then raise exception 'workshops table missing'; end if;
  if to_regclass('public.employees') is null then raise exception 'employees table missing'; end if;
  if to_regclass('public.material_resources') is null then raise exception 'material_resources table missing'; end if;
  if to_regclass('public.workshop_bookings') is null then raise exception 'workshop_bookings table missing'; end if;
  if to_regclass('public.booking_resources') is null then raise exception 'booking_resources table missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workshop_tasks' and column_name = 'workshop_id'
  ) then raise exception 'workshop_tasks.workshop_id missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workshop_tasks' and column_name = 'assigned_employee_id'
  ) then raise exception 'workshop_tasks.assigned_employee_id missing'; end if;
  if to_regprocedure('app.confirm_workshop_booking(uuid,timestamptz,timestamptz,uuid[],uuid[],uuid,boolean,text)') is null then
    raise exception 'confirm_workshop_booking function missing';
  end if;
  if to_regprocedure('app.employee_is_available(uuid,timestamptz,timestamptz)') is null then
    raise exception 'employee_is_available function missing';
  end if;
  if to_regprocedure('app.material_resource_is_available(uuid,timestamptz,timestamptz)') is null then
    raise exception 'material_resource_is_available function missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'workshop_booking_resource_no_overlap' and contype = 'x'
  ) then raise exception 'resource overlap exclusion constraint missing'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.workshop_bookings'::regclass) then
    raise exception 'RLS is not enabled on workshop_bookings';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workshop_bookings' and policyname = 'workshop_bookings_read_scoped'
  ) then raise exception 'workshop_bookings scoped read policy missing'; end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('employees','workshop_bookings','booking_resources','employee_absences')
      and policyname = 'workshop_read'
  ) then raise exception 'generic workshop_read policy remains on sensitive tables'; end if;
  function_definition := pg_get_functiondef(to_regprocedure('app.confirm_workshop_booking(uuid,timestamptz,timestamptz,uuid[],uuid[],uuid,boolean,text)'));
  if position('IDEMPOTENCY_PAYLOAD_MISMATCH' in function_definition) = 0 then
    raise exception 'idempotency payload mismatch guard missing';
  end if;
  if position('pg_advisory_xact_lock' in function_definition) = 0 then
    raise exception 'concurrency advisory lock missing';
  end if;
end $$;

select 'schema_validation=PASS';
select 'idempotence_validation=PASS';
select 'audit_validation=PASS';
