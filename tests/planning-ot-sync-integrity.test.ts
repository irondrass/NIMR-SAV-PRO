import assert from "node:assert/strict";
import { synchronizeDossiersWithReservations, getVehicleETAInfo } from "../src/sav-core";
import { DossierSAV, DossierStatus, RepairOrderLine, WorkshopReservation, AtelierZone } from "../src/types";

import { makeTestDossier } from "./test-fixtures";

console.log("Running planning-ot-sync-integrity.test.ts...");

const taskLine: RepairOrderLine = {
  id: "task-elec-1",
  designation: "Diag elec",
  tempsEstime: 2,
  tempsPasse: 0,
  status: "pending",
};

const dossier = makeTestDossier({
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
});

const reservation: WorkshopReservation = {
  reservationId: "res-1",
  dossierId: "DOS-TEST-1",
  taskIds: ["task-elec-1"],
  totalHours: 2,
  desiredDate: "2026-06-12",
  technicianId: "tech_01", // compatible
  bayId: "bay_diag_01",
  status: "RESERVATION_CONFIRMEE",
  source: "test",
  history: [],
};

// Test automatic synchronization
const synced = synchronizeDossiersWithReservations([dossier], [reservation]);
assert.equal(synced[0].ordresReparation[0].plannedTechnicianId, "tech_01");
assert.equal(synced[0].ordresReparation[0].plannedBayId, "bay_diag_01");

// Test incompatible technician lowers reliability to Faible
const incompatibleReservation: WorkshopReservation = {
  ...reservation,
  technicianId: "tech_04", // Painter or Sheet metal (incompatible with elec)
};

const syncedIncompatible = synchronizeDossiersWithReservations([dossier], [incompatibleReservation]);
// Should not overwrite planned fields if incompatible, or if it does, getVehicleETAInfo will downgrade ETA reliability
const etaInfo = getVehicleETAInfo(syncedIncompatible, "DOS-TEST-1", [incompatibleReservation]);
assert.equal(etaInfo.reliability, "Faible");

console.log("planning-ot-sync-integrity.test.ts passed!");
