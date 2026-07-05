import assert from "node:assert/strict";
import fs from "node:fs";
import { checkLocalExportSchema } from "../scripts/export-local-data-schema-check";

console.log("Démarrage du test: backend-migration-strategy...");

const valid = checkLocalExportSchema({
  dossiers: [],
  vehicles: [],
  clients: [],
  workshopTasks: [],
  planning: [],
  qc: [],
  delivery: [],
  audit: [],
  fileAttachments: [],
});
assert.equal(valid.ok, true);
assert.equal(valid.uploadAttempted, false);

const invalid = checkLocalExportSchema({ dossiers: [] });
assert.equal(invalid.ok, false);
assert.ok(invalid.missing.includes("vehicles"));

const doc = fs.readFileSync("docs/backend-v2-migration-strategy.md", "utf8");
assert.match(doc, /dry-run/i);
assert.match(doc, /mapping/i);
assert.match(doc, /rollback/i);
assert.match(doc, /protocole pilote|Pilot Protocol/i);
assert.match(doc, /No real client data|No GO real migration|NO GO real migration/i);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(packageJson.scripts["backend:v2:check"], "node scripts/backend-v2-check.mjs");

const checkScript = fs.readFileSync("scripts/backend-v2-check.mjs", "utf8");
assert.match(checkScript, /dry-run OK/);
assert.match(checkScript, /upload: skipped by design/);
assert.doesNotMatch(checkScript, /supabase\s+db\s+push|insert\s+into\s+public/i);

console.log("backend-migration-strategy.test.ts OK");
