import assert from "node:assert/strict";
import fs from "node:fs";
import { getTaskStatusVisual } from "../src/task-status-visual";
import {
  getCurrentGanttTaskStatus,
  getUnplannedRepairOrderTargets,
} from "../src/workshop-planning-helpers";
import {
  getDefaultWorkshopSchedule,
  getDefaultWorkshopShiftProfiles,
  validateAvailabilityForSlot,
} from "../src/workshop-availability";
import {
  addCorrectiveComplaintTaskToDossier,
  applyComplaintTaskLinkToDossier,
  createCorrectiveTaskFromComplaint,
  linkComplaintToRepairOrder,
} from "../src/complaints-workflow";
import {
  ComplaintHistoryEntry,
  DossierPriority,
  DossierSAV,
  DossierStatus,
  InterventionType,
  ReclammationClient,
  RepairOrderLine,
  WorkshopAvailabilityConfig,
} from "../src/types";

console.log("Démarrage des tests workshop-planning-6h...");

function line(overrides: Partial<RepairOrderLine>): RepairOrderLine {
  return {
    id: "task_1",
    designation: "Contrôle bruit train avant",
    tempsEstime: 1,
    tempsPasse: 0,
    status: "pending",
    estimateSource: "manual",
    isEstimatedDurationValidated: true,
    ...overrides,
  };
}

function dossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return {
    id: "NIMR-2026-6H",
    clientNom: "Client Test",
    clientTelephone: "+216 55 111 001",
    deposantNom: "Client Test",
    deposantTelephone: "+216 55 111 001",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory",
    vehiculeImmatriculation: "123 TU 456",
    vehiculeVIN: "1HGCM82633A004352",
    vehiculeKilometrage: 12000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Bruit train avant à froid",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
    dateReception: "2026-06-19T08:00:00.000Z",
    dateSouhaiteeLivraison: "2026-06-19T17:00:00.000Z",
    statut: DossierStatus.TRAVAUX_PLANIFIES,
    ordresReparation: [line({})],
    complements: [],
    accords: [],
    checklistQC: { essaiEffectue: false, defautRepare: false, aucunVoyantAllume: false, niveauxVerifies: false, serrageSecurite: false, propreteVehicule: false, documentsPrets: false, photosApresOk: false, validationGlobale: "en_attente" },
    livraison: { controleQualiteOk: false, clientInforme: false, dateLivraisonPrevue: "2026-06-19", remarquesLivraison: "", confirmationReceptionClient: false, clotureInterne: false },
    prochaineActionRecommended: "",
    dateDernierStatut: "2026-06-19T08:00:00.000Z",
    avancementGlobal: 0,
    historiqueLogs: [],
    ...overrides,
  } as DossierSAV;
}

function complaint(overrides: Partial<ReclammationClient> = {}): ReclammationClient {
  return {
    id: "REC-2026-001",
    dossierId: "NIMR-2026-6H",
    clientNom: "Client Test",
    vehiculeNom: "DFSK Glory",
    immatriculation: "123 TU 456",
    motif: "Client signale un bruit persistant après restitution.",
    criticite: "haute",
    responsable: "Chef Atelier",
    statut: "nouvelle",
    actionCorrective: "À définir",
    delaiCible: "2026-06-20T08:00:00.000Z",
    delaiTraitement: "2026-06-20T08:00:00.000Z",
    dateCreation: "2026-06-19T08:00:00.000Z",
    historiqueActions: [] as ComplaintHistoryEntry[],
    historiqueLogs: [],
    ...overrides,
  };
}

{
  const blocked = getTaskStatusVisual("blocked");
  assert.equal(blocked.label, "Bloquée");
  assert.equal(blocked.testId, "gantt-task-status-blocked");
  assert.ok(blocked.badgeClassName.includes("red"));

  const current = dossier({ ordresReparation: [line({ id: "task_1", status: "blocked" })] });
  assert.equal(getCurrentGanttTaskStatus(current, "task_1", "pending"), "blocked");
  console.log("  OK statut Gantt dérivé de la tâche courante");
}

{
  const d = dossier({
    ordresReparation: [
      line({ id: "planned", planningStart: "2026-06-19T08:00:00.000Z", planningEnd: "2026-06-19T09:00:00.000Z", plannedTechnicianId: "tech_1", plannedBayId: "bay_1" }),
      line({ id: "done", status: "done" }),
      line({ id: "unplanned", designation: "Diagnostic réclamation", status: "pending" }),
    ],
  });
  assert.deepEqual(getUnplannedRepairOrderTargets([d]).map(target => target.line.id), ["unplanned"]);
  console.log("  OK suggestion limitée aux tâches non planifiées");
}

{
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [],
    shiftProfiles: getDefaultWorkshopShiftProfiles(),
    technicianShiftAssignments: [{
      id: "shift_1",
      technicianId: "tech_1",
      shiftProfileId: "shift_morning",
      startDate: "2026-06-19",
    }],
  };

  assert.equal(validateAvailabilityForSlot({
    startTime: "2026-06-19T08:00:00",
    endTime: "2026-06-19T09:00:00",
    technicianId: "tech_1",
    config,
  }).allowed, true);
  assert.equal(validateAvailabilityForSlot({
    startTime: "2026-06-19T14:00:00",
    endTime: "2026-06-19T15:00:00",
    technicianId: "tech_1",
    config,
  }).allowed, false);
  console.log("  OK validation créneau respecte équipe technicien");
}

{
  const rec = complaint();
  const linked = linkComplaintToRepairOrder(rec, "task_1");
  assert.deepEqual(linked.linkedRepairOrderIds, ["task_1"]);
  assert.equal(linked.statut, "en_analyse");

  const d = applyComplaintTaskLinkToDossier(dossier(), linked, "task_1");
  assert.equal(d.ordresReparation[0].sourceComplaintId, "REC-2026-001");
  assert.equal(d.ordresReparation[0].complaintBadge, true);

  const created = createCorrectiveTaskFromComplaint(linked, ["task_1"]);
  assert.equal(created.line.complaintBadge, true);
  assert.equal(created.complaint.correctiveTaskCreated, true);
  assert.equal(addCorrectiveComplaintTaskToDossier(d, created.line, created.complaint).ordresReparation.length, 2);
  console.log("  OK liaison réclamation-tâche et tâche corrective");
}

{
  const printSource = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");
  const detailSource = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const planningSource = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  assert.ok(printSource.includes("Fiche tâche technicien"));
  assert.ok(printSource.includes("Signature Technicien"));
  assert.ok(printSource.includes("Signature Chef Atelier"));
  assert.ok(printSource.includes("Contrôle Qualité"));
  assert.ok(detailSource.includes("print-task-sheet"));
  assert.ok(planningSource.includes("planning-reschedule-modal"));
  assert.ok(!planningSource.includes("planning-print-gantt"));
  assert.ok(!planningSource.includes("planning-print-table"));
  for (const forbidden of ["Ã", "Â", "�", "â€™", "â€œ", "â€", "âœ", "Å“"]) {
    assert.equal(planningSource.includes(forbidden), false, `Mojibake interdit dans WorkshopPlanning: ${forbidden}`);
    assert.equal(detailSource.includes(forbidden), false, `Mojibake interdit dans DossierDetail: ${forbidden}`);
  }
  console.log("  OK source impression, modal et mojibake");
}

console.log("workshop-planning-6h.test.ts OK");
