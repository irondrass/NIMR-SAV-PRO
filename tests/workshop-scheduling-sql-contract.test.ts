import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL("../supabase/migrations/20260728000000_workshop_scheduling.sql", import.meta.url));
const sql = readFileSync(migrationPath, "utf8");

console.log("Running workshop scheduling SQL contract tests...");

for (const table of [
  "workshops",
  "employees",
  "employee_skills",
  "material_resources",
  "task_templates",
  "task_dependencies",
  "task_parts",
  "workshop_bookings",
  "booking_resources",
  "task_time_events",
  "quality_checks",
  "workshop_settings",
  "notifications",
  "sync_operations",
  "sync_conflicts",
]) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`), `${table} table must exist`);
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must have RLS`);
}

assert.match(sql, /create extension if not exists btree_gist/);
assert.match(sql, /workshop_booking_task_no_overlap/);
assert.match(sql, /workshop_booking_vehicle_no_overlap/);
assert.match(sql, /workshop_booking_resource_no_overlap/);
assert.match(sql, /pg_advisory_xact_lock/);
assert.match(sql, /operation_id uuid not null unique/);
assert.match(sql, /add column if not exists workshop_id uuid references public\.workshops/);
assert.match(sql, /add column if not exists assigned_employee_id uuid references public\.employees/);
assert.match(sql, /create or replace function app\.confirm_workshop_booking/);
assert.match(sql, /create or replace function app\.employee_is_available/);
assert.match(sql, /create or replace function app\.material_resource_is_available/);
assert.match(sql, /IDEMPOTENCY_PAYLOAD_MISMATCH/);
assert.match(sql, /TASK_DEPENDENCY_NOT_READY/);
assert.match(sql, /REQUIRED_MATERIAL_QUANTITY_NOT_MET/);
assert.match(sql, /create or replace function public\.confirm_workshop_booking/);
assert.match(sql, /when exclusion_violation/);
assert.match(sql, /CONCURRENT_BOOKING_CONFLICT/);
assert.match(sql, /create or replace function app\.record_task_time_event/);
assert.match(sql, /create or replace function public\.save_workshop_scheduling_settings/);
assert.match(sql, /app\.create_audit_event/);
assert.match(sql, /revoke all on function app\.confirm_workshop_booking/);
assert.match(sql, /grant execute on function public\.confirm_workshop_booking/);
assert.match(sql, /create policy workshop_bookings_read_scoped/);
assert.match(sql, /create policy employees_read_scoped/);
assert.match(sql, /create policy sync_conflicts_own/);
assert.match(sql, /TASK_ASSIGNMENT_REQUIRED/);
assert.match(sql, /drop policy if exists audit_events_select_business/);
assert.match(sql, /drop policy if exists file_attachments_insert_authorized/);
assert.doesNotMatch(sql, /create policy workshop_read/);
assert.doesNotMatch(sql, /CONTROLE_QUALITE|ADMINISTRATEUR|MAGASIN_PIECES/);

console.log("workshop-scheduling-sql-contract: OK");
