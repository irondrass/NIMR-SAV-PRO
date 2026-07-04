import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage du test: file-download-security-contract...");

const detailSource = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
assert.match(detailSource, /secure-file-metadata-panel/);
assert.match(detailSource, /secure-file-download-notice/);
assert.match(detailSource, /Téléchargement disponible après activation Backend v2\.0 \/ Google Drive sécurisé\./);
assert.match(detailSource, /disabled=\{!canDownloadSecureFiles\}/);
assert.match(detailSource, /functions\/v1\/drive-download/);
assert.doesNotMatch(detailSource, /drive\.google\.com|googleapis\.com\/drive|futureDownloadUrl/);

const modeSource = fs.readFileSync("src/data/backendMode.ts", "utf8");
assert.match(modeSource, /local-only/);
assert.match(modeSource, /shouldAttemptSupabase/);

console.log("file-download-security-contract.test.ts OK");
