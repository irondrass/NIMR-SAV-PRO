import assert from "node:assert/strict";
import { filterReservationsForGanttDate } from "../src/performance-lot7";
import { isTechnicianCompatibleForStep } from "../src/sav-core";
import { AtelierZone, TechnicienResource, WorkshopReservation } from "../src/types";

console.log("Démarrage du test: planning-gantt-performance...");

const selectedDate = "2026-07-03";
const reservations: WorkshopReservation[] = Array.from({ length: 2000 }, (_, index) => {
  const day = index % 2 === 0 ? selectedDate : "2026-07-04";
  return {
    reservationId: `res-${index}`,
    dossierId: `NIMR-GANTT-${index}`,
    taskIds: [`task-${index}`],
    totalHours: 1,
    desiredDate: day,
    startTime: `${day}T08:00:00.000Z`,
    endTime: `${day}T09:00:00.000Z`,
    segments: [{ start: `${day}T08:00:00.000Z`, end: `${day}T09:00:00.000Z` }],
    technicianId: "tech-meca",
    bayId: "bay-fast",
    status: index % 4 === 0 ? "CRENEAU_PROPOSE" : "RESERVATION_CONFIRMEE",
    source: "lot7-performance-test",
    history: [],
  };
});

const visibleReservations = filterReservationsForGanttDate(reservations, selectedDate);
assert.equal(visibleReservations.length, 1000);
assert.ok(visibleReservations.every(res => res.segments?.some(segment => segment.start.startsWith(selectedDate))));

const mechanic: TechnicienResource = {
  id: "tech-meca",
  nom: "Mécanicien",
  specialite: "Mécanicien",
  disponibilite: "disponible",
  compétences: ["Mécanique"],
  zoneAffectee: AtelierZone.MECANIQUE_RAPIDE,
  absencesConges: [],
  capaciteJournaliere: 8,
  chargeActuelle: 0,
};
const painter: TechnicienResource = {
  ...mechanic,
  id: "tech-paint",
  nom: "Peintre",
  specialite: "Peintre",
  compétences: ["Peinture"],
  zoneAffectee: AtelierZone.PEINTURE,
};
const electrician: TechnicienResource = {
  ...mechanic,
  id: "tech-elec",
  nom: "Électricien",
  specialite: "Électricien",
  compétences: ["Électricité"],
  zoneAffectee: AtelierZone.ELECTRICITE_DIAG,
};

assert.equal(isTechnicianCompatibleForStep(mechanic, "paint", "peinture"), false);
assert.equal(isTechnicianCompatibleForStep(mechanic, "body", "tolerie"), false);
assert.equal(isTechnicianCompatibleForStep(mechanic, "mechanical", "geometrie"), true);
assert.equal(isTechnicianCompatibleForStep(electrician, "electrical", "electricite"), true);
assert.equal(isTechnicianCompatibleForStep(painter, "paint", "peinture"), true);

console.log("planning-gantt-performance.test.ts OK");
