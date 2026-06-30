import assert from "node:assert/strict";
import {
  cancelWorkshopTaskAdministratively,
  deleteWorkshopTask,
  getWorkshopTaskDeletionReadiness,
  releaseWorkshopTaskReservation,
  WORKSHOP_TASK_DELETION_MESSAGES,
} from "../src/core/workshop-tasks";
import { createReceptionDossier, getDossierQCStatus, isRepairOrderDone } from "../src/sav-core";
import {
  DossierPriority,
  DossierSAV,
  DossierStatus,
  InterventionType,
  RepairOrderLine,
  UserRole,
  WorkshopReservation,
} from "../src/types";

function baseDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  const dossier = createReceptionDossier({
    clientNom: "Client Test",
    clientTelephone: "+216 55 000 001",
    deposantNom: "Client Test",
    deposantTelephone: "+216 55 000 001",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 500",
    vehiculeImmatriculation: "123 TU 4567",
    vehiculeVIN: "1HGCM82633A004352",
    vehiculeKilometrage: 12000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Bruit atelier",
    observationsReception: "RAS",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
  }, [], new Date("2026-06-30T08:00:00.000Z"));
  return { ...dossier, id: "NIMR-TEST-DELETE", ...overrides };
}

function task(overrides: Partial<RepairOrderLine> = {}): RepairOrderLine {
  return {
    id: "task-delete-1",
    designation: "Diagnostic freinage",
    tempsEstime: 1,
    tempsPasse: 0,
    status: "pending",
    isEstimatedDurationValidated: true,
    ...overrides,
  };
}

function reservation(taskId = "task-delete-1"): WorkshopReservation {
  return {
    reservationId: "res-delete-1",
    dossierId: "NIMR-TEST-DELETE",
    taskIds: [taskId],
    totalHours: 1,
    desiredDate: "2026-07-01T08:00:00.000Z",
    startTime: "2026-07-01T08:00:00.000Z",
    endTime: "2026-07-01T09:00:00.000Z",
    technicianId: "tech_01",
    bayId: "bay_01",
    status: "RESERVATION_CONFIRMEE",
    source: "test",
    history: [],
  };
}

{
  const dossier = baseDossier({ ordresReparation: [task()] });
  const readiness = getWorkshopTaskDeletionReadiness(dossier, "task-delete-1", []);
  assert.equal(readiness.canDeletePhysically, true);

  const result = deleteWorkshopTask(dossier, [], "task-delete-1", "Erreur de saisie", UserRole.CHEF_ATELIER);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.dossier.ordresReparation.length, 0);
    assert.ok(result.dossier.historiqueLogs?.[0].includes("Tâche atelier supprimée"));
  }
}

{
  const dossier = baseDossier({ ordresReparation: [task({ planningStart: "2026-07-01T08:00:00.000Z" })] });
  const res = reservation();
  const readiness = getWorkshopTaskDeletionReadiness(dossier, "task-delete-1", [res]);
  assert.equal(readiness.canDeletePhysically, false);
  assert.equal(readiness.canReleaseReservation, true);
  assert.equal(readiness.blockReason, WORKSHOP_TASK_DELETION_MESSAGES.reserved);

  const released = releaseWorkshopTaskReservation(dossier, [res], "task-delete-1", new Date("2026-06-30T09:00:00.000Z"));
  assert.equal(released.ok, true);
  if (released.ok) {
    assert.equal(released.reservations?.[0].status, "ANNULEE");
    assert.equal(released.dossier.ordresReparation[0].planningStart, undefined);
  }
}

for (const [status, message] of [
  ["in_progress", WORKSHOP_TASK_DELETION_MESSAGES.inProgress],
  ["paused", WORKSHOP_TASK_DELETION_MESSAGES.paused],
  ["blocked", WORKSHOP_TASK_DELETION_MESSAGES.blocked],
] as const) {
  const dossier = baseDossier({ ordresReparation: [task({ status })] });
  const readiness = getWorkshopTaskDeletionReadiness(dossier, "task-delete-1", []);
  assert.equal(readiness.canDeletePhysically, false);
  assert.equal(readiness.blockReason, message);
}

{
  const dossier = baseDossier({
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [task({ status: "done", tempsPasse: 1 })],
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
    },
  });
  const readiness = getWorkshopTaskDeletionReadiness(dossier, "task-delete-1", []);
  assert.equal(readiness.canDeletePhysically, false);
  assert.equal(readiness.canCancelAdministratively, true);

  const result = cancelWorkshopTaskAdministratively(
    dossier,
    [],
    "task-delete-1",
    "Travail supprimé du périmètre validé",
    UserRole.CHEF_ATELIER
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.dossier.ordresReparation[0].status, "cancelled");
    assert.equal(isRepairOrderDone(result.dossier.ordresReparation[0]), true);
    assert.equal(getDossierQCStatus(result.dossier).status, "to_recheck");
    assert.equal(result.dossier.ordresReparation[0].history?.[0].includes("Annulée par Chef Atelier"), true);
  }
}

{
  const dossier = baseDossier({ ordresReparation: [task()] });
  const result = deleteWorkshopTask(dossier, [], "task-delete-1", "non", UserRole.CHEF_ATELIER);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, WORKSHOP_TASK_DELETION_MESSAGES.missingReason);
}

