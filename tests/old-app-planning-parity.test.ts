import assert from "node:assert/strict";
import { MOCK_TECHNICIENS } from "../src/data";
import { DEFAULT_WORKSHOP_BAYS } from "../src/workshop-bays";
import { getDefaultWorkshopSchedule } from "../src/workshop-availability";
import { buildVehicleAutoReservationPlan, getVehicleETAInfo, suggestWorkshopSlot } from "../src/sav-core";
import { DossierSAV, DossierStatus, WorkshopAvailabilityConfig } from "../src/types";

console.log("Démarrage des tests old-app-planning-parity...");

function localDate(date: string, hour: number, minute = 0): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

const dossier = {
  id: "NIMR-OLD-PLAN",
  clientNom: "Client Old Planning",
  vehiculeImmatriculation: "901 TU 9010",
  vehiculeVIN: "OLDPLANNINGVIN001",
  statut: DossierStatus.VEHICULE_RECU,
  dateReception: "2026-07-01T07:00:00.000Z",
  ordresReparation: [{
    id: "task-old-slot",
    designation: "Vidange / entretien rapide",
    tempsEstime: 1,
    tempsPasse: 0,
    status: "pending",
    isEstimatedDurationValidated: true,
    workshopStageId: "quick-service",
  }],
} as DossierSAV;

const availabilityConfig: WorkshopAvailabilityConfig = {
  schedule: getDefaultWorkshopSchedule(),
  exceptions: [],
  absences: [],
  bayUnavailabilities: [],
  holidays: [],
};

const result = buildVehicleAutoReservationPlan({
  dossiers: [dossier],
  reservations: [],
  targetDossierId: dossier.id,
  selectedDate: localDate("2026-07-01", 8),
  technicians: MOCK_TECHNICIENS,
  workshopBays: DEFAULT_WORKSHOP_BAYS,
  availabilityConfig,
}, localDate("2026-07-01", 7));

assert.equal(result.ok, true, "La réservation premier slot doit réussir");
if (result.ok) {
  assert.equal(result.createdReservations.length, 1);
  assert.match(result.createdReservations[0].startTime || "", /T0?8:00:00|T07:00:00/, "Le premier créneau doit démarrer à l'ouverture locale");
  const eta = getVehicleETAInfo([dossier], dossier.id, result.reservations);
  assert.ok(eta.etaDateTime, "L'ETA livraison doit être recalculée depuis la réservation");
}

const chainedSlot = suggestWorkshopSlot({
  dossiers: [dossier],
  reservations: [],
  technicians: MOCK_TECHNICIENS,
  workshopBays: DEFAULT_WORKSHOP_BAYS,
  estimatedHours: 0.5,
  desiredDate: localDate("2026-07-01", 13, 36),
  dossierId: dossier.id,
  availabilityConfig,
}, localDate("2026-07-01", 7));

assert.ok(
  new Date(chainedSlot.startTime).getTime() >= localDate("2026-07-01", 13, 36).getTime(),
  "Une suggestion en chaîne ne doit jamais revenir avant l'heure demandée"
);

console.log("old-app-planning-parity.test.ts OK");
