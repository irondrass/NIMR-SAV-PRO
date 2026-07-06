import assert from "node:assert/strict";
import { isRepairOrderDone } from "../src/sav-core";
import { DossierSAV, DossierStatus, RepairOrderLine } from "../src/types";

import { makeTestDossier } from "./test-fixtures";

console.log("Running qc-block-no-modal-contract.test.ts...");

const openTask: RepairOrderLine = {
  id: "task-1",
  designation: "Diag elec",
  tempsEstime: 2,
  tempsPasse: 0,
  status: "in_progress",
};

const dossier = makeTestDossier({
  id: "DOS-TEST-1",
  statut: DossierStatus.EN_TRAVAUX,
  ordresReparation: [openTask],
  vehiculeImmatriculation: "123 TN 123",
  vehiculeVIN: "VIN123",
  dateReception: new Date().toISOString(),
  dateDernierStatut: new Date().toISOString(),
  historiqueLogs: [],
  operationalTraces: [],
});

const hasOpenTasks = !dossier.ordresReparation.every(isRepairOrderDone);
assert.equal(hasOpenTasks, true, "Should detect open tasks");

console.log("qc-block-no-modal-contract.test.ts passed!");
