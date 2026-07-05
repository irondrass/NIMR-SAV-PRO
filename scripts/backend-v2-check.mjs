import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

const requiredEnvKeys = [
  "VITE_NIMR_BACKEND_MODE",
  "VITE_NIMR_ENV",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
];

const requiredTables = [
  "profiles",
  "dossiers",
  "vehicles",
  "workshop_tasks",
  "reservations",
  "audit_logs",
  "file_metadata",
];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function parseEnvFile(file) {
  if (!fs.existsSync(path.join(root, file))) return {};
  const env = {};
  for (const line of read(file).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function gitOutput(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const report = [];

const envExample = parseEnvFile(".env.example");
for (const key of requiredEnvKeys) {
  assert(Object.prototype.hasOwnProperty.call(envExample, key), `.env.example missing ${key}`);
}
assert(envExample.VITE_NIMR_BACKEND_MODE === "local-only", ".env.example must keep local-only as default");
assert(envExample.VITE_NIMR_ENV === "local", ".env.example must keep local as default environment");
report.push("env-example: local-only default OK");

const localEnv = { ...process.env, ...parseEnvFile(".env.local") };
const requestedMode = localEnv.VITE_NIMR_BACKEND_MODE || localEnv.VITE_BACKEND_MODE || "local-only";
const requestedEnv = localEnv.VITE_NIMR_ENV || "local";
if (requestedMode === "backend-enabled") {
  assert(Boolean(localEnv.VITE_SUPABASE_URL), "backend-enabled requires VITE_SUPABASE_URL");
  assert(Boolean(localEnv.VITE_SUPABASE_ANON_KEY), "backend-enabled requires VITE_SUPABASE_ANON_KEY");
}
assert(requestedEnv !== "production", "VITE_NIMR_ENV=production is blocked for Backend v2-B");
report.push(`runtime-env: ${requestedMode}/${requestedEnv} dry-run OK`);

let trackedEnvLocal = "";
try {
  trackedEnvLocal = gitOutput(["ls-files", ".env.local"]);
} catch {
  trackedEnvLocal = "";
}
assert(!trackedEnvLocal, ".env.local must not be tracked by Git");
report.push("git-ignore: .env.local not tracked OK");

const migrations = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter(file => file.endsWith(".sql"))
  .map(file => read(path.join("supabase", "migrations", file)))
  .join("\n");
for (const table of requiredTables) {
  assert(new RegExp(`create table if not exists public\\.${table}`).test(migrations), `missing staging table ${table}`);
  assert(new RegExp(`alter table public\\.${table} enable row level security`).test(migrations), `missing RLS for ${table}`);
}
assert(/audit_logs are append-only/.test(migrations), "audit_logs append-only trigger missing");
assert(!/public_url|drive_public_url|download_url text/i.test(migrations), "file metadata must not expose public Drive URLs");
report.push("supabase-schema: staging tables and RLS OK");

const backendModeSource = read(path.join("src", "data", "backendMode.ts"));
assert(/VITE_NIMR_BACKEND_MODE/.test(backendModeSource), "runtime config must support VITE_NIMR_BACKEND_MODE");
assert(/VITE_NIMR_ENV/.test(backendModeSource), "runtime config must support VITE_NIMR_ENV");
assert(/productionBlocked/.test(backendModeSource), "runtime config must block production");
report.push("runtime-guards: production block OK");

const edgeSources = ["drive-create-upload-session", "drive-confirm-upload", "drive-download", "drive-delete-metadata"]
  .map(fn => read(path.join("supabase", "functions", fn, "index.ts")))
  .join("\n");
assert(/prepared-only/.test(edgeSources), "Edge Functions must remain prepared-only");
assert(/audit_logs/.test(edgeSources), "file access audit requirement missing");
assert(!/drive\.google\.com|googleapis\.com\/drive/i.test(edgeSources), "Edge Functions must not expose direct Drive URLs");
report.push("google-drive-edge: prepared-only contract OK");

execFileSync("node", ["scripts/check-no-secrets.mjs"], { cwd: root, stdio: "pipe" });
report.push("secrets: scanner OK");

console.log("backend:v2:check dry-run OK");
for (const line of report) console.log(`- ${line}`);
console.log("- upload: skipped by design");
