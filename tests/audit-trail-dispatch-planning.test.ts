import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Démarrage du test: audit-trail-dispatch-planning...");

const detailSource = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
const planningSource = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
const appSource = fs.readFileSync("src/App.tsx", "utf8");

// 1. Check logout logging
assert.ok(appSource.includes('action: "deconnexion"'), "Logout must log the 'deconnexion' action.");

// 2. Check task assignment logging
assert.ok(detailSource.includes('action: "affectation_par_tache"'), "Task assignment must log the 'affectation_par_tache' action.");

// 3. Check mass assignment logging
assert.ok(detailSource.includes('action: "affectation_en_masse_compatible"'), "Mass assignment must log the 'affectation_en_masse_compatible' action.");

// 4. Check incompatible assignment logging
assert.ok(detailSource.includes('action: "tentative_affectation_incompatible"'), "Incompatible assignment attempt must log the 'tentative_affectation_incompatible' action.");

// 5. Check replacement with motif logging
assert.ok(detailSource.includes('action: "remplacement_compagnon_avec_motif"'), "Technician replacement must log the 'remplacement_compagnon_avec_motif' action.");

// 6. Check auto-reservation logging
assert.ok(planningSource.includes('action: "reservation_automatique"'), "Auto-reservation must log the 'reservation_automatique' action.");

// 7. Check slot suggestion logging
assert.ok(planningSource.includes('action: "proposition_creneau"'), "Proposed slots must log the 'proposition_creneau' action.");

// 8. Check ETA recalculation logging
assert.ok(planningSource.includes('action: "eta_recalculee"'), "ETA recalculation must log the 'eta_recalculee' action.");

console.log("audit-trail-dispatch-planning.test.ts OK");
