import assert from "node:assert/strict";
import {
  canCreateDossier,
  canDeliver,
  canManageUsers,
  canPlanWorkshop,
  canStartTask,
  canValidateQC,
  isReadOnlyRole,
} from "../src/permissions";
import { UserRole } from "../src/types";

assert.equal(canCreateDossier(UserRole.RECEPTIONNAIRE), true);
assert.equal(canPlanWorkshop(UserRole.RECEPTIONNAIRE), false);
assert.equal(canStartTask(UserRole.RECEPTIONNAIRE), false);

assert.equal(canPlanWorkshop(UserRole.CHEF_ATELIER), true);
assert.equal(canStartTask(UserRole.CHEF_ATELIER), true);
assert.equal(canDeliver(UserRole.CHEF_ATELIER), false);

assert.equal(canStartTask(UserRole.TECHNICIEN), true);
assert.equal(canPlanWorkshop(UserRole.TECHNICIEN), false);
assert.equal(canValidateQC(UserRole.TECHNICIEN), false);

assert.equal(canValidateQC(UserRole.CONTROLE_QUALITE), true);
assert.equal(canDeliver(UserRole.CONTROLE_QUALITE), false);

assert.equal(canDeliver(UserRole.LIVRAISON), true);
assert.equal(canPlanWorkshop(UserRole.LIVRAISON), false);

assert.equal(canManageUsers(UserRole.DIRECTEUR_SAV), true);
assert.equal(isReadOnlyRole(UserRole.LECTURE_SEULE), true);
assert.equal(canCreateDossier(UserRole.LECTURE_SEULE), false);
assert.equal(canPlanWorkshop(UserRole.LECTURE_SEULE), false);
assert.equal(canStartTask(UserRole.LECTURE_SEULE), false);
assert.equal(canDeliver(UserRole.LECTURE_SEULE), false);

