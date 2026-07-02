import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isTechnicianPlanifiableResource,
  suggestWorkshopSlot,
} from "../src/sav-core";
import { AtelierZone, TechnicienResource, WorkshopBay } from "../src/types";

console.log("Démarrage des tests runtime-resource-setup...");

const appSource = fs.readFileSync("src/App.tsx", "utf8");
const planningSource = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");

assert.ok(appSource.includes("loadStoredArray(STORAGE_KEYS.techs, [], isTechnicienResource)"));
assert.equal(appSource.includes("MOCK_TECHNICIENS"), false, "App ne doit pas réinjecter de ressources démo au démarrage.");
assert.ok(planningSource.includes("Configuration ressources atelier"));
assert.ok(planningSource.includes("Aucune ressource atelier configurée. Créez les ressources avant planification."));
assert.ok(planningSource.includes("onUpdateTechnicians"));
assert.ok(planningSource.includes("userId"));

function technician(input: Partial<TechnicienResource>): TechnicienResource {
  return {
    id: input.id || "tech_test",
    nom: input.nom || "Ressource Test",
    specialite: input.specialite || "Mécanicien",
    disponibilite: input.disponibilite || "disponible",
    compétences: input.compétences || [input.specialite || "Mécanicien"],
    zoneAffectee: input.zoneAffectee || AtelierZone.GRANDS_TRAVAUX,
    absencesConges: [],
    capaciteJournaliere: 8,
    chargeActuelle: 0,
    actif: input.actif,
    userId: input.userId,
  };
}

const bays: WorkshopBay[] = [
  { id: "bay_mec", name: "Pont mécanique", zone: AtelierZone.GRANDS_TRAVAUX },
  { id: "bay_paint", name: "Cabine peinture", zone: AtelierZone.PEINTURE },
];

const mecanicien = technician({ id: "tech_meca", specialite: "Mécanicien", zoneAffectee: AtelierZone.GRANDS_TRAVAUX });
const peintre = technician({ id: "tech_paint", specialite: "Peintre", zoneAffectee: AtelierZone.PEINTURE });
const inactive = technician({ id: "tech_inactive", nom: "Inactif", actif: false });

assert.equal(isTechnicianPlanifiableResource(mecanicien), true);
assert.equal(isTechnicianPlanifiableResource(inactive), false);

const now = new Date("2026-07-02T07:00:00.000Z");
const mechanicalSlot = suggestWorkshopSlot({
  dossiers: [],
  technicians: [mecanicien],
  workshopBays: bays,
  estimatedHours: 1,
  desiredDate: "2026-07-03T08:00:00.000Z",
  stepId: "mechanical",
}, now);
assert.equal(mechanicalSlot.technicianId, "tech_meca");

const paintSlot = suggestWorkshopSlot({
  dossiers: [],
  technicians: [peintre],
  workshopBays: bays,
  estimatedHours: 1,
  desiredDate: "2026-07-03T08:00:00.000Z",
  stepId: "paint",
}, now);
assert.equal(paintSlot.technicianId, "tech_paint");

const inactiveSlot = suggestWorkshopSlot({
  dossiers: [],
  technicians: [inactive],
  workshopBays: bays,
  estimatedHours: 1,
  desiredDate: "2026-07-03T08:00:00.000Z",
  stepId: "mechanical",
}, now);
assert.equal(inactiveSlot.technicianId, "tech_virtual");

console.log("runtime-resource-setup.test.ts OK");
