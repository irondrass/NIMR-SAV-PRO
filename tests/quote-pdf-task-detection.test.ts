/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { extractPdfTextFallback } from "../src/quote-import";
import { detectQuoteWorkshopTaskCandidates } from "../src/workshop-task-intake";

console.log("Démarrage des tests quote-pdf-task-detection...");

const fakePdf = [
  "%PDF-1.4",
  "stream",
  "(DEVIS ATELIER FICTIF) Tj",
  "(Vidange huile moteur et filtre 1H) Tj",
  "(Diagnostic batterie 0,5H) Tj",
  "(Total HT 100) Tj",
  "(TVA 19) Tj",
  "(Montant à reporter 119) Tj",
  "endstream",
  "%%EOF",
].join("\n");

const extracted = await extractPdfTextFallback(new TextEncoder().encode(fakePdf).buffer);
const candidates = detectQuoteWorkshopTaskCandidates(extracted);
const labels = candidates.map(candidate => candidate.label.toUpperCase());

assert.ok(labels.some(label => label.includes("VIDANGE")), "La tâche vidange doit être détectée depuis le PDF.");
assert.ok(labels.some(label => label.includes("DIAGNOSTIC BATTERIE")), "La tâche diagnostic doit être détectée depuis le PDF.");
assert.equal(candidates.find(candidate => candidate.label.toUpperCase().includes("VIDANGE"))?.stageId, "quick-service");
assert.equal(candidates.find(candidate => candidate.label.toUpperCase().includes("BATTERIE"))?.stageId, "electrical");

for (const blocked of ["TOTAL", "TVA", "MONTANT"]) {
  assert.equal(labels.some(label => label.includes(blocked)), false, `Ligne financière détectée à tort: ${blocked}`);
}

console.log("✅ quote-pdf-task-detection OK");
