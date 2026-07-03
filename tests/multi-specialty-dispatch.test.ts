import assert from "node:assert/strict";
import fs from "node:fs";
import { isTechnicianCompatibleForStep } from "../src/sav-core";
import { AtelierZone, TechnicienResource } from "../src/types";

console.log("Démarrage du test: multi-specialty-dispatch...");

// Create dummy technicians for different specialties/zones conforming to TechnicienResource
const mechanic: TechnicienResource = {
  id: "tech_meca",
  nom: "Meca Guy",
  specialite: "Mécanicien",
  disponibilite: "disponible",
  compétences: [],
  zoneAffectee: AtelierZone.MECANIQUE_RAPIDE,
  absencesConges: [],
  capaciteJournaliere: 8,
  chargeActuelle: 0,
};

const painter: TechnicienResource = {
  id: "tech_paint",
  nom: "Painter Guy",
  specialite: "Peintre",
  disponibilite: "disponible",
  compétences: [],
  zoneAffectee: AtelierZone.PEINTURE,
  absencesConges: [],
  capaciteJournaliere: 8,
  chargeActuelle: 0,
};

const bodyworker: TechnicienResource = {
  id: "tech_body",
  nom: "Body Guy",
  specialite: "Tôlier",
  disponibilite: "disponible",
  compétences: [],
  zoneAffectee: AtelierZone.CARROSSERIE,
  absencesConges: [],
  capaciteJournaliere: 8,
  chargeActuelle: 0,
};

const electrician: TechnicienResource = {
  id: "tech_elec",
  nom: "Electrician Guy",
  specialite: "Électricien",
  disponibilite: "disponible",
  compétences: [],
  zoneAffectee: AtelierZone.ELECTRICITE_DIAG,
  absencesConges: [],
  capaciteJournaliere: 8,
  chargeActuelle: 0,
};

// 1. Mechanic cannot be assigned to painting/peinture
assert.equal(isTechnicianCompatibleForStep(mechanic, "paint", "peinture"), false, "Mechanic should not be compatible with painting.");

// 2. Mechanic cannot be assigned to bodywork/tôlerie
assert.equal(isTechnicianCompatibleForStep(mechanic, "body", "tolerie"), false, "Mechanic should not be compatible with bodywork/tôlerie.");

// 3. Painter is compatible with painting
assert.equal(isTechnicianCompatibleForStep(painter, "paint", "peinture"), true, "Painter should be compatible with painting.");

// 4. Bodyworker is compatible with bodywork
assert.equal(isTechnicianCompatibleForStep(bodyworker, "body", "tolerie"), true, "Bodyworker should be compatible with bodywork.");

// 5. Electrician is compatible with electricity
assert.equal(isTechnicianCompatibleForStep(electrician, "electrical", "electrique"), true, "Electrician should be compatible with electricity.");

// 6. Check that DossierDetail.tsx contains the required components and dialogs
const detailSource = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");

assert.ok(detailSource.includes("isTechCompatibleForTask"), "isTechCompatibleForTask function must be defined.");
assert.ok(detailSource.includes("assignTechnicianToTask"), "assignTechnicianToTask function must be defined.");
assert.ok(detailSource.includes("handleBulkAssign"), "handleBulkAssign function must be defined.");
assert.ok(detailSource.includes('data-testid="bulk-assign-tech-select"'), "Bulk assignment select must exist.");
assert.ok(detailSource.includes('data-testid="bulk-assign-tech-button"'), "Bulk assignment button must exist.");
assert.ok(detailSource.includes('data-testid="replacement-modal"'), "Replacement confirmation modal must exist.");
assert.ok(detailSource.includes('data-testid="replacement-reason-input"'), "Replacement reason input must exist.");

console.log("multi-specialty-dispatch.test.ts OK");
