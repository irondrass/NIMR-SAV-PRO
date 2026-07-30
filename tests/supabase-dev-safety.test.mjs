import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/check-supabase-dev-safety.mjs");

function run(overrides = {}) {
  const environment = {
    ...process.env,
    SUPABASE_ENVIRONMENT: "development",
    ALLOW_SUPABASE_DEV_TESTS: "YES",
    WORKSHOP_ALLOW_MUTATING_DEV_TESTS: "true",
    SUPABASE_PROJECT_REF: "devproject123456789012",
    SUPABASE_PROD_PROJECT_REF: "prodproject123456789012",
    SUPABASE_ACCESS_TOKEN: "token-test-only",
    SUPABASE_DB_PASSWORD: "password-test-only",
    SUPABASE_URL: "https://devproject123456789012.supabase.co",
    SUPABASE_ANON_KEY: "anon-test-only",
    SUPABASE_SERVICE_ROLE_KEY: "service-test-only",
    ...overrides,
  };
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: environment,
    encoding: "utf8",
  });
  return result.stdout + result.stderr;
}

assert.match(run(), /preflight=PASS/);
assert.match(run({ SUPABASE_PROD_PROJECT_REF: "devproject123456789012" }), /preflight=FAIL/);
assert.match(run({ SUPABASE_URL: "https://otherproject123456789012.supabase.co" }), /preflight=FAIL/);
assert.match(run({ SUPABASE_ENVIRONMENT: "production" }), /preflight=FAIL/);
assert.match(run({ WORKSHOP_ALLOW_MUTATING_DEV_TESTS: "" }), /preflight=FAIL/);
assert.match(run({ SUPABASE_URL: "http://127.0.0.1:54321" }), /preflight=PASS/);
assert.match(run({ SUPABASE_URL: "https://example.com" }), /preflight=FAIL/);

const output = run();
assert.equal(output.includes("token-test-only"), false);
assert.equal(output.includes("service-test-only"), false);
assert.equal(output.includes("password-test-only"), false);

console.log("supabase-dev-safety: OK");
