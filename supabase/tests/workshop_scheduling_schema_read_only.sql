with checks(object_name, present) as (
  select * from (values
    ('table:public.workshops', to_regclass('public.workshops') is not null),
    ('table:public.employees', to_regclass('public.employees') is not null),
    ('table:public.material_resources', to_regclass('public.material_resources') is not null),
    ('table:public.workshop_bookings', to_regclass('public.workshop_bookings') is not null),
    ('table:public.booking_resources', to_regclass('public.booking_resources') is not null),
    ('audit_fk:public.audit_events.dossier_id_absent', not exists (select 1 from pg_constraint where conname = 'audit_events_dossier_id_fkey')),
    ('audit_fk:public.audit_events.actor_id_absent', not exists (select 1 from pg_constraint where conname = 'audit_events_actor_id_fkey')),
    ('audit_column:public.audit_events.entity_type', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_events' and column_name = 'entity_type')),
    ('audit_column:public.audit_events.entity_id', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_events' and column_name = 'entity_id')),
    ('audit_column:public.audit_events.old_value', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_events' and column_name = 'old_value')),
    ('audit_column:public.audit_events.new_value', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_events' and column_name = 'new_value')),
    ('audit_column:public.audit_events.run_id', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'audit_events' and column_name = 'run_id')),
    ('audit_index:public.audit_events.dossier_id', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'audit_events_dossier_id_idx')),
    ('column:public.workshop_tasks.workshop_id', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workshop_tasks' and column_name = 'workshop_id')),
    ('column:public.workshop_tasks.assigned_employee_id', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workshop_tasks' and column_name = 'assigned_employee_id')),
    ('function:app.confirm_workshop_booking', to_regprocedure('app.confirm_workshop_booking(uuid,timestamptz,timestamptz,uuid[],uuid[],uuid,boolean,text)') is not null),
    ('function:app.employee_is_available', to_regprocedure('app.employee_is_available(uuid,timestamptz,timestamptz)') is not null),
    ('function:app.material_resource_is_available', to_regprocedure('app.material_resource_is_available(uuid,timestamptz,timestamptz)') is not null),
    ('constraint:workshop_booking_resource_no_overlap[gist]', exists (select 1 from pg_constraint where conname = 'workshop_booking_resource_no_overlap' and contype = 'x')),
    ('rls:public.workshop_bookings', coalesce((select relrowsecurity from pg_class where oid = 'public.workshop_bookings'::regclass), false)),
    ('rls:public.booking_resources', coalesce((select relrowsecurity from pg_class where oid = 'public.booking_resources'::regclass), false)),
    ('rls:public.employees', coalesce((select relrowsecurity from pg_class where oid = 'public.employees'::regclass), false)),
    ('rls:public.employee_absences', coalesce((select relrowsecurity from pg_class where oid = 'public.employee_absences'::regclass), false)),
    ('policy:workshop_bookings_read_scoped', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workshop_bookings' and policyname = 'workshop_bookings_read_scoped')),
    ('policy:booking_resources_read_scoped', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_resources' and policyname = 'booking_resources_read_scoped')),
    ('policy:employees_read_scoped', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employees' and policyname = 'employees_read_scoped')),
    ('policy:employee_absences_read_scoped', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employee_absences' and policyname = 'employee_absences_read_scoped')),
    ('policy:legacy_workshop_read_absent', not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('employees','workshop_bookings','booking_resources','employee_absences') and policyname = 'workshop_read')),
    ('guard:IDEMPOTENCY_PAYLOAD_MISMATCH', position('IDEMPOTENCY_PAYLOAD_MISMATCH' in pg_get_functiondef(to_regprocedure('app.confirm_workshop_booking(uuid,timestamptz,timestamptz,uuid[],uuid[],uuid,boolean,text)'))) > 0),
    ('guard:pg_advisory_xact_lock', position('pg_advisory_xact_lock' in pg_get_functiondef(to_regprocedure('app.confirm_workshop_booking(uuid,timestamptz,timestamptz,uuid[],uuid[],uuid,boolean,text)'))) > 0),
    ('audit:function:app.create_audit_event', to_regprocedure('app.create_audit_event(uuid,text,text,jsonb)') is not null),
    ('audit:function:app.audit_workshop_configuration', to_regprocedure('app.audit_workshop_configuration()') is not null),
    ('audit:function:app.block_audit_event_mutation', to_regprocedure('app.block_audit_event_mutation()') is not null),
    ('audit:function:app.create_audit_log', to_regprocedure('app.create_audit_log(uuid,text,text,jsonb)') is not null),
    ('audit:function:app.block_audit_log_mutation', to_regprocedure('app.block_audit_log_mutation()') is not null),
    ('audit:trigger:audit_events_append_only', exists (select 1 from pg_trigger where tgname = 'audit_events_append_only' and not tgisinternal)),
    ('audit:trigger:audit_logs_append_only', exists (select 1 from pg_trigger where tgname = 'audit_logs_append_only' and not tgisinternal)),
    ('audit:trigger:audit_workshop_configuration', exists (select 1 from pg_trigger where tgname = 'audit_workshop_configuration' and not tgisinternal))
  ) as expected(object_name, present)
)
select object_name as missing_object
from checks
where not present
order by object_name;
