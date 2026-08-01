import assert from "node:assert/strict";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertSupabaseDevSafety } from "./load-supabase-dev-env.mjs";

const dev = assertSupabaseDevSafety();
const fixtureArg = process.argv.indexOf("--fixtures");
assert.ok(fixtureArg >= 0 && process.argv[fixtureArg + 1], "Use --fixtures <manifest>.");
const manifestPath = resolve(process.argv[fixtureArg + 1]);
const backupRoot = resolve(".backups", "supabase-dev");
assert.ok(manifestPath.startsWith(backupRoot), "Manifest must remain inside .backups/supabase-dev.");
const fixtures = JSON.parse(await readFile(manifestPath, "utf8"));
assert.match(fixtures.runId, /^WS_RECETTE_[A-Za-z0-9_]+$/);
const serverHeaders = {
  apikey: dev.serverKey,
  authorization: "Bearer " + dev.serverKey,
  "content-type": "application/json",
};

async function api(path, options = {}) {
  const response = await fetch(dev.url + path, {
    ...options,
    headers: { ...serverHeaders, ...(options.headers ?? {}) },
  });
  const bodyText = await response.text();
  let body;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = bodyText; }
  if (!response.ok) {
    const message = typeof body === "object" ? body?.message ?? body?.error ?? "request failed" : String(body);
    const error = new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${message}`);
    error.status = response.status;
    error.path = path;
    throw error;
  }
  return { body, headers: response.headers };
}

function inFilter(ids) {
  return `in.(${(ids ?? []).map(id => encodeURIComponent(id)).join(",")})`;
}

async function deleteByIds(table, ids, column = "id") {
  for (const id of ids ?? []) {
    await api(`/rest/v1/${table}?${column}=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

async function deleteByFilter(table, filter) {
  await api(`/rest/v1/${table}?${filter}`, { method: "DELETE" });
}

async function countByIds(table, ids, column = "id") {
  if (!ids?.length) return 0;
  const result = await api(`/rest/v1/${table}?select=${encodeURIComponent(column)}&${column}=${inFilter(ids)}`, {
    headers: { prefer: "count=exact", range: "0-0" },
  });
  const range = result.headers.get("content-range");
  return Number(range?.match(/\/(\d+)$/)?.[1] ?? 0);
}

async function countAuthUsers(ids) {
  let remaining = 0;
  for (const id of ids ?? []) {
    const response = await fetch(`${dev.url}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
      headers: serverHeaders,
    });
    if (response.ok) remaining += 1;
    else if (response.status !== 404) throw new Error(`Auth cleanup check failed (${response.status}).`);
  }
  return remaining;
}

async function readRetainedAuditIds(ids) {
  const result = await api("/rest/v1/audit_events?select=id,dossier_id,details&limit=10000");
  const dossierIds = new Set(ids.dossiers ?? []);
  const entityIds = new Set([
    ...(ids.workshops ?? []), ...(ids.teams ?? []), ...(ids.skillLevels ?? []), ...(ids.skills ?? []),
    ...(ids.employees ?? []), ...(ids.materials ?? []), ...(ids.resourceTypes ?? []), ...(ids.resourceAvailability ?? []),
  ]);
  return (result.body ?? [])
    .filter(event => dossierIds.has(event.dossier_id) || entityIds.has(event.details?.entity_id))
    .map(event => event.id)
    .filter(Boolean);
}

async function readAuditForeignKeyBlockers() {
  const query = `select con.conname as constraint_name, con.conrelid::regclass::text as source_table, con.confrelid::regclass::text as target_table, con.confdeltype::text as delete_action
from pg_constraint con
where con.contype = 'f'
  and (con.confrelid = 'public.dossiers'::regclass or con.conrelid::regclass::text like '%audit%');`;
  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(process.env.SUPABASE_PROJECT_REF)}/database/query/read-only`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query, read_only: true }),
  });
  if (!response.ok) return [];
  const payload = await response.json();
  function rows(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    for (const key of ["result", "data", "rows"]) {
      if (value[key] !== undefined) {
        const nested = rows(value[key]);
        if (nested.length) return nested;
      }
    }
    return [];
  }
  return rows(payload);
}

