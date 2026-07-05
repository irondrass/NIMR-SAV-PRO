import assert from "node:assert/strict";
import fs from "node:fs";
import { canBackendRoleWrite, toBackendRole } from "../src/auth/roleMapping";
import { ROLE_TABS } from "../src/roles";
import { UserRole } from "../src/types";

console.log("Démarrage du test: role-permissions-server-readiness...");

assert.equal(canBackendRoleWrite("LECTURE"), false);
assert.equal(canBackendRoleWrite("lecture"), false);
assert.equal(canBackendRoleWrite("RECEPTION"), true);
assert.equal(toBackendRole(UserRole.TECHNICIEN), "TECHNICIEN");

assert.equal(ROLE_TABS[UserRole.RECEPTIONNAIRE].includes("users"), false);
assert.equal(ROLE_TABS[UserRole.RECEPTIONNAIRE].includes("parametres"), false);
assert.equal(ROLE_TABS[UserRole.LECTURE_SEULE].includes("users"), false);
assert.equal(ROLE_TABS[UserRole.TECHNICIEN].every(tab => tab === "tech-view"), true);

const sql = fs.readdirSync("supabase/migrations")
  .filter(file => file.endsWith(".sql"))
  .map(file => fs.readFileSync(`supabase/migrations/${file}`, "utf8"))
  .join("\n");
for (const role of ["DIRECTEUR_SAV", "CHEF_ATELIER", "RECEPTION", "TECHNICIEN", "QC", "LIVRAISON", "LECTURE"]) {
  assert.ok(sql.includes(role), `Role serveur absent: ${role}`);
}
for (const role of ["directeur", "reception", "chefatelier", "technicien", "qc", "livraison", "lecture"]) {
  assert.ok(sql.includes(role), `Role NIMR serveur absent: ${role}`);
}
assert.match(sql, /app_settings_select_director/);
assert.match(sql, /audit_events_no_frontend_update/);
assert.match(sql, /audit_events_no_frontend_delete/);
assert.match(sql, /profiles_select_self_or_director/);

console.log("role-permissions-server-readiness.test.ts OK");
