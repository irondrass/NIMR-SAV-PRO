import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage du test: rls-policy-contract...");

const sql = fs.readFileSync("supabase/migrations/20260704000000_backend_v2_foundation.sql", "utf8");
const tables = [
  "users_profile",
  "user_roles",
  "clients",
  "vehicles",
  "dossiers",
  "repair_order_lines",
  "workshop_tasks",
  "technician_resources",
  "workshop_reservations",
  "quality_controls",
  "deliveries",
  "audit_events",
  "file_attachments",
  "app_settings",
];

for (const table of tables) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
}

for (const fn of ["validate_qc", "create_delivery", "reserve_workshop_tasks", "assign_task_resource", "create_audit_event"]) {
  assert.match(sql, new RegExp(`function app\\.${fn}`));
}

assert.match(sql, /QC conforme forbidden while workshop tasks are open/);
assert.match(sql, /Delivery forbidden before conforming QC/);
assert.match(sql, /Planning collision detected/);
assert.match(sql, /Technician incompatible with task specialty/);
assert.match(sql, /audit_events are append-only/);

console.log("rls-policy-contract.test.ts OK");