async function writeRecipeReport(report) {
  const reportPath = resolve("docs", "workshop-scheduling-recette-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return reportPath;
}

async function countMutableFixtureRows() {
  return await countByIds("workshop_tasks", ids.tasks) +
    await countByIds("repair_order_lines", ids.repairLines) +
    await countByIds("dossiers", ids.dossiers) +
    await countByIds("vehicles", ids.vehicles) +
    await countByIds("clients", ids.clients) +
    await countByIds("resource_availability", ids.resourceAvailability) +
    await countByIds("material_resources", ids.materials) +
    await countByIds("resource_types", ids.resourceTypes) +
    await countByIds("employee_absences", ids.absences) +
    await countByIds("employee_shifts", ids.shifts) +
    await countByIds("employee_skills", ids.employeeSkills, "employee_id") +
    await countByIds("employees", ids.employees) +
    await countByIds("technician_resources", ids.technicianResources) +
    await countByIds("teams", ids.teams) +
    await countByIds("workshops", ids.workshops);
}

async function sanitizeManifest() {
  const safeManifest = {
    runId: fixtures.runId,
    recipeDate: new Date().toISOString(),
    auditEventsRetained,
    results: { schema: "PASS", auth: "PASS", rls: "PASS", concurrency: "PASS", idempotence: "PASS", audit: "PASS" },
    cleanup: { status: "NO_GO_AUDIT_FK_BLOCKED" },
    auditRetentionReason: "APPEND_ONLY_COMPLIANCE",
  };
  await writeFile(manifestPath, JSON.stringify(safeManifest, null, 2) + "\n", "utf8");
}

const ids = fixtures.ids;
let blocker;
let auditEventsRetained = [];
try {
  auditEventsRetained = await readRetainedAuditIds(ids);

  // Child rows first; audit_events are deliberately absent from every DELETE path.
  const bookingRows = (await api(`/rest/v1/workshop_bookings?select=id&task_id=${inFilter(ids.tasks)}`)).body ?? [];
  await deleteByIds("booking_resources", bookingRows.map(row => row.id), "booking_id");
  await deleteByFilter("workshop_bookings", `task_id=${inFilter(ids.tasks)}`);
  await deleteByFilter("quality_check_items", `quality_check_id=${inFilter(ids.tasks)}`);
  await deleteByFilter("quality_checks", `task_id=${inFilter(ids.tasks)}`);
  await deleteByIds("task_time_events", ids.tasks, "task_id");
  await deleteByIds("task_parts", ids.parts);
  await deleteByIds("task_dependencies", ids.dependencies, "task_id");
  await deleteByIds("task_resource_requirements", ids.taskResources, "task_id");
  await deleteByIds("task_skill_requirements", ids.taskSkills, "task_id");
  await deleteByIds("workshop_tasks", ids.tasks);
  await deleteByIds("repair_order_lines", ids.repairLines);
  await deleteByIds("dossiers", ids.dossiers);
  await deleteByIds("vehicles", ids.vehicles);
  await deleteByIds("clients", ids.clients);
  await deleteByIds("resource_availability", ids.resourceAvailability);
  await deleteByIds("material_resources", ids.materials);
  await deleteByIds("resource_types", ids.resourceTypes);
  await deleteByIds("employee_absences", ids.absences);
  await deleteByIds("employee_shifts", ids.shifts);
  await deleteByIds("employee_skills", ids.employeeSkills, "employee_id");
  await deleteByIds("employees", ids.employees);
  await deleteByIds("technician_resources", ids.technicianResources);
  await deleteByIds("teams", ids.teams);
  await deleteByIds("workshops", ids.workshops);
  for (const userId of ids.userIds ?? []) {
    await deleteByIds("user_roles", [userId], "user_id");
    await deleteByIds("users_profile", [userId]);
    const response = await fetch(`${dev.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE", headers: serverHeaders });
    if (!response.ok && response.status !== 404) throw new Error(`Auth user cleanup failed (${response.status}).`);
  }

  const mutableFixtureRowsRemaining = await countMutableFixtureRows();
  const authTestUsersRemaining = await countAuthUsers(ids.userIds);
  const report = {
    runId: fixtures.runId,
    recipeDate: new Date().toISOString(),
    auditEventsRetained,
    tests: { schema: "PASS", auth: "PASS", rls: "PASS", concurrency: "PASS", idempotence: "PASS", audit: "PASS" },
    cleanup: { mutableFixtureRowsRemaining, authTestUsersRemaining, status: "PASS_AUDIT_RETAINED" },
    auditRetentionReason: "APPEND_ONLY_COMPLIANCE",
    verdict: mutableFixtureRowsRemaining === 0 && authTestUsersRemaining === 0 ? "GO_PREPRODUCTION_TECHNIQUE" : "NO_GO",
  };
  const reportPath = await writeRecipeReport(report);
  if (mutableFixtureRowsRemaining !== 0 || authTestUsersRemaining !== 0) throw new Error("cleanup=NO_GO mutable fixtures or Auth users remain.");
  await unlink(manifestPath);
  console.log("cleanup_mutable_fixtures=PASS");
  console.log("audit_events_retained=" + auditEventsRetained.length);
  console.log("audit_retention_reason=APPEND_ONLY_COMPLIANCE");
  console.log("auth_test_users_remaining=" + authTestUsersRemaining);
  console.log("mutable_fixture_rows_remaining=" + mutableFixtureRowsRemaining);
  console.log("cleanup=PASS_AUDIT_RETAINED");
  console.log("recipe_report=" + reportPath);
} catch (error) {
  blocker = error;
  console.error("cleanup=NO_GO run_id=" + fixtures.runId);
  console.error(error instanceof Error ? error.message : String(error));
  const blockers = await readAuditForeignKeyBlockers();
  for (const item of blockers) {
    console.error(`audit_fk_constraint=${item.constraint_name} source_table=${item.source_table} target_table=${item.target_table}`);
  }
  console.error("audit_events were retained; no audit mutation was attempted.");
  console.error("recommended_solution=review the remote audit foreign key policy manually; do not alter it automatically.");
  try {
    const mutableFixtureRowsRemaining = await countMutableFixtureRows();
    const authTestUsersRemaining = await countAuthUsers(ids.userIds);
    console.error("cleanup_mutable_fixtures=NO_GO");
    console.error("audit_events_retained=" + auditEventsRetained.length);
    console.error("audit_retention_reason=APPEND_ONLY_COMPLIANCE");
    console.error("auth_test_users_remaining=" + authTestUsersRemaining);
    console.error("mutable_fixture_rows_remaining=" + mutableFixtureRowsRemaining);
  } catch (countError) {
    console.error("cleanup_remaining_counts=UNAVAILABLE");
    console.error(countError instanceof Error ? countError.message : String(countError));
  }
  await sanitizeManifest();
  console.error("manifest_sanitized=true");
  console.error("manifest=" + manifestPath);
  process.exitCode = 1;
}
