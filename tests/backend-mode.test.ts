import assert from "node:assert/strict";
import {
  FORBIDDEN_FRONTEND_ENV_KEYS,
  PUBLIC_BACKEND_ENV_KEYS,
  describeBackendMode,
  resolveBackendRuntimeConfig,
  shouldAttemptSupabase,
} from "../src/data/backendMode";

console.log("Démarrage du test: backend-mode...");

const local = resolveBackendRuntimeConfig({});
assert.equal(local.mode, "local-only");
assert.equal(local.environment, "local");
assert.equal(local.backendEnabled, false);
assert.equal(local.authProvider, "local");
assert.equal(shouldAttemptSupabase(local), false);
assert.match(describeBackendMode(local), /aucun appel Supabase/i);

const ready = resolveBackendRuntimeConfig({ VITE_NIMR_BACKEND_MODE: "backend-ready", VITE_NIMR_ENV: "staging" });
assert.equal(ready.mode, "backend-ready");
assert.equal(ready.environment, "staging");
assert.equal(ready.backendReady, true);
assert.equal(ready.backendEnabled, false);
assert.equal(shouldAttemptSupabase(ready), false);

const incomplete = resolveBackendRuntimeConfig({ VITE_NIMR_BACKEND_MODE: "backend-enabled", VITE_NIMR_ENV: "staging" });
assert.equal(incomplete.backendEnabled, false);
assert.deepEqual(incomplete.missing, ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]);

const enabled = resolveBackendRuntimeConfig({
  VITE_NIMR_BACKEND_MODE: "backend-enabled",
  VITE_NIMR_ENV: "staging",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
});
assert.equal(enabled.backendEnabled, true);
assert.equal(enabled.supabaseConfigured, true);
assert.equal(enabled.authProvider, "supabase");
assert.equal(enabled.googleDriveStatus, "staging-ready");
assert.equal(shouldAttemptSupabase(enabled), true);

const forbidden = resolveBackendRuntimeConfig({
  VITE_NIMR_BACKEND_MODE: "backend-enabled",
  VITE_NIMR_ENV: "staging",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  SUPABASE_SERVICE_ROLE_KEY: "forbidden",
});
assert.equal(forbidden.backendEnabled, false);
assert.match(forbidden.warnings.join("\n"), /server-side/i);

const production = resolveBackendRuntimeConfig({
  VITE_NIMR_BACKEND_MODE: "backend-enabled",
  VITE_NIMR_ENV: "production",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
});
assert.equal(production.backendEnabled, false);
assert.equal(production.backendReady, false);
assert.equal(production.productionBlocked, true);
assert.match(describeBackendMode(production), /Production réelle non autorisée/i);

const legacy = resolveBackendRuntimeConfig({ VITE_BACKEND_MODE: "backend-ready" });
assert.equal(legacy.mode, "backend-ready");

assert.deepEqual(PUBLIC_BACKEND_ENV_KEYS, ["VITE_NIMR_BACKEND_MODE", "VITE_NIMR_ENV", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_BACKEND_MODE"]);
assert.ok(FORBIDDEN_FRONTEND_ENV_KEYS.includes("GOOGLE_REFRESH_TOKEN"));
assert.ok(FORBIDDEN_FRONTEND_ENV_KEYS.includes("GOOGLE_APPLICATION_CREDENTIALS"));

console.log("backend-mode.test.ts OK");
