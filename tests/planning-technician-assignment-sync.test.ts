import assert from "node:assert/strict";
import { DossierSAV, DossierStatus, UserRole } from "../src/types";
import { startRepairOrder } from "../src/sav-core";

console.log("Démarrage des tests planning-technician-assignment-sync...");

const dossier: DossierSAV = {
  id: "NIMR-SYNC-TEST",
  clientNom: "Client Sync",
  vehiculeImmatriculation: "111 TU 111",
  vehiculeVIN: "SYNCVIN001",
  statut: DossierStatus.TRAVAUX_PLANIFIES,
  dateReception: "2026-07-01T07:00:00.000Z",
  ordresReparation: [
    {
      id: "task-sync-1",
      designation: "Réparation électrique",
      tempsEstime: 1,
      tempsPasse: 0,
      status: "pending",
      isEstimatedDurationValidated: true,
      workshopStageId: "electrical",
      plannedTechnicianId: "tech_01",
    }
  ],
  stepServiceTypes: {},
  historiqueLogs: [],
  photosAvant: [],
} as unknown as DossierSAV;

const result = startRepairOrder([dossier], dossier.id, "task-sync-1", new Date("2026-07-01T08:15:00.000Z"));

assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.dossier.technicienId, "tech_01", "Le technicien du dossier doit être synchronisé à tech_01");
  assert.equal(result.dossier.statut, DossierStatus.EN_TRAVAUX, "Le statut du dossier doit passer à EN_TRAVAUX");
}

console.log("planning-technician-assignment-sync.test.ts OK");
