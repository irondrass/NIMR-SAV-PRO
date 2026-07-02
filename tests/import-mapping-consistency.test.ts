import assert from "node:assert/strict";
import {
  applyQuoteImportPreview,
  buildQuoteImportPreview,
  isQualityControlLine,
  parseQuoteText,
} from "../src/quote-import";
import { OLD_APP_PHASE_TO_PRO_STAGE } from "../src/core/old-app-quote-rules";

console.log("Démarrage des tests import-mapping-consistency...");

const mixedQuote = [
  "MO VIDANGE MOTEUR 1 35,000 35,000",
  "MO CONTROLE GEOMETRIE TRAIN AVANT 1.5 35,000 52,500",
  "MO DIAGNOSTIC VALISE DEFAUT ELECTRIQUE 1 35,000 35,000",
  "MO REPARATION FAISCEAU PORTE AV 2 35,000 70,000",
  "MO-TOL D/P ET PREPARATION AILE AVANT GAUCHE 3 35,000 105,000",
  "MO-TOL PEINTURE ET FINITION AILE AVANT GAUCHE 2 35,000 70,000",
  "MO CONTROLE QUALITE FORFAITAIRE 0.25 35,000 8,750",
].join("\n");

const lines = parseQuoteText(mixedQuote);
assert.ok(lines.length >= 6);
assert.equal(lines.some(line => line.type === "labor" && isQualityControlLine(line.description)), false);

const preview = buildQuoteImportPreview(lines, { sourceType: "text", fileName: "terrain-mixte.txt" });
const result = applyQuoteImportPreview(preview);
const byStage = result.importedLines.reduce((map, line) => {
  const current = map.get(line.workshopStageId || "") || [];
  current.push(line.designation);
  map.set(line.workshopStageId || "", current);
  return map;
}, new Map<string, string[]>());

assert.ok(byStage.has("quick-service"), "Vidange doit rester en entretien rapide.");
assert.ok(byStage.has("mechanical"), "Contrôle géométrie doit créer une tâche mécanique.");
assert.ok(byStage.get("mechanical")?.some(label => /GEOMETRIE/i.test(label)));
assert.ok(byStage.has("electrical"), "Diagnostic valise/faisceau doit créer des tâches électriques.");
assert.ok((byStage.get("electrical") || []).some(label => /DIAGNOSTIC|FAISCEAU/i.test(label)));
assert.ok(byStage.has("body-disassembly"), "D/P tôlerie doit rester en tôlerie/démontage.");
assert.ok(byStage.has("paint"), "Peinture doit rester en peinture.");
assert.equal(byStage.has("quality"), false, "QC forfaitaire ne doit jamais devenir une tâche atelier.");
assert.equal(result.importedLines.some(line => /controle qualite|contrôle qualité|qc forfaitaire/i.test(line.designation)), false);

for (const line of preview.lines.filter(line => line.type === "labor" && line.selected && line.hours > 0)) {
  const previewStages = new Set(
    (line.oldAppPhaseAllocations || [])
      .map(allocation => OLD_APP_PHASE_TO_PRO_STAGE[allocation.phase as keyof typeof OLD_APP_PHASE_TO_PRO_STAGE])
      .filter(stage => stage && stage !== "quality")
  );
  assert.equal(previewStages.size > 0, true, `La ligne ${line.description} doit avoir une allocation preview.`);
  for (const stage of previewStages) {
    assert.ok(byStage.has(stage), `L'étape preview ${stage} doit exister dans les tâches créées.`);
  }
}

console.log("import-mapping-consistency.test.ts OK");
