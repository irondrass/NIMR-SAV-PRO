import assert from "node:assert/strict";
import { createActionGuard } from "../src/action-guard";

console.log("Démarrage des tests anti-double-click...");

const guard = createActionGuard();
let callCount = 0;
let release!: () => void;

const first = guard.run("save-dossier", async () => {
  callCount += 1;
  await new Promise<void>((resolve) => {
    release = resolve;
  });
  return "saved";
});

assert.equal(guard.isRunning("save-dossier"), true);

const second = await guard.run("save-dossier", () => {
  callCount += 1;
  return "duplicate";
});

assert.equal(second.ok, false);
assert.equal(second.skipped, true);
assert.equal(second.reason, "already-running");
assert.equal(callCount, 1);

release();
const firstResult = await first;
assert.equal(firstResult.ok, true);
assert.equal(firstResult.skipped, false);
if (firstResult.ok) {
  assert.equal(firstResult.value, "saved");
}
assert.equal(guard.isRunning("save-dossier"), false);

const third = await guard.run("save-dossier", () => "saved-again");
assert.equal(third.ok, true);
if (third.ok) {
  assert.equal(third.value, "saved-again");
}

console.log("anti-double-click.test.ts OK");
