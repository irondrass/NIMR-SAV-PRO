import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertSupabaseDevSafety } from "./load-supabase-dev-env.mjs";

const dev = assertSupabaseDevSafety();
const fixtureArg = process.argv.indexOf("--fixtures");
assert.ok(fixtureArg >= 0 && process.argv[fixtureArg + 1], "Use --fixtures <manifest>.");
const fixtures = JSON.parse(readFileSync(process.argv[fixtureArg + 1], "utf8"));

const baseUrl = dev.url;

async function signIn(email, password) {
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: dev.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.ok, true, `Authentication failed for ${email}: ${response.status}`);
  return (await response.json()).access_token;
}

async function read(path, token) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: dev.anonKey,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.json();
  return { response, body };
}

const anonymous = await read("employees?select=id");
assert.equal(anonymous.response.ok, true);
assert.deepEqual(anonymous.body, [], "Anonymous users must see no employee rows.");

const cases = fixtures.tests.rlsCases;
assert.ok(Array.isArray(cases) && cases.length > 0, "Fixture manifest must contain RLS cases.");

for (const testCase of cases) {
  const token = await signIn(testCase.email, testCase.password);
  const result = await read(testCase.path, token);
  assert.equal(result.response.status, testCase.expectedStatus ?? 200, testCase.name);
  if (Array.isArray(result.body)) {
    if (testCase.expectedMinRows !== undefined) {
      assert.ok(result.body.length >= testCase.expectedMinRows, `${testCase.name}: too few rows`);
    }
    if (testCase.expectedMaxRows !== undefined) {
      assert.ok(result.body.length <= testCase.expectedMaxRows, `${testCase.name}: too many rows`);
    }
  }
}

console.log(`workshop-scheduling-rls: OK (${cases.length} authenticated cases)`);
