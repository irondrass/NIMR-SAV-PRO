import assert from "node:assert/strict";
import { decideWorkshopBackup } from "../scripts/workshop-backup-policy.mjs";

assert.deepEqual(decideWorkshopBackup({
  dockerAvailable: true,
  environment: "development",
  productionExists: "YES",
  userDataRows: 10,
  workshopMigrationApplied: true,
}), { mode: "applied_tracked" });

assert.deepEqual(decideWorkshopBackup({
  dockerAvailable: false,
  environment: "development",
  productionExists: "NO",
  userDataRows: 0,
  workshopMigrationApplied: false,
}), { mode: "skip", report: "backup=SKIPPED_DOCKER_UNAVAILABLE_EMPTY_DEV" });

assert.throws(() => decideWorkshopBackup({
  dockerAvailable: false,
  environment: "development",
  productionExists: "NO",
  userDataRows: 1,
  workshopMigrationApplied: false,
}), /NO GO/);

assert.throws(() => decideWorkshopBackup({
  dockerAvailable: false,
  environment: "production",
  productionExists: "NO",
  userDataRows: 0,
  workshopMigrationApplied: false,
}), /NO GO/);

assert.deepEqual(decideWorkshopBackup({
  dockerAvailable: false,
  environment: "development",
  productionExists: "NO",
  userDataRows: 0,
  workshopMigrationApplied: true,
}), { mode: "applied_tracked" });

console.log("workshop backup policy tests passed");
