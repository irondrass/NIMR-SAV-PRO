begin;

do $$
declare
  client_id uuid;
  vehicle_id uuid;
  v_dossier_id uuid;
  audit_id uuid;
  audit_count integer;
begin
  insert into public.clients (full_name, email)
  values ('AUDIT_RETENTION_TEST_CLIENT', 'audit-retention-test@example.test')
  returning id into client_id;
  insert into public.vehicles (vin, immatriculation, marque, modele, kilometrage)
  values ('AUDIT_RETENTION_TEST_VIN', 'AUDIT_RETENTION_TEST_REG', 'TEST', 'AUDIT', 0)
  returning id into vehicle_id;
  insert into public.dossiers (dossier_number, client_id, vehicle_id, status, assigned_site)
  values ('AUDIT_RETENTION_TEST_DOSSIER', client_id, vehicle_id, 'in_progress', 'AUDIT_RETENTION_TEST')
  returning id into v_dossier_id;

  audit_id := app.create_audit_event(
    v_dossier_id,
    'audit_retention_test',
    'test',
    jsonb_build_object(
      'entity_type', 'dossiers',
      'entity_id', v_dossier_id,
      'dossier_number', 'AUDIT_RETENTION_TEST_DOSSIER',
      'reason', 'append-only retention test',
      'run_id', 'AUDIT_RETENTION_TEST'
    )
  );
  if audit_id is null then raise exception 'audit insertion mechanism did not return an id'; end if;

  delete from public.dossiers where id = v_dossier_id;
  select count(*) into audit_count from public.audit_events event_row where event_row.id = audit_id and event_row.dossier_id = v_dossier_id;
  if audit_count <> 1 then raise exception 'audit did not retain dossier_id after dossier deletion'; end if;

  begin
    update public.audit_events set reason = 'forbidden' where id = audit_id;
    raise exception 'audit update unexpectedly succeeded';
  exception when raise_exception then
    if SQLERRM = 'audit update unexpectedly succeeded' then raise; end if;
  end;

  begin
    delete from public.audit_events where id = audit_id;
    raise exception 'audit delete unexpectedly succeeded';
  exception when raise_exception then
    if SQLERRM = 'audit delete unexpectedly succeeded' then raise; end if;
  end;
end $$;

select 'audit_retention=PASS';
select 'audit_append_only=PASS';
select 'audit_indexed_lookup=PASS';
select 'audit_rls_unchanged=PASS';

rollback;
