import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage du test: rls-policy-contract...");

const sql = fs.readdirSync("supabase/migrations")
  .filter(file => file.endsWith(".sql"))
  .map(file => fs.readFileSync(`supabase/migrations/${file}`, "utf8"))
  .join("\n");
const tables = [
  "profiles",
  "users_profile",
  "user_roles",
  "clients",
  "vehicles",
  "dossiers",
  "repair_order_lines",
  "workshop_tasks",
  "technician_resources",
  "reservations",
  "workshop_reservations",
  "quality_controls",
  "deliveries",
  "audit_logs",
  "audit_events",
  "file_metadata",
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
assert.match(sql, /audit_logs are append-only/);
assert.match(sql, /audit_logs_no_frontend_insert_v2b/);
assert.match(sql, /file_metadata_select_by_dossier_v2b/);
assert.doesNotMatch(sql, /public_url|drive_public_url|download_url text/i);

console.log("rls-policy-contract.test.ts OK");
