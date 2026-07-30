-- Audit history remains immutable and independently retainable after business-row deletion.
alter table public.audit_events
  drop constraint if exists audit_events_dossier_id_fkey,
  drop constraint if exists audit_events_actor_id_fkey;

alter table public.audit_events
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists dossier_number text,
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb,
  add column if not exists reason text,
  add column if not exists run_id text,
  add column if not exists context jsonb;

create index if not exists audit_events_dossier_id_idx on public.audit_events (dossier_id);
create index if not exists audit_events_entity_id_idx on public.audit_events (entity_id);
create index if not exists audit_events_run_id_idx on public.audit_events (run_id);

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
  insert into public.audit_events (
    dossier_id, actor_id, role, action, category, details,
    entity_type, entity_id, dossier_number, old_value, new_value, reason, run_id, context
  )
  values (
    p_dossier_id,
    auth.uid(),
    app.current_backend_role(),
    p_action,
    p_category,
    coalesce(p_details, '{}'::jsonb),
    p_details->>'entity_type',
    nullif(p_details->>'entity_id', '')::uuid,
    p_details->>'dossier_number',
    p_details->'old_value',
    p_details->'new_value',
    p_details->>'reason',
    coalesce(p_details->>'run_id', current_setting('app.run_id', true)),
    p_details
  )
  returning id into event_id;
  return event_id;
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
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
begin
  v_entity_id := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  insert into public.audit_events (
    actor_id, role, action, category, details, entity_type, entity_id,
    old_value, new_value, run_id, context
  )
  values (
    auth.uid(),
    coalesce(app.current_backend_role(), 'UNKNOWN'),
    lower(tg_op),
    'workshop_configuration',
    jsonb_build_object('table', tg_table_name, 'entity_id', v_entity_id, 'old_value', v_old, 'new_value', v_new),
    tg_table_name,
    v_entity_id,
    v_old,
    v_new,
    current_setting('app.run_id', true),
    jsonb_build_object('table', tg_table_name, 'run_id', current_setting('app.run_id', true))
  );
  return coalesce(new, old);
end;
$$;
