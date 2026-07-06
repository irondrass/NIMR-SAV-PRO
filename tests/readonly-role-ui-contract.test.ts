import assert from "node:assert/strict";
import { ROLE_PERMISSIONS } from "../src/permissions";
import { UserRole } from "../src/types";

console.log("Running readonly-role-ui-contract.test.ts...");

const perm = ROLE_PERMISSIONS[UserRole.LECTURE_SEULE];
assert.ok(perm, "Permissions should be defined for LECTURE_SEULE");

// Verify that critical write permissions are false
assert.equal(perm.createDossier, false);
assert.equal(perm.editDossier, false);
assert.equal(perm.planWorkshop, false);
assert.equal(perm.startTask, false);
assert.equal(perm.validateQC, false);
assert.equal(perm.deliver, false);
assert.equal(perm.importData, false);

console.log("readonly-role-ui-contract.test.ts passed!");
