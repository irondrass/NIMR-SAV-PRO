import assert from "node:assert/strict";
import fs from "node:fs";
import { canBackendRoleWrite, toBackendRole } from "../src/auth/roleMapping";
import { ROLE_TABS } from "../src/roles";
import { UserRole } from "../src/types";

console.log("Démarrage du test: role-permissions-server-readiness...");

assert.equal(canBackendRoleWrite("LECTURE"), false);
assert.equal(canBackendRoleWrite("RECEPTION"), true);
assert.equal(toBackendRole(UserRole.TECHNICIEN), "TECHNICIEN");

assert.equal(ROLE_TABS[UserRole.RECEPTIONNAIRE].includes("users"), false);
assert.equal(ROLE_TABS[UserRole.RECEPTIONNAIRE].includes("parametres"), false);
assert.equal(ROLE_TABS[UserRole.LECTURE_SEULE].includes("users"), false);
assert.equal(ROLE_TABS[UserRole.TECHNICIEN].every(tab => tab === "tech-view"), true);

const sql = fs.readFileSync("supabase/migrations/20260704000000_backend_v2_foundation.sql", "utf8");
for (const role of ["DIRECTEUR_SAV", "CHEF_ATELIER", "RECEPTION", "TECHNICIEN", "QC", "LIVRAISON", "LECTURE"]) {
  assert.ok(sql.includes(role), `Role serveur absent: ${role}`);
}
assert.match(sql, /app_settings_select_director/);
assert.match(sql, /audit_events_no_frontend_update/);
assert.match(sql, /audit_events_no_frontend_delete/);

console.log("role-permissions-server-readiness.test.ts OK");
