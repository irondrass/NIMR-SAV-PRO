import assert from "node:assert/strict";
import { distributeLaborHours } from "../src/quote-import";

console.log("Running quote-import-terrain-edge-cases.test.ts...");

// 1. Lavage / Nettoyage final -> finish
const dist1 = distributeLaborHours("Lavage et nettoyage final complet", 1);
assert.equal(dist1[0].phase, "finish");

// 2. Préparation peinture -> prep
const dist2 = distributeLaborHours("Préparation peinture pare-chocs", 2);
assert.equal(dist2[0].phase, "prep");

// 3. Peinture -> paint
const dist3 = distributeLaborHours("Peinture vernis aile arrière", 3);
assert.equal(dist3[0].phase, "paint");

// 4. Dépose/Repose / DP -> body
const dist4 = distributeLaborHours("D/P Malle arrière", 2);
assert.equal(dist4[0].phase, "body");

// 5. Remontage -> reassembly
const dist5 = distributeLaborHours("Remontage complet porte", 1.5);
assert.equal(dist5[0].phase, "reassembly");

// 6. Diagnostic électrique -> electrical
const dist6 = distributeLaborHours("Diagnostic électrique moteur", 2.5);
assert.equal(dist6[0].phase, "electrical");

// 7. Vidange / géométrie -> oilService / mechanical
const dist7 = distributeLaborHours("Vidange moteur et filtres", 1);
assert.equal(dist7[0].phase, "oilService");

console.log("quote-import-terrain-edge-cases.test.ts passed!");
