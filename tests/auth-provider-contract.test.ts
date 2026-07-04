import assert from "node:assert/strict";
import { createDefaultUsers } from "../src/auth";
import { createLocalAuthProvider } from "../src/auth/localAuthProvider";
import { createSupabaseAuthProvider, mapSupabaseProfileToLocalUser } from "../src/auth/supabaseAuthProvider";
import { toAppRole, toBackendRole } from "../src/auth/roleMapping";
import { UserRole } from "../src/types";

console.log("Démarrage du test: auth-provider-contract...");

assert.equal(toBackendRole(UserRole.RECEPTIONNAIRE), "RECEPTION");
assert.equal(toBackendRole(UserRole.CONTROLE_QUALITE), "QC");
assert.equal(toBackendRole(UserRole.LECTURE_SEULE), "LECTURE");
assert.equal(toAppRole("CHEF_ATELIER"), UserRole.CHEF_ATELIER);

const localUsers = await createDefaultUsers();
const localAuth = createLocalAuthProvider({ users: localUsers });
const login = await localAuth.login({ username: "reception", password: "1111" });
assert.equal(login.ok, true);
assert.equal(login.ok && login.backendRole, "RECEPTION");
assert.ok(await localAuth.getSession());
await localAuth.logout();
assert.equal(await localAuth.getSession(), null);
assert.equal(await localAuth.refreshSession(), null);

const profile = mapSupabaseProfileToLocalUser({
  id: "user-backend-1",
  full_name: "Backend QC",
  email: "qc@example.test",
  role: "QC",
  active: true,
}, new Date("2026-07-04T08:00:00.000Z"));
assert.equal(profile.role, UserRole.CONTROLE_QUALITE);

let signedOut = false;
const backendAuth = createSupabaseAuthProvider({
  config: {
    mode: "backend-enabled",
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
    backendEnabled: true,
    backendReady: true,
    missing: [],
    warnings: [],
  },
  client: {
    async signInWithPassword() {
      return { userId: "inactive-user", email: "inactive@example.test" };
    },
    async signOut() {
      signedOut = true;
    },
    async getProfile() {
      return {
        id: "inactive-user",
        full_name: "Inactive User",
        email: "inactive@example.test",
        role: "LECTURE" as const,
        active: false,
      };
    },
  },
});

const inactiveLogin = await backendAuth.login({ username: "inactive@example.test", password: "secret" });
assert.equal(inactiveLogin.ok, false);
assert.equal(inactiveLogin.ok ? "" : inactiveLogin.reason, "disabled-user");
assert.equal(signedOut, true);
assert.equal(await backendAuth.getSession(), null);

console.log("auth-provider-contract.test.ts OK");
