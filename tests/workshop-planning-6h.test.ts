import assert from "node:assert/strict";
import fs from "node:fs";
import { getTaskStatusVisual } from "../src/task-status-visual";
import {
  getCurrentGanttTaskStatus,
  getGanttTaskVisualState,
  getRepairOrderPlanningSegmentsForDate,
  getUnplannedRepairOrderTargets,
  isActivePlannedTask,
} from "../src/workshop-planning-helpers";
import {
  buildScheduleFromShiftProfileDraft,
  deriveShiftProfileDraft,
  getDefaultWorkshopSchedule,
  getDefaultWorkshopShiftProfiles,
  summarizeShiftProfileDraft,
  validateShiftProfileDraft,
  validateAvailabilityForSlot,
} from "../src/workshop-availability";
import {
  addCorrectiveComplaintTaskToDossier,
  applyComplaintTaskLinkToDossier,
  createCorrectiveTaskFromComplaint,
  linkComplaintToRepairOrder,
} from "../src/complaints-workflow";
import { validatePlanningAssignment } from "../src/sav-core";
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
  const planned = line({
    id: "planned_no_date",
    planningStart: "2026-06-19T08:00:00.000Z",
    planningEnd: "2026-06-19T09:00:00.000Z",
    plannedTechnicianId: "tech_1",
    plannedBayId: "bay_1",
  });
  const d = dossier({ ordresReparation: [planned] });
  assert.equal(isActivePlannedTask(planned, d, "2026-06-19"), true);
  assert.equal(getRepairOrderPlanningSegmentsForDate(planned, "2026-06-19").length, 1);
  assert.equal(getGanttTaskVisualState(planned, new Date("2026-06-19T07:00:00.000Z"), d), "planned_future");
  assert.equal(getGanttTaskVisualState(planned, new Date("2026-06-19T08:30:00.000Z"), d), "due_now_not_started");
  assert.equal(getGanttTaskVisualState(planned, new Date("2026-06-19T10:00:00.000Z"), d), "overdue_unfinished");

  const running = line({ ...planned, id: "running", status: "in_progress" });
  assert.equal(getGanttTaskVisualState(running, new Date("2026-06-19T08:30:00.000Z"), d), "in_progress");

  const blocked = line({ ...planned, id: "blocked", status: "blocked" });
  assert.equal(getGanttTaskVisualState(blocked, new Date("2026-06-19T08:30:00.000Z"), d), "blocked");

  const qcReturn = line({ ...planned, id: "qc_return", status: "reopened" });
  assert.equal(getGanttTaskVisualState(qcReturn, new Date("2026-06-19T08:30:00.000Z"), d), "qc_return");

  const done = line({ ...planned, id: "done", status: "done" });
  assert.equal(isActivePlannedTask(done, dossier({ ordresReparation: [done] }), "2026-06-19"), false);
  assert.equal(isActivePlannedTask(planned, dossier({ statut: DossierStatus.ANNULE, ordresReparation: [planned] }), "2026-06-19"), false);
  assert.equal(isActivePlannedTask(planned, dossier({
    ordresReparation: [planned],
    checklistQC: { ...d.checklistQC, validationGlobale: "valide" },
  }), "2026-06-19"), false);
  console.log("  OK Gantt tâches planifiées actives et états visuels");
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
  const draft = {
    name: "Équipe pilote",
    dayStart: "07:30",
    dayEnd: "18:00",
    pauseEnabled: true,
    pauseStart: "12:30",
    pauseEnd: "13:15",
    activeDays: [1, 2, 3, 4, 5, 6],
  };
  const validation = validateShiftProfileDraft(draft);
  assert.equal(validation.valid, true);
  assert.equal(validation.capacityMinutes, 585);
  const schedule = buildScheduleFromShiftProfileDraft(draft);
  assert.deepEqual(schedule.days.find(day => day.dayOfWeek === 1)?.windows, [
    { start: "07:30", end: "12:30" },
    { start: "13:15", end: "18:00" },
  ]);
  assert.equal(schedule.days.find(day => day.dayOfWeek === 0)?.isClosed, true);
  assert.ok(summarizeShiftProfileDraft(draft).includes("9h45/j"));

  const restoredDraft = deriveShiftProfileDraft({
    id: "shift_pilot",
    name: "Équipe pilote",
    active: true,
    schedule,
  });
  assert.deepEqual(restoredDraft.activeDays, [1, 2, 3, 4, 5, 6]);
  assert.equal(restoredDraft.pauseEnabled, true);
  assert.equal(validateShiftProfileDraft({ ...draft, dayEnd: "22:00" }).valid, false);
  assert.equal(validateShiftProfileDraft({ ...draft, pauseStart: "06:30" }).valid, false);
  console.log("  OK profils horaires configurables validés");
}

{
  const schedule = buildScheduleFromShiftProfileDraft({
    name: "Équipe journée pilote",
    dayStart: "09:00",
    dayEnd: "18:00",
    pauseEnabled: true,
    pauseStart: "12:00",
    pauseEnd: "13:00",
    activeDays: [1, 2, 3, 4, 5, 6],
  });
  const config: WorkshopAvailabilityConfig = {
    schedule,
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [],
    shiftProfiles: [{
      id: "shift_standard",
      name: "Équipe journée pilote",
      active: true,
      schedule,
    }],
  };
  const task = line({ id: "task_shift_validation", tempsEstime: 1 });
  const d = dossier({ id: "NIMR-2026-6J-SHIFT", ordresReparation: [task] });

  const allowed = validatePlanningAssignment({
    dossiers: [d],
    dossierId: d.id,
    lineId: task.id,
    technicianId: "tech_shift",
    bayId: "bay_shift",
    start: "2026-06-19T17:00:00",
    end: "2026-06-19T18:00:00",
    reservations: [],
    availabilityConfig: config,
  }, new Date("2026-06-19T07:00:00"));
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.segments.length, 1);
  assert.equal(new Date(allowed.segments[0].start).getHours(), 17);

  const tooEarly = validatePlanningAssignment({
    dossiers: [d],
    dossierId: d.id,
    lineId: task.id,
    technicianId: "tech_shift",
    bayId: "bay_shift",
    start: "2026-06-19T08:00:00",
    end: "2026-06-19T09:00:00",
    reservations: [],
    availabilityConfig: config,
  }, new Date("2026-06-19T07:00:00"));
  assert.equal(tooEarly.allowed, false);
  assert.ok(tooEarly.codes.includes("outside-effective-working-hours") || tooEarly.codes.includes("planning-segments-invalid"));
  console.log("  OK validation planning respecte les horaires configurés");
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
