import assert from "node:assert/strict";
import {
  enqueueIdempotent,
  getRunnableOperations,
  markSyncApplied,
  markSyncFailure,
  resolveSyncConflict,
  WorkshopSyncOperation,
} from "../src/workshop-scheduling/sync";

const operation: WorkshopSyncOperation = {
  id: "operation-1",
  entityType: "booking",
  entityId: "booking-1",
  operationType: "confirm",
  payload: { taskId: "task-1" },
  status: "pending",
  attempts: 0,
  createdAt: "2026-08-03T08:00:00.000Z",
  updatedAt: "2026-08-03T08:00:00.000Z",
};

console.log("Running workshop scheduling sync tests...");

assert.equal(enqueueIdempotent([], operation).length, 1);
assert.equal(enqueueIdempotent([operation], operation).length, 1);

const firstFailure = markSyncFailure(operation, "offline", new Date("2026-08-03T08:00:00.000Z"));
assert.equal(firstFailure.status, "failed");
assert.equal(firstFailure.attempts, 1);
assert.equal(getRunnableOperations([firstFailure], new Date("2026-08-03T08:00:01.000Z")).length, 0);
assert.equal(getRunnableOperations([firstFailure], new Date("2026-08-03T08:01:00.000Z")).length, 1);

let terminal = operation;
for (let attempt = 0; attempt < 5; attempt += 1) {
  terminal = markSyncFailure(terminal, "offline", new Date("2026-08-03T08:00:00.000Z"));
}
assert.equal(terminal.status, "conflict");
assert.equal(terminal.nextRetryAt, undefined);

const applied = markSyncApplied(firstFailure, 2);
assert.equal(applied.status, "applied");
assert.equal(applied.serverVersion, 2);
assert.equal(applied.lastError, undefined);

const conflict = resolveSyncConflict(
  { operationId: "operation-1", localValue: { start: "08:00" }, serverValue: { start: "09:00" } },
  "server",
);
assert.equal(conflict.resolution, "server");

console.log("workshop-scheduling-sync: OK");
