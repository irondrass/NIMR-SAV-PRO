import assert from "node:assert/strict";
import { isTechnicianCompatibleForStep, isBayCompatibleForStep } from "../src/sav-core";
import { AtelierZone, TechnicienResource } from "../src/types";

console.log("Démarrage des tests planning-trade-compatibility...");

const techCarrossier: TechnicienResource = {
  id: "tech_car",
  nom: "Carrossier",
  specialite: "Tôlier",
  disponibilite: "disponible",
  compétences: [],
  zoneAffectee: AtelierZone.CARROSSERIE,
  absencesConges: [],
  capaciteJournaliere: 8,
  chargeActuelle: 0
};

const techMecanicien: TechnicienResource = {
  id: "tech_mec",
  nom: "Mécanicien",
  specialite: "Moteur",
  disponibilite: "disponible",
  compétences: [],
  zoneAffectee: AtelierZone.GRANDS_TRAVAUX,
  absencesConges: [],
  capaciteJournaliere: 8,
  chargeActuelle: 0
};

// Test trade compatibility for step
assert.equal(isTechnicianCompatibleForStep(techCarrossier, "body"), true);
assert.equal(isTechnicianCompatibleForStep(techCarrossier, "mechanical"), false);
assert.equal(isTechnicianCompatibleForStep(techMecanicien, "mechanical"), true);
assert.equal(isTechnicianCompatibleForStep(techMecanicien, "body"), false);

// Test service type override
assert.equal(isTechnicianCompatibleForStep(techMecanicien, "body", "mecanique"), true);
assert.equal(isTechnicianCompatibleForStep(techMecanicien, "body", "tolerie"), false);

// Test bay compatibility
assert.equal(isBayCompatibleForStep({ id: "bay_car", name: "Pont Car", zone: AtelierZone.CARROSSERIE }, "body"), true);
assert.equal(isBayCompatibleForStep({ id: "bay_car", name: "Pont Car", zone: AtelierZone.CARROSSERIE }, "mechanical"), false);
assert.equal(isBayCompatibleForStep({ id: "bay_gen", name: "Pont Gen", zone: AtelierZone.MECANIQUE_RAPIDE }, "body"), false);
assert.equal(isBayCompatibleForStep({ id: "bay_general_01", name: "Pont Poly" }, "body"), true);

console.log("planning-trade-compatibility.test.ts OK");
