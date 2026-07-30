import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(".env.supabase-dev.local");
const REQUIRED_SAFETY_VARIABLES = [
  "SUPABASE_ENVIRONMENT",
  "ALLOW_SUPABASE_DEV_TESTS",
  "WORKSHOP_ALLOW_MUTATING_DEV_TESTS",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_URL",
  "SUPABASE_PROD_PROJECT_REF",
];

export function loadSupabaseDevEnvironment() {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

export function assertSupabaseDevSafety() {
  loadSupabaseDevEnvironment();
  for (const name of REQUIRED_SAFETY_VARIABLES) {
    assert.ok(process.env[name]?.trim(), `${name} is required`);
  }
  assert.equal(process.env.SUPABASE_ENVIRONMENT, "development");
  assert.equal(process.env.ALLOW_SUPABASE_DEV_TESTS, "YES");
  assert.equal(process.env.WORKSHOP_ALLOW_MUTATING_DEV_TESTS, "true");

  const projectRef = process.env.SUPABASE_PROJECT_REF.trim();
  const productionRef = process.env.SUPABASE_PROD_PROJECT_REF.trim();
  const url = new URL(process.env.SUPABASE_URL);
  const clientKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(clientKey, "SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is required");
  assert.ok(serverKey, "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required");
  const productionPattern = /(^|[-_.])(prod|production)([-_.]|$)/i;

  assert.notEqual(projectRef, productionRef, "DEV and production project refs must differ.");
  const localUrl = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  assert.equal(localUrl || url.protocol === "https:", true, "Supabase DEV must use HTTPS unless local.");
  assert.equal(
    localUrl || (url.hostname === `${projectRef}.supabase.co` && url.hostname.endsWith(".supabase.co")),
    true,
    "SUPABASE_URL does not match SUPABASE_PROJECT_REF.",
  );
  assert.equal(productionPattern.test(projectRef), false, "DEV project ref contains a production marker.");
  assert.equal(productionPattern.test(url.hostname), false, "DEV URL contains a production marker.");

  return {
    url: process.env.SUPABASE_URL.replace(/\/$/, ""),
    anonKey: clientKey,
    serverKey,
  };
}
