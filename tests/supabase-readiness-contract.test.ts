import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage du test: supabase-readiness-contract...");

const doc = fs.readFileSync("docs/supabase-readiness-lot7.md", "utf8");
const requiredTables = [
  "users",
  "user_roles",
  "vehicles",
  "clients",
  "dossiers",
  "repair_order_lines",
  "workshop_tasks",
  "workshop_reservations",
  "technician_resources",
  "quality_controls",
  "deliveries",
  "audit_events",
  "file_attachments",
  "app_settings",
];

for (const table of requiredTables) {
  assert.ok(doc.includes(table), `Table future manquante: ${table}`);
}

assert.match(doc, /RLS/i);
assert.match(doc, /NO GO production/i);
assert.match(doc, /aucun client Supabase actif/i);
assert.doesNotMatch(doc, /SUPABASE_URL\s*=/);
assert.doesNotMatch(doc, /SUPABASE_ANON_KEY\s*=/);

console.log("supabase-readiness-contract.test.ts OK");
