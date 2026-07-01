import assert from "node:assert/strict";
import {
  distributeLaborHours,
  parseQuoteText,
} from "../src/quote-import";

console.log("Démarrage des tests old-app-quote-parity...");

{
  const distributions = distributeLaborHours("D/P ET PREPARATION PARE-CHOCS AV", 2);
  assert.deepEqual(
    distributions.map(item => [item.phase, item.laborHours]),
    [["body", 1], ["reassembly", 1]],
    "D/P doit reprendre le split ancien body/remontage 50/50"
  );
}

{
  const distributions = distributeLaborHours("PEINTURE ET FINITION PORTE DR", 3);
  assert.deepEqual(
    distributions.map(item => [item.phase, item.laborHours]),
    [["prep", 1.5], ["paint", 1.5]],
    "Peinture et finition doit produire préparation + peinture avant normalisation old-app"
  );
}

{
  const line = parseQuoteText("MO-TOL PEINTURE ET FINITION PORTE DR 3 35,000 105,000")
    .find(item => item.type === "labor" && item.hours > 0);
  assert.ok(line, "La ligne MO ancienne app avec duree doit etre detectee");
  assert.equal(line.type, "labor");
  assert.equal(line.oldAppPieceKind, "new");
  assert.equal(line.oldAppPaintFaces, "two_sides");
  assert.equal(line.oldAppPaintGroup, "right");
  assert.deepEqual(line.oldAppSelectedPhases, ["prep", "paint"]);
}

console.log("old-app-quote-parity.test.ts OK");
