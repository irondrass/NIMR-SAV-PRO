import assert from "node:assert/strict";
import fs from "node:fs";

const runtimeFiles = [
  "src/App.tsx",
  "src/components/GuidedReception.tsx",
  "src/components/ComplaintsView.tsx",
  "src/components/DossierDetail.tsx",
  "src/auth.ts",
];

for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, "utf8");
  assert.equal(source.includes("Client Démo"), false, `${file} ne doit plus exposer de client démo runtime.`);
  assert.equal(source.includes("Société Démo"), false, `${file} ne doit plus exposer de société démo runtime.`);
  assert.equal(source.includes("preset-client"), false, `${file} ne doit plus exposer de preset client.`);
}

const appSource = fs.readFileSync("src/App.tsx", "utf8");
assert.equal(appSource.includes("INITIAL_DOSSIERS"), false);
assert.equal(appSource.includes("MOCK_TECHNICIENS"), false);
assert.ok(appSource.includes("loadStoredArray(STORAGE_KEYS.dossiers, [], isDossierSAV)"));
assert.ok(appSource.includes('data-testid="empty-state-dossiers"'));

const receptionSource = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
assert.ok(receptionSource.includes('data-testid="empty-state-vehicles"'));
assert.ok(receptionSource.includes('data-testid="import-vehicles-empty-action"'));

