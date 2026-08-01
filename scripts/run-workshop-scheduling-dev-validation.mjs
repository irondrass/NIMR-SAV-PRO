import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { assertSupabaseDevSafety, loadSupabaseDevEnvironment } from "./load-supabase-dev-env.mjs";
import { redact, runCommand } from "./workshop-command-runner.mjs";
import { decideWorkshopBackup } from "./workshop-backup-policy.mjs";

loadSupabaseDevEnvironment();
let manifestPath;
let runId;

function run(command, args, options = {}) {
  return runCommand(command, args, options);
}

function runNode(script, args = []) {
  return run(process.execPath, [script, ...args]);
}

function dockerAvailable() {
  const result = run("docker", ["info", "--format", "{{.ServerVersion}}"], { allowFailure: true });
  return result.ok;
}

function parseMigrationList(output) {
  const match = output.match(/"local":"20260728000000","remote":"([^"]*)"/);
  assert.ok(match, "Supabase migration list did not return Workshop Scheduling status.");
  return { workshopMigrationApplied: Boolean(match[1]) };
}

async function inspectRemoteDevData(dev) {
  const headers = {
    apikey: dev.serverKey,
    authorization: `Bearer ${dev.serverKey}`,
  };
  const schemaResponse = await fetch(`${dev.url}/rest/v1/`, { headers });
  assert.equal(schemaResponse.ok, true, `Unable to inspect the DEV REST schema (${schemaResponse.status}).`);
  const schema = await schemaResponse.json();
  const tables = Object.keys(schema.paths ?? {})
    .map(path => path.replace(/^\//, ""))
    .filter(path => path && !path.includes("/") && !path.startsWith("rpc/"));
  let userDataRows = 0;
  for (const table of tables) {
    const response = await fetch(`${dev.url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, {
      headers: { ...headers, prefer: "count=exact", range: "0-0" },
    });
    assert.equal(response.ok, true, `Unable to inspect the DEV table ${table} (${response.status}).`);
    const contentRange = response.headers.get("content-range");
    const count = contentRange?.match(/\/(\d+)$/)?.[1];
    assert.ok(count !== undefined, `DEV table ${table} did not return an exact row count.`);
    userDataRows += Number(count);
  }
  return { userDataRows };
}

function showMigrationPlan(dryRunOutput) {
  const lines = dryRunOutput.split(/\r?\n/).filter(line => /\d{14}/.test(line));
  console.log(`migrations_to_apply=${lines.length ? lines.join(" | ") : "none reported"}`);
}

async function managementReadOnlyQuery(dev, query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(process.env.SUPABASE_PROJECT_REF)}/database/query/read-only`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, read_only: true }),
  });
  if (!response.ok) {
    throw new Error(`Management API read-only schema query failed with status ${response.status}.`);
  }
  return response.json();
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["result", "data", "rows"]) {
    if (payload && typeof payload === "object" && payload[key] !== undefined) {
      const rows = extractRows(payload[key]);
      if (rows) return rows;
    }
  }
  return [];
}

async function validateRemoteSchema(dev) {
  const query = await readFile("supabase/tests/workshop_scheduling_schema_read_only.sql", "utf8");
  const payload = await managementReadOnlyQuery(dev, query);
  return extractRows(payload)
    .map(row => row?.missing_object)
    .filter(Boolean);
}

async function assertRemoteSchemaValid(dev) {
  const missingObjects = await validateRemoteSchema(dev);
  if (missingObjects.length) {
    console.log("migration_state=APPLIED_INVALID");
    for (const objectName of missingObjects) console.log(`missing_object=${objectName}`);
    throw new Error("NO GO: remote Workshop Scheduling schema is incomplete.");
  }
  console.log("migration_state=APPLIED_VALID");
}

try {
  runNode("scripts/check-supabase-dev-safety.mjs");
  const dev = assertSupabaseDevSafety();
  console.log("dev_project_ref=" + dev.url.replace(/^https?:\/\//, "").slice(0, 3) + "***");
  run("npx", ["supabase", "--version"]);
  run("npx", ["supabase", "link", "--project-ref", process.env.SUPABASE_PROJECT_REF]);

  runId = "WS_VALIDATION_" + new Date().toISOString().replace(/\D/g, "").slice(0, 14) + "_" + randomBytes(3).toString("hex");
  const backupDir = resolve(".backups", "supabase-dev");
  await mkdir(backupDir, { recursive: true });
  const schemaBackup = resolve(backupDir, "schema-" + runId + ".sql");
  const dataBackup = resolve(backupDir, "data-" + runId + ".sql");
  const migrationList = run("npx", ["supabase", "migration", "list"]);
  const migrationStatus = parseMigrationList(migrationList);
  if (migrationStatus.workshopMigrationApplied) console.log("migration_state=APPLIED_TRACKED");
  const hasDocker = dockerAvailable();
  const remoteData = hasDocker || migrationStatus.workshopMigrationApplied ? { userDataRows: 0 } : await inspectRemoteDevData(dev);
  const backupDecision = decideWorkshopBackup({
    dockerAvailable: hasDocker,
    environment: process.env.SUPABASE_ENVIRONMENT,
    productionExists: process.env.SUPABASE_PRODUCTION_EXISTS,
    ...migrationStatus,
    ...remoteData,
  });
  if (backupDecision.mode === "applied_tracked") {
    await assertRemoteSchemaValid(dev);
  } else if (backupDecision.mode === "dump") {
    run("npx", ["supabase", "db", "dump", "--linked", "--schema", "public", "--file", schemaBackup]);
    run("npx", ["supabase", "db", "dump", "--linked", "--data-only", "--schema", "public", "--file", dataBackup]);
    console.log("backup=DUMPED");
    const dryRun = run("npx", ["supabase", "db", "push", "--dry-run"]);
    showMigrationPlan(dryRun);
    run("npx", ["supabase", "db", "push", "--yes"]);
    await assertRemoteSchemaValid(dev);
  } else {
    console.log(backupDecision.report);
    const dryRun = run("npx", ["supabase", "db", "push", "--dry-run"]);
    showMigrationPlan(dryRun);
    run("npx", ["supabase", "db", "push", "--yes"]);
    await assertRemoteSchemaValid(dev);
  }

  const fixtureOutput = runNode("scripts/setup-workshop-scheduling-dev-fixtures.mjs");
  const manifestMatch = fixtureOutput.match(/manifest=(.+)/);
  assert.ok(manifestMatch, "Bootstrap did not return a manifest path.");
  manifestPath = manifestMatch[1].trim();
  runNode("scripts/test-workshop-scheduling-rls.mjs", ["--fixtures", manifestPath]);
  runNode("scripts/test-workshop-scheduling-concurrency.mjs", ["--fixtures", manifestPath]);
  runNode("scripts/test-audit-retention-dev.mjs");
  run("npm", ["run", "lint"]);
  run("npm", ["run", "build"]);
  console.log("connected_frontend=SKIPPED (no remote Playwright profile configured)");
  console.log("validation=PASS");
} catch (error) {
  console.error("validation=FAIL");
  console.error(redact(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  if (manifestPath) {
    try {
      runNode("scripts/cleanup-workshop-scheduling-dev-fixtures.mjs", ["--fixtures", manifestPath]);
    } catch (error) {
      console.error("cleanup=FAIL manifest_preserved=" + manifestPath);
      console.error(redact(error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    }
  }
}
