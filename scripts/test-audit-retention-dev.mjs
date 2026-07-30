import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertSupabaseDevSafety, loadSupabaseDevEnvironment } from "./load-supabase-dev-env.mjs";

loadSupabaseDevEnvironment();
assertSupabaseDevSafety();
const query = await readFile("supabase/tests/audit_events_retention.test.sql", "utf8");
const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(process.env.SUPABASE_PROJECT_REF)}/database/query`, {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify({ query, read_only: false }),
});
assert.equal(response.ok, true, `Audit retention PostgreSQL test failed (${response.status}).`);
console.log("audit-events-retention: OK");
