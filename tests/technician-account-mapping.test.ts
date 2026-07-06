import assert from "node:assert/strict";
import { startRepairOrder, isTechnicianCompatibleForStep } from "../src/sav-core";
import { DossierSAV, DossierStatus, RepairOrderLine, TechnicienResource, AtelierZone } from "../src/types";

console.log("Running technician-account-mapping.test.ts...");

const mockTechnicians: TechnicienResource[] = [
  {
    id: "tech_01",
    nom: "Amine",
    specialite: "Diagnostic Électrique / Hybride",
    actif: true,
    zoneAffectee: AtelierZone.ELECTRICITE_DIAG,
    shiftProfileId: "shift_default",
  },
  {
    id: "tech_02",
    nom: "Bassem",
    specialite: "Diagnostic Électrique / Hybride",
    actif: false, // inactive
    zoneAffectee: AtelierZone.ELECTRICITE_DIAG,
    shiftProfileId: "shift_default",
  }
];

const taskLine: RepairOrderLine = {
  id: "task-elec-1",
  designation: "Diag elec",
  tempsEstime: 2,
  tempsPasse: 0,
  status: "pending",
};

const dossier: DossierSAV = {
  id: "DOS-TEST-1",
  statut: DossierStatus.EN_TRAVAUX,
  ordresReparation: [taskLine],
  stepServiceTypes: {
    "task-elec-1": "electrique"
  },
  vehiculeImmatriculation: "123 TN 123",
  vehiculeVIN: "VIN123",
  dateReception: new Date().toISOString(),
  dateDernierStatut: new Date().toISOString(),
  historiqueLogs: [],
  operationalTraces: [],
};

// Test active compatibility check
assert.equal(isTechnicianCompatibleForStep(mockTechnicians[0], "task-elec-1", "electrique"), true);
assert.equal(isTechnicianCompatibleForStep(mockTechnicians[1], "task-elec-1", "electrique"), true); // inactive but still has specialty

// Test starting task with active compatible tech
const dossiers = [dossier];
dossier.technicienId = "tech_01";
const res1 = startRepairOrder(dossiers, "DOS-TEST-1", "task-elec-1", new Date(), mockTechnicians);
assert.equal(res1.ok, true);

// Test starting task with inactive tech
dossier.technicienId = "tech_02";
const res2 = startRepairOrder(dossiers, "DOS-TEST-1", "task-elec-1", new Date(), mockTechnicians);
assert.equal(res2.ok, false);
assert.equal(res2.error, "Affectation impossible : le technicien affecté est inactif.");

// Test starting task with incompatible tech
dossier.technicienId = "tech_01";
dossier.stepServiceTypes = { "task-elec-1": "tolerie" }; // incompatible
const res3 = startRepairOrder(dossiers, "DOS-TEST-1", "task-elec-1", new Date(), mockTechnicians);
assert.equal(res3.ok, false);
assert.equal(res3.error, "Affectation impossible : métier incompatible.");

console.log("technician-account-mapping.test.ts passed!");
