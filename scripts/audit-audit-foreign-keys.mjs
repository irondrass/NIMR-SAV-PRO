import assert from "node:assert/strict";
import { assertSupabaseDevSafety, loadSupabaseDevEnvironment } from "./load-supabase-dev-env.mjs";

loadSupabaseDevEnvironment();
const dev = assertSupabaseDevSafety();
const query = `select
  con.conname as constraint_name,
  source_att.attname as source_column,
  con.conrelid::regclass::text as source_table,
  target_att.attname as target_column,
  con.confrelid::regclass::text as target_table,
  case con.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' else con.confdeltype::text end as delete_action
from pg_constraint con
join unnest(con.conkey) with ordinality source_keys(attnum, position) on true
join pg_attribute source_att on source_att.attrelid = con.conrelid and source_att.attnum = source_keys.attnum
join unnest(con.confkey) with ordinality target_keys(attnum, position) on target_keys.position = source_keys.position
join pg_attribute target_att on target_att.attrelid = con.confrelid and target_att.attnum = target_keys.attnum
where con.contype = 'f'
  and (con.conrelid::regclass::text like '%audit%' or con.confrelid::regclass::text in ('public.dossiers','public.workshop_tasks','public.profiles','public.employees','public.workshops','public.vehicles','public.clients'))
order by source_table, constraint_name, source_column;`;
const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(process.env.SUPABASE_PROJECT_REF)}/database/query/read-only`, {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify({ query, read_only: true }),
});
assert.equal(response.ok, true, `Management API read-only constraint audit failed (${response.status}).`);
const payload = await response.json();
const rows = Array.isArray(payload) ? payload : payload?.result ?? payload?.data ?? payload?.rows ?? [];
for (const row of rows) {
  console.log(`constraint=${row.constraint_name} source_column=${row.source_column} source_table=${row.source_table} target_column=${row.target_column} target_table=${row.target_table} delete_action=${row.delete_action}`);
}
console.log(`audit_fk_count=${rows.length}`);
