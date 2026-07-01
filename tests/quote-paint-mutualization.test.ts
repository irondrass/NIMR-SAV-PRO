import assert from "node:assert/strict";
import {
  normalizeOldAppOriginalLaborLine,
  optimizeOldAppEstimateAllocationsFromOriginalLines,
} from "../src/core/old-app-quote-rules";

console.log("Démarrage des tests quote-paint-mutualization...");

const lines = [
  normalizeOldAppOriginalLaborLine({
    id: "right-door",
    operation: "PEINTURE PORTE DR",
    laborHours: 3,
    selectedPhases: ["paint"],
    paintFaces: "two_sides",
    paintGroup: "right",
  }),
  normalizeOldAppOriginalLaborLine({
    id: "right-wing",
    operation: "PEINTURE AILE DR",
    laborHours: 2,
    selectedPhases: ["paint"],
    paintFaces: "outside",
    paintGroup: "right",
  }),
  normalizeOldAppOriginalLaborLine({
    id: "front-bumper",
    operation: "PEINTURE PARE CHOCS AV",
    laborHours: 1,
    selectedPhases: ["paint"],
    paintFaces: "outside",
    paintGroup: "front",
  }),
];

const optimized = optimizeOldAppEstimateAllocationsFromOriginalLines(lines);
const right = optimized.paintOptimization.find(group => group.group === "right");
const front = optimized.paintOptimization.find(group => group.group === "front");

assert.equal(right?.total, 5.3, "Groupe droit = porte deux côtés 4.8h + 25% de 2h");
assert.equal(front?.total, 1, "Groupe avant conserve son unique ligne");
assert.equal(optimized.totals.paint, 5.7, "Total cabine = plus gros groupe 5.3h + 40% des autres groupes");
assert.equal(optimized.totals.finish, 2.85, "Finition = 50% du total peinture");
assert.equal(optimized.totals.quality, 0.25, "Qualité forfaitaire ancienne = 0.25h");

console.log("quote-paint-mutualization.test.ts OK");

