import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const foundation = readFileSync("supabase/migrations/20260704000000_backend_v2_foundation.sql", "utf8");
const staging = readFileSync("supabase/migrations/20260705000000_backend_v2_b_staging_activation.sql", "utf8");
const workshop = readFileSync("supabase/migrations/20260728000000_workshop_scheduling.sql", "utf8");
const auditEvolution = readFileSync("supabase/migrations/20260730150000_decouple_audit_events_from_mutable_entities.sql", "utf8");

assert.match(foundation, /create table if not exists public\.audit_events/);
assert.match(workshop, /create table if not exists public\.workshops/);
assert.match(auditEvolution, /drop constraint if exists audit_events_dossier_id_fkey/);
assert.match(auditEvolution, /drop constraint if exists audit_events_actor_id_fkey/);
assert.match(auditEvolution, /add column if not exists entity_type/);
assert.match(auditEvolution, /create index if not exists audit_events_dossier_id_idx/);
assert.match(auditEvolution, /create or replace function app\.create_audit_event/);
assert.doesNotMatch(auditEvolution, /truncate\s/i);
assert.doesNotMatch(auditEvolution, /drop table\s/i);
assert.doesNotMatch(auditEvolution, /disable row level security/i);
assert.match(staging, /create table if not exists public\.audit_logs/);
console.log("audit migration compatibility: clean ordered history and previous migrations supported");
