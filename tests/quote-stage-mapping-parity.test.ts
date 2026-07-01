import assert from "node:assert/strict";
import {
  applyQuoteImportPreview,
  buildQuoteImportPreview,
  parseQuoteText,
} from "../src/quote-import";

console.log("Démarrage des tests quote-stage-mapping-parity...");

const lines = parseQuoteText([
  "MO-TOL D/P ET PREPARATION PARE-CHOCS AV 2 35,000 70,000",
  "MO-TOL PEINTURE ET FINITION PORTE DR 3 35,000 105,000",
].join("\n"));

const preview = buildQuoteImportPreview(lines, { sourceType: "text", fileName: "devis-old-app.txt" });
const result = applyQuoteImportPreview(preview);
const byStage = new Map(result.importedLines.map(line => [line.workshopStageId, line]));

assert.ok(byStage.has("body-disassembly"), "D/P doit créer une tâche tôlerie/démontage");
assert.ok(byStage.has("reassembly"), "D/P doit créer une tâche remontage");
assert.ok(byStage.has("preparation"), "Peinture doit créer une tâche préparation");
assert.ok(byStage.has("paint"), "Peinture doit créer une tâche peinture mutualisée");
assert.ok(byStage.has("finish"), "Peinture doit créer une tâche finition");
assert.ok(byStage.has("quality"), "Application devis doit créer le contrôle qualité forfaitaire");
assert.equal(byStage.get("paint")?.workshopZoneNote, "Règle ancienne : peinture mutualisée par zone/côté cabine.");

console.log("quote-stage-mapping-parity.test.ts OK");

