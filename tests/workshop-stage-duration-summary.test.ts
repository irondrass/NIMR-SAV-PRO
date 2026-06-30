/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { suggestWorkshopSlot } from "../src/sav-core";
import { getDefaultWorkshopSchedule, getDefaultWorkshopShiftProfiles } from "../src/workshop-availability";
import { AtelierZone, DossierPriority, DossierSAV, DossierStatus, InterventionType, TechnicienResource, WorkshopAvailabilityConfig, WorkshopBay, WorkshopReservation } from "../src/types";
import { createManualWorkshopTaskLine } from "../src/workshop-task-intake";
import { buildStageReservationNeeds, buildWorkshopStageDurationSummary } from "../src/workshop-task-intake";

console.log("Démarrage des tests workshop-stage-duration-summary...");

const technician: TechnicienResource = {
  id: "tech_single",
  nom: "Technicien Fictif",
  specialite: "Mécanique",
  disponibilite: "disponible",
  compétences: ["Mécanique"],
  zoneAffectee: AtelierZone.GRANDS_TRAVAUX,
  absencesConges: [],
  capaciteJournaliere: 8,
  chargeActuelle: 0,
};

const bay: WorkshopBay = { id: "bay_single", name: "Pont fictif", zone: AtelierZone.GRANDS_TRAVAUX };
const availabilityConfig: WorkshopAvailabilityConfig = {
  schedule: getDefaultWorkshopSchedule(),
  exceptions: [],
  absences: [],
  bayUnavailabilities: [],
  holidays: [],
  shiftProfiles: getDefaultWorkshopShiftProfiles(),
};

const dossier: DossierSAV = {
  id: "NIMR-STAGE-001",
  clientNom: "Client Fictif",
  clientTelephone: "+216 20 000 000",
  deposantNom: "Client Fictif",
  deposantTelephone: "+216 20 000 000",
  vehiculeMarque: "Dongfeng",
  vehiculeModele: "BOX EV 430",
  vehiculeImmatriculation: "123 TU 456",
  vehiculeVIN: "VIN-STAGE-001",
  vehiculeKilometrage: 1200,
  vehiculeCouleur: "Blanc",
  typeDossier: InterventionType.MECANIQUE_GENERALE,
  priorite: DossierPriority.NORMALE,
  plainteClient: "Synthèse étape fictive",
  observationsReception: "",
  photosAvant: [],
  niveauCarburant: 50,
  etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
  objetsLaisses: [],
  dateReception: "2026-06-30T08:00:00.000Z",
  dateSouhaiteeLivraison: "2026-07-02T08:00:00.000Z",
  statut: DossierStatus.EN_TRAVAUX,
  ordresReparation: [
    createManualWorkshopTaskLine({ id: "task_fast", label: "Vidange moteur", stageId: "quick-service", estimatedHours: 1 }),
    createManualWorkshopTaskLine({ id: "task_mech", label: "Remplacement support moteur", stageId: "mechanical", estimatedHours: 2 }),
  ],
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
    dateLivraisonPrevue: "2026-07-02T08:00:00.000Z",
    remarquesLivraison: "",
    confirmationReceptionClient: false,
    clotureInterne: false,
  },
  prochaineActionRecommended: "",
  dateDernierStatut: "2026-06-30T08:00:00.000Z",
  avancementGlobal: 0,
};

const partialReservation: WorkshopReservation = {
  reservationId: "res_fast",
  dossierId: dossier.id,
  taskIds: ["task_fast"],
  totalHours: 1,
  desiredDate: "2026-07-01T08:00:00.000Z",
  startTime: "2026-07-01T08:00:00.000Z",
  endTime: "2026-07-01T09:00:00.000Z",
  segments: [{ start: "2026-07-01T08:00:00.000Z", end: "2026-07-01T09:00:00.000Z" }],
  technicianId: technician.id,
  bayId: bay.id,
  status: "RESERVATION_CONFIRMEE",
  source: "test",
  history: [],
};

const summary = buildWorkshopStageDurationSummary(dossier, [partialReservation]);
const quickService = summary.find(row => row.stepId === "quick-service");
const mechanical = summary.find(row => row.stepId === "mechanical");

assert.equal(quickService?.taskCount, 1);
assert.equal(quickService?.durationHours, 1);
assert.equal(quickService?.reservationStatus, "Réservé");
assert.equal(mechanical?.taskCount, 1);
assert.equal(mechanical?.durationHours, 2);
assert.equal(mechanical?.reservationStatus, "Non réservé");

const needs = buildStageReservationNeeds(dossier, [partialReservation]);
assert.deepEqual(needs.map(need => need.stepId), ["mechanical"]);
assert.equal(needs[0].totalHours, 2);

const blockingStart = new Date(2026, 6, 1, 8, 0, 0);
const blockingEnd = new Date(2026, 6, 1, 10, 0, 0);
const blockingReservation: WorkshopReservation = {
  reservationId: "res_blocking",
  dossierId: "NIMR-OTHER-001",
  taskIds: ["task_other"],
  totalHours: 2,
  desiredDate: blockingStart.toISOString(),
  startTime: blockingStart.toISOString(),
  endTime: blockingEnd.toISOString(),
  segments: [{ start: blockingStart.toISOString(), end: blockingEnd.toISOString() }],
  technicianId: technician.id,
  bayId: bay.id,
  status: "RESERVATION_CONFIRMEE",
  source: "test",
  history: [],
};

const suggestion = suggestWorkshopSlot({
  dossiers: [dossier],
  technicians: [technician],
  workshopBays: [bay],
  estimatedHours: 1,
  desiredDate: blockingStart,
  dossierId: dossier.id,
  reservations: [blockingReservation],
  availabilityConfig,
}, new Date(2026, 6, 1, 7, 0, 0));

assert.ok(
  new Date(suggestion.startTime).getTime() >= new Date(blockingReservation.endTime!).getTime(),
  "Le premier créneau proposé doit éviter une réservation active existante."
);

console.log("✅ workshop-stage-duration-summary OK");
