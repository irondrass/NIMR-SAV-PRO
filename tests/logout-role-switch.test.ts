import assert from "node:assert/strict";
import fs from "node:fs";
import { createDefaultUsers, loginUser } from "../src/auth";
import { STORAGE_KEYS } from "../src/storage-keys";
import { UserRole } from "../src/types";

console.log("Démarrage des tests logout-role-switch...");

const appSource = fs.readFileSync("src/App.tsx", "utf8");
const logoutBody = appSource.slice(appSource.indexOf("const handleLogout = () =>"), appSource.indexOf("const handleCreateUser"));

assert.ok(
  logoutBody.includes("removeLocalStorageValue(STORAGE_KEYS.session)") ||
  logoutBody.includes("localStorage.removeItem(STORAGE_KEYS.session)")
);
for (const forbiddenKey of [
  "STORAGE_KEYS.dossiers",
  "STORAGE_KEYS.techs",
  "STORAGE_KEYS.reclamations",
  "STORAGE_KEYS.reservations",
  "STORAGE_KEYS.vehicleMaster",
]) {
  assert.equal(logoutBody.includes(`removeItem(${forbiddenKey}`), false, `Logout ne doit pas supprimer ${forbiddenKey}`);
}
assert.ok(appSource.includes('data-testid="logout-button"'));

const users = await createDefaultUsers(new Date("2026-07-02T08:00:00.000Z"));
const directorLogin = await loginUser(users, "directeur", "0000", new Date("2026-07-02T08:00:00.000Z"));
assert.equal(directorLogin.ok, true);
if (!directorLogin.ok) throw new Error("Login directeur impossible");
assert.equal(directorLogin.session.role, UserRole.DIRECTEUR_SAV);

const receptionLogin = await loginUser(directorLogin.users, "reception", "1111", new Date("2026-07-02T08:05:00.000Z"));
assert.equal(receptionLogin.ok, true);
if (!receptionLogin.ok) throw new Error("Login réception impossible");
assert.equal(receptionLogin.session.role, UserRole.RECEPTIONNAIRE);
assert.equal(STORAGE_KEYS.session, "nimr-sav-pro-session");

console.log("logout-role-switch.test.ts OK");
