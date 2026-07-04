import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Démarrage du test: google-drive-edge-contract...");

const functions = [
  "drive-create-upload-session",
  "drive-confirm-upload",
  "drive-download",
  "drive-delete-metadata",
];

for (const fn of functions) {
  const file = path.join("supabase", "functions", fn, "index.ts");
  assert.equal(fs.existsSync(file), true, `Edge Function manquante: ${fn}`);
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /authorization/i);
  assert.match(source, /prepared-only/);
  assert.doesNotMatch(source, /drive\.google\.com\/|googleapis\.com\/drive/i);
}

const envExample = fs.readFileSync(path.join("supabase", ".env.example"), "utf8");
assert.match(envExample, /GOOGLE_DRIVE_OWNER_EMAIL=mhadhbikhaled@gmail\.com/);
assert.match(envExample, /GOOGLE_SERVICE_ACCOUNT_JSON=YOUR_GOOGLE_SERVICE_ACCOUNT_JSON/);
assert.match(envExample, /GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET/);
assert.doesNotMatch(envExample, new RegExp(`ya29\\.|AIza|BEGIN ${"PRIVATE"} KEY`));

console.log("google-drive-edge-contract.test.ts OK");
