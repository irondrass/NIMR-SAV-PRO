import assert from "node:assert/strict";

import {
  buildDossierPlanningOverview,
  mapRepairLineToPlanningStep,
  releasePlanningStepReservation,
} from "../src/workshop-planning-steps";
import {
  DossierPriority,
  DossierSAV,
  DossierStatus,
  InterventionType,
  RepairOrderLine,
  UserRole,
  WorkshopAvailabilityConfig,
  WorkshopReservation,
} from "../src/types";
import { reserveSuggestedWorkshopSlot } from "../src/sav-core";
import { MOCK_TECHNICIENS } from "../src/data";
import { DEFAULT_WORKSHOP_BAYS } from "../src/workshop-bays";
import { getDefaultWorkshopSchedule, getDefaultWorkshopShiftProfiles } from "../src/workshop-availability";

function localIso(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function line(overrides: Partial<RepairOrderLine>): RepairOrderLine {
  return {
    id: overrides.id || "task-test",
    designation: overrides.designation || "Réparation mécanique",
    tempsEstime: overrides.tempsEstime ?? 1,
    tempsPasse: overrides.tempsPasse ?? 0,
    status: overrides.status || "pending",
    isEstimatedDurationValidated: overrides.isEstimatedDurationValidated ?? true,
    ...overrides,
  };
}

function dossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return {
    id: overrides.id || "NIMR-STEP-001",
    clientNom: "Client Étapes",
    clientTelephone: "+216 55 555 555",
    deposantNom: "Déposant",
    deposantTelephone: "+216 55 555 555",
    vehiculeMarque: "Forthing",
    vehiculeModele: "T5 EVO",
    vehiculeImmatriculation: "120 TU 6120",
    vehiculeVIN: "STEPVIN1234567890",
    vehiculeKilometrage: 42000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Contrôle atelier",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: {
      rayures: false,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: "",
    },
    objetsLaisses: [],
    dateReception: localIso("2026-06-24", 7),
    dateSouhaiteeLivraison: localIso("2026-06-25", 17),
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [],
    complements: [],
    accords: [],
    checklistQC: {
      essaiEffectue: false,
      defautRepare: false,
      aucunVoyantAllume: false,
      niveauxVerifies: false,
      serrageSecurite: false,
      propreteVehicule: false,
      documentsPrets: false,
      photosApresOk: false,
      validationGlobale: "en_attente",
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: localIso("2026-06-25", 17),
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false,
    },
    prochaineActionRecommended: "Planifier atelier",
    dateDernierStatut: localIso("2026-06-24", 7),
    avancementGlobal: 0,
    ...overrides,
  };
}

const availabilityConfig: WorkshopAvailabilityConfig = {
  schedule: getDefaultWorkshopSchedule(),
  exceptions: [],
  absences: [],
  bayUnavailabilities: [],
  holidays: [],
  shiftProfiles: getDefaultWorkshopShiftProfiles(),
};

function testMapping() {
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Vidange + filtre 2500 km" })).stepId, "quick-service");
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Bruit moteur et suspension" })).stepId, "mechanical");
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Défaut électrique batterie capteur" })).stepId, "electrical");
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Choc pare-chocs aile carrosserie" })).stepId, "body-disassembly");
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Préparation ponçage" })).stepId, "preparation");
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Peinture + vernis" })).stepId, "paint");
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Remontage ajustement" })).stepId, "reassembly");
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Finition + lavage préparation livraison" })).stepId, "finish");
  assert.equal(mapRepairLineToPlanningStep(line({ designation: "Contrôle qualité QC essai final" })).stepId, "quality");
  const fallback = mapRepairLineToPlanningStep(line({ designation: "Intervention atelier libre" }));
  assert.equal(fallback.stepId, "mechanical");
  assert.equal(fallback.needsConfirmation, true);
}

function testOverviewTotalsAndStatus() {
  const target = dossier({
    ordresReparation: [
      line({ id: "task-vidange", designation: "Vidange filtre", tempsEstime: 1.5 }),
      line({ id: "task-peinture", designation: "Peinture + vernis", tempsEstime: 2, isEstimatedDurationValidated: false }),
    ],
  });
  const overview = buildDossierPlanningOverview(target, []);
  const quick = overview.steps.find(step => step.stepId === "quick-service")!;
  const paint = overview.steps.find(step => step.stepId === "paint")!;
  const unused = overview.steps.find(step => step.stepId === "quality")!;

  assert.equal(quick.active, true);
  assert.equal(paint.active, true);
  assert.equal(unused.active, false);
  assert.equal(quick.estimatedHours, 1.5);
  assert.equal(paint.unvalidatedDurationCount, 1);
  assert.equal(overview.totalEstimatedHours, 1.5);
  assert.equal(overview.totalReservedHours, 0);
  assert.equal(overview.workshopMarginHours, 1.5);
  assert.equal(overview.planningComplete, false);
}

