import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

console.log("Démarrage du test: no-secrets-backend-v2...");

const output = execFileSync("node", ["scripts/check-no-secrets.mjs"], { encoding: "utf8" });
assert.match(output, /OK/);

const frontendSource = [
  "src/data/backendMode.ts",
  "src/data/supabaseProvider.ts",
  "src/auth/supabaseAuthProvider.ts",
  "src/components/DossierDetail.tsx",
].map(file => fs.readFileSync(file, "utf8")).join("\n");

assert.doesNotMatch(frontendSource, /SUPABASE_SERVICE_ROLE_KEY\s*=/);
assert.doesNotMatch(frontendSource, /GOOGLE_CLIENT_SECRET\s*=/);
assert.doesNotMatch(frontendSource, /GOOGLE_REFRESH_TOKEN\s*=/);
assert.doesNotMatch(frontendSource, new RegExp(`ya29\\.|AIza|BEGIN ${"PRIVATE"} KEY`));

for (const forbiddenFile of [".env", "service-account.json", "google-credentials.json"]) {
  assert.equal(fs.existsSync(forbiddenFile), false, `${forbiddenFile} ne doit pas être committé`);
}

console.log("no-secrets-backend-v2.test.ts OK");
