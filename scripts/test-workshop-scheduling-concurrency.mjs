import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertSupabaseDevSafety } from "./load-supabase-dev-env.mjs";

const dev = assertSupabaseDevSafety();
const fixtureArg = process.argv.indexOf("--fixtures");
assert.ok(fixtureArg >= 0 && process.argv[fixtureArg + 1], "Use --fixtures <manifest>.");
const fixtures = JSON.parse(readFileSync(process.argv[fixtureArg + 1], "utf8"));

const baseUrl = dev.url;
const taskIds = fixtures.tests.taskIds;
assert.equal(taskIds.length, 2, "WORKSHOP_TASK_IDS must contain two different task ids.");
assert.notEqual(taskIds[0], taskIds[1], "Concurrency requires two different tasks.");

async function signIn(email, password) {
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: dev.anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  assert.equal(response.ok, true, `Authentication failed: ${response.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

async function confirm(token, taskId, operationId, overrides = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/confirm_workshop_booking`, {
    method: "POST",
    headers: {
      apikey: dev.anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_task_id: taskId,
      p_start_at: fixtures.tests.slot.start,
      p_end_at: fixtures.tests.slot.end,
      p_employee_ids: fixtures.tests.employeeIds,
      p_material_resource_ids: fixtures.tests.materialResourceIds,
      p_operation_id: operationId,
      p_overbook: false,
      p_reason: null,
      ...overrides,
    }),
  });
  const body = await response.json();
  return { response, body };
}

const chefA = fixtures.users.chefA;
const chefB = fixtures.users.chefB;
assert.ok(chefA?.email && chefA?.password, "Fixture manifest is missing Chef A credentials.");
assert.ok(chefB?.email && chefB?.password, "Fixture manifest is missing Chef B credentials.");

const [tokenA, tokenB] = await Promise.all([
  signIn(chefA.email, chefA.password),
  signIn(chefB.email, chefB.password),
]);
assert.notEqual(tokenA, tokenB, "Concurrency requires two distinct Auth sessions.");
const firstOperationId = crypto.randomUUID();
const secondOperationId = crypto.randomUUID();
const concurrent = await Promise.all([
  confirm(tokenA, taskIds[0], firstOperationId)
    .then(result => ({ ...result, operationId: firstOperationId, taskId: taskIds[0], token: tokenA })),
  confirm(tokenB, taskIds[1], secondOperationId)
    .then(result => ({ ...result, operationId: secondOperationId, taskId: taskIds[1], token: tokenB })),
]);
const confirmed = concurrent.filter(result =>
  result.response.ok && result.body.status === "server_confirmed");
const conflicts = concurrent.filter(result =>
  result.response.ok && result.body.status === "conflict");
assert.equal(confirmed.length, 1, JSON.stringify(concurrent.map(result => result.body)));
assert.equal(conflicts.length, 1, JSON.stringify(concurrent.map(result => result.body)));

const confirmedOperationId = confirmed[0].operationId;
const replay = await confirm(
  confirmed[0].token,
  confirmed[0].taskId,
  confirmedOperationId,
);
assert.equal(replay.response.ok, true);
assert.equal(replay.body.bookingId, confirmed[0].body.bookingId);
assert.equal(replay.body.idempotentReplay, true);

const mismatch = await confirm(confirmed[0].token, confirmed[0].taskId, confirmedOperationId, {
  p_end_at: new Date(new Date(fixtures.tests.slot.end).getTime() + 15 * 60_000).toISOString(),
});
assert.equal(mismatch.response.ok, false);
assert.match(JSON.stringify(mismatch.body), /IDEMPOTENCY_PAYLOAD_MISMATCH/);

console.log("workshop-scheduling-concurrency: OK");