function testCompletePlanningAndReschedulableLine() {
  const target = dossier({
    ordresReparation: [
      line({
        id: "task-planned",
        designation: "Réparation mécanique freinage",
        tempsEstime: 1,
        planningStart: localIso("2026-06-24", 8),
        planningEnd: localIso("2026-06-24", 9),
        planningSegments: [{ start: localIso("2026-06-24", 8), end: localIso("2026-06-24", 9) }],
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_fast_01",
      }),
    ],
  });
  const overview = buildDossierPlanningOverview(target, []);
  const mechanical = overview.steps.find(step => step.stepId === "mechanical")!;

  assert.equal(overview.planningComplete, true);
  assert.equal(mechanical.isFullyReserved, true);
  assert.equal(mechanical.reschedulableLine?.id, "task-planned");
  assert.equal(mechanical.nextReservableLine, undefined);
}

function testReleasePlanningStep() {
  const target = dossier({
    ordresReparation: [
      line({
        id: "task-release",
        designation: "Réparation mécanique",
        tempsEstime: 1,
        planningStart: localIso("2026-06-24", 8),
        planningEnd: localIso("2026-06-24", 9),
        planningSegments: [{ start: localIso("2026-06-24", 8), end: localIso("2026-06-24", 9) }],
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_fast_01",
      }),
    ],
  });
  const reservations: WorkshopReservation[] = [{
    reservationId: "res-release",
    dossierId: target.id,
    taskIds: ["task-release"],
    totalHours: 1,
    desiredDate: localIso("2026-06-24", 8),
    startTime: localIso("2026-06-24", 8),
    endTime: localIso("2026-06-24", 9),
    segments: [{ start: localIso("2026-06-24", 8), end: localIso("2026-06-24", 9) }],
    technicianId: "tech_01",
    bayId: "bay_fast_01",
    status: "TRANSFORMEE_PLANNING",
    source: "planning-suggestion",
    history: [],
  }];

  const result = releasePlanningStepReservation(target, reservations, "mechanical", new Date(localIso("2026-06-24", 10)));
  assert.deepEqual(result.releasedTaskIds, ["task-release"]);
  assert.equal(result.dossier.ordresReparation[0].planningStart, undefined);
  assert.equal(result.reservations[0].status, "ANNULEE");

  const overview = buildDossierPlanningOverview(result.dossier, result.reservations);
  assert.equal(overview.totalReservedHours, 0);
  assert.equal(overview.planningComplete, false);
}

function testEtaAfterStepReservation() {
  const target = dossier({
    id: "NIMR-STEP-ETA",
    ordresReparation: [
      line({ id: "task-eta-step", designation: "Vidange filtre", tempsEstime: 1 }),
    ],
  });
  const result = reserveSuggestedWorkshopSlot({
    role: UserRole.CHEF_ATELIER,
    dossiers: [target],
    reservations: [],
    dossierId: target.id,
    lineId: "task-eta-step",
    suggestion: {
      technicianId: "tech_01",
      technicianName: "Technicien 1",
      bayId: "bay_fast_01",
      bayName: "Pont rapide 1",
      startTime: localIso("2026-06-24", 8),
      endTime: localIso("2026-06-24", 9),
      segments: [{ start: localIso("2026-06-24", 8), end: localIso("2026-06-24", 9) }],
      reason: "Test",
      technicianLoad: 0,
      bayAvailability: "Disponible",
    },
    technicians: MOCK_TECHNICIENS,
    workshopBays: DEFAULT_WORKSHOP_BAYS,
    availabilityConfig,
  }, new Date(localIso("2026-06-24", 7)));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const overview = buildDossierPlanningOverview(result.dossier, result.reservations);
  assert.equal(overview.planningComplete, true);
  assert.equal(result.eta.plannedTaskCount, 1);
  assert.equal(result.eta.unplannedTaskCount, 0);
}

testMapping();
testOverviewTotalsAndStatus();
testCompletePlanningAndReschedulableLine();
testReleasePlanningStep();
testEtaAfterStepReservation();

console.log("✓ workshop-planning-steps.test.ts OK");
