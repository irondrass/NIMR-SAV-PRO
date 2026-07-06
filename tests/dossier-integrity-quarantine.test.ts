import assert from "node:assert/strict";
import { applyDossierIntegrityAudit } from "../src/sav-core";
import { DossierSAV, DossierStatus, RepairOrderLine, UserRole } from "../src/types";

import { makeTestDossier } from "./test-fixtures";

console.log("Running dossier-integrity-quarantine.test.ts...");

const openTask: RepairOrderLine = {
  id: "task-1",
  designation: "Travail ouvert",
  tempsEstime: 2,
  tempsPasse: 0,
  status: "in_progress",
};

const dossierIncoherent = makeTestDossier({
  id: "DOS-INC-1",
  statut: DossierStatus.PRET_A_LIVRER,
  ordresReparation: [openTask],
  vehiculeImmatriculation: "123 TN 123",
  vehiculeVIN: "VIN123",
  dateReception: new Date().toISOString(),
  dateDernierStatut: new Date().toISOString(),
  historiqueLogs: [],
  operationalTraces: [],
});

const auditResult = applyDossierIntegrityAudit(dossierIncoherent, UserRole.DIRECTEUR_SAV);
assert.equal(auditResult.modified, true);
assert.equal(auditResult.dossier.statut, DossierStatus.EN_TRAVAUX);
assert.ok(auditResult.dossier.operationalTraces?.some(
  trace => trace.type === ("integrity_check_failure" as any) &&
  trace.message.includes("travaux ouverts")
));

const dossierCoherent = makeTestDossier({
  id: "DOS-READY-1",
  statut: DossierStatus.PRET_A_LIVRER,
  ordresReparation: [
    {
      ...openTask,
      id: "task-done-1",
      status: "done",
      tempsPasse: 2,
    },
  ],
  checklistQC: {
    essaiEffectue: true,
    defautRepare: true,
    aucunVoyantAllume: true,
    niveauxVerifies: true,
    serrageSecurite: true,
    propreteVehicule: true,
    documentsPrets: true,
    photosApresOk: true,
    validationGlobale: "valide",
    dateValidation: "2026-06-15T10:00:00.000Z",
    validePar: "Contrôle Qualité",
  },
});

const coherentAuditResult = applyDossierIntegrityAudit(dossierCoherent, UserRole.DIRECTEUR_SAV);
assert.equal(coherentAuditResult.modified, false);
assert.equal(coherentAuditResult.dossier.statut, DossierStatus.PRET_A_LIVRER);

console.log("dossier-integrity-quarantine.test.ts passed!");
