import assert from "node:assert/strict";
import {
  makeOldAppWeightedAllocations,
  normalizeOldAppOriginalLaborLine,
} from "../src/core/old-app-quote-rules";

console.log("Démarrage des tests quote-duration-allocation...");

{
  const allocations = makeOldAppWeightedAllocations("PEINTURE PORTE DR", 3, ["prep", "paint"]);
  assert.deepEqual(
    allocations.map(item => [item.phase, item.laborHours]),
    [["prep", 2], ["paint", 1]],
    "Préparation + peinture doit appliquer le poids ancien 2/3 - 1/3"
  );
}

{
  const line = normalizeOldAppOriginalLaborLine({
    id: "dressage",
    operation: "DRESSAGE ET PEINTURE AILE GH",
    laborHours: 4,
    selectedPhases: ["body", "prep", "paint"],
  });
  assert.deepEqual(
    line.allocations.map(item => [item.phase, item.laborHours]),
    [["body", 1], ["prep", 2], ["paint", 1]],
    "Une MO tri-étapes doit être répartie selon les poids de l'ancien écran"
  );
}

console.log("quote-duration-allocation.test.ts OK");

