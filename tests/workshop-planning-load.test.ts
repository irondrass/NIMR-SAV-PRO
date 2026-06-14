/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { 
  calculateTechnicianDailyLoad, 
  calculateBayDailyLoad 
} from "../src/sav-core";
import { 
  getDefaultWorkshopSchedule, 
  getEffectiveWorkshopWindows 
} from "../src/workshop-availability";
import { 
  canSimulateTechnicianAccess 
} from "../src/permissions";
import { 
  DossierSAV, 
  DossierStatus, 
  InterventionType, 
  DossierPriority, 
  AtelierZone, 
  WorkshopReservation, 
  UserRole 
} from "../src/types";

console.log("▶ Running tests/workshop-planning-load.test.ts...");

const mockDossier = (overrides: Partial<DossierSAV>): DossierSAV => ({
  id: "NIMR-TEST-L",
  clientNom: "Test client",
  clientTelephone: "",
  deposantNom: "Test client",
  deposantTelephone: "",
  vehiculeMarque: "DFSK",
  vehiculeModele: "Glory",
  vehiculeImmatriculation: "123 TU 456",
  vehiculeVIN: "VIN123",
  vehiculeKilometrage: 100,
  vehiculeCouleur: "rouge",
  typeDossier: InterventionType.ENTRETIEN_RAPIDE,
  priorite: DossierPriority.NORMALE,
  plainteClient: "",
  observationsReception: "",
  photosAvant: [],
  niveauCarburant: 50,
  etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, Flat: false } as any,
  objetsLaisses: [],
  dateReception: "2026-06-15T08:00:00Z",
  dateSouhaiteeLivraison: "2026-06-15T17:00:00Z",
  statut: DossierStatus.EN_TRAVAUX,
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
    validationGlobale: "en_attente"
  },
  livraison: {
    controleQualiteOk: false,
    clientInforme: false,
    dateLivraisonPrevue: "2026-06-15T17:00:00Z",
    remarquesLivraison: "",
    confirmationReceptionClient: false,
    clotureInterne: false
  },
  prochaineActionRecommended: "",
  dateDernierStatut: "2026-06-15T08:00:00Z",
  avancementGlobal: 0,
  ...overrides
});

// Test 1: Technician load (active tasks, segments, reservations)
{
  const dateStr = "2026-06-15";
  
  // Case A: 1 Gantt segment of 2h
  const dossier1 = mockDossier({
    ordresReparation: [
      {
        id: "ro_1",
        designation: "Tâche 1",
        tempsEstime: 2.0,
        tempsPasse: 0,
        status: "pending",
        plannedTechnicianId: "tech_01",
        planningDate: dateStr,
        planningStart: "2026-06-15T09:00:00.000Z",
        planningEnd: "2026-06-15T11:00:00.000Z"
      }
    ]
  });

  // Case B: Active task (in_progress) without segment (adds tempsEstime 3h)
  const dossier2 = mockDossier({
    ordresReparation: [
      {
        id: "ro_2",
        designation: "Tâche 2",
        tempsEstime: 3.0,
        tempsPasse: 0.5,
        status: "in_progress",
        plannedTechnicianId: "tech_01",
        planningDate: dateStr
      }
    ]
  });

  // Case C: Confirmed reservation of 1.5h
  const reservations: WorkshopReservation[] = [
    {
      reservationId: "res_1",
      dossierId: "NIMR-TEST-L",
      totalHours: 1.5,
      desiredDate: dateStr,
      technicianId: "tech_01",
      status: "RESERVATION_CONFIRMEE",
      taskIds: [],
      source: "manual",
      history: []
    },
    // Proposed reservation: should be ignored
    {
      reservationId: "res_2",
      dossierId: "NIMR-TEST-L",
      totalHours: 4.0,
      desiredDate: dateStr,
      technicianId: "tech_01",
      status: "CRENEAU_PROPOSE",
      taskIds: [],
      source: "manual",
      history: []
    }
  ];

  const load = calculateTechnicianDailyLoad("tech_01", dateStr, [dossier1, dossier2], reservations);
  // Expected: 2.0 (Gantt segment) + 3.0 (in_progress task) + 1.5 (confirmed reservation) = 6.5 hours
  assert.equal(load, 6.5);
  console.log("✔ Technicien charge calculée avec succès (incluant segments, in_progress, réservations confirmées)");
}

// Test 2: double counting exclusions
{
  const dateStr = "2026-06-15";

  // Case: Task in_progress has a Gantt segment the same day
  // It must only count the Gantt segment, NOT the task estimate again
  const dossier1 = mockDossier({
    ordresReparation: [
      {
        id: "ro_1",
        designation: "Tâche 1",
        tempsEstime: 3.0,
        tempsPasse: 1.0,
        status: "in_progress",
        plannedTechnicianId: "tech_01",
        planningDate: dateStr,
        planningStart: "2026-06-15T09:00:00.000Z",
        planningEnd: "2026-06-15T11:00:00.000Z" // 2 hours
      }
    ]
  });

  // Case: Reservation of status TRANSFORMEE_PLANNING
  // It must be excluded because the Gantt segments already exist
  const reservations: WorkshopReservation[] = [
    {
      reservationId: "res_1",
      dossierId: "NIMR-TEST-L",
      totalHours: 3.0,
      desiredDate: dateStr,
      technicianId: "tech_01",
      status: "TRANSFORMEE_PLANNING",
      taskIds: [],
      source: "manual",
      history: []
    }
  ];

  const load = calculateTechnicianDailyLoad("tech_01", dateStr, [dossier1], reservations);
  // Expected: 2.0 hours (Gantt segment only, no task estimate, no transformed reservation)
  assert.equal(load, 2.0);
  console.log("✔ Exclusions du double comptage OK (in_progress avec segment et réservations transformées)");
}

// Test 3: Bay load (segments, reservations, active tasks)
{
  const dateStr = "2026-06-15";

  const dossier1 = mockDossier({
    ordresReparation: [
      {
        id: "ro_1",
        designation: "Tâche 1",
        tempsEstime: 1.5,
        tempsPasse: 0,
        status: "pending",
        plannedBayId: "bay_01",
        planningDate: dateStr,
        planningStart: "2026-06-15T08:00:00.000Z",
        planningEnd: "2026-06-15T09:30:00.000Z"
      }
    ]
  });

  const dossier2 = mockDossier({
    ordresReparation: [
      {
        id: "ro_2",
        designation: "Tâche 2",
        tempsEstime: 2.5,
        tempsPasse: 0.5,
        status: "in_progress",
        plannedBayId: "bay_01",
        planningDate: dateStr
      }
    ]
  });

  const reservations: WorkshopReservation[] = [
    {
      reservationId: "res_1",
      dossierId: "NIMR-TEST-L",
      totalHours: 2.0,
      desiredDate: dateStr,
      bayId: "bay_01",
      status: "RESERVATION_CONFIRMEE",
      taskIds: [],
      source: "manual",
      history: []
    }
  ];

  const load = calculateBayDailyLoad("bay_01", dateStr, [dossier1, dossier2], reservations);
  // Expected: 1.5 (Gantt segment) + 2.5 (in_progress task) + 2.0 (confirmed reservation) = 6.0 hours
  assert.equal(load, 6.0);
  console.log("✔ Pont charge calculée avec succès (incluant segments, in_progress, réservations confirmées)");
}

// Test 4: Default schedule validation (Mon-Fri 08-12/13-17, Sat 08-12)
{
  const config = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: []
  };

  // Monday
  const mondayWins = getEffectiveWorkshopWindows(new Date("2026-06-15"), config);
  assert.equal(mondayWins.length, 2);
  assert.equal(mondayWins[0].start, "08:00");
  assert.equal(mondayWins[0].end, "12:00");
  assert.equal(mondayWins[1].start, "13:00");
  assert.equal(mondayWins[1].end, "17:00");

  // Saturday
  const saturdayWins = getEffectiveWorkshopWindows(new Date("2026-06-20"), config);
  assert.equal(saturdayWins.length, 1);
  assert.equal(saturdayWins[0].start, "08:00");
  assert.equal(saturdayWins[0].end, "12:00");

  // Sunday
  const sundayWins = getEffectiveWorkshopWindows(new Date("2026-06-21"), config);
  assert.equal(sundayWins.length, 0);

  console.log("✔ Horaires par défaut valides (08:00-12:00/13:00-17:00 semaine, 08:00-12:00 samedi)");
}

// Test 5: Companion simulation permissions
{
  assert.equal(canSimulateTechnicianAccess(UserRole.DIRECTEUR_SAV), true);
  assert.equal(canSimulateTechnicianAccess(UserRole.CHEF_ATELIER), true);
  assert.equal(canSimulateTechnicianAccess(UserRole.TECHNICIEN), false);
  assert.equal(canSimulateTechnicianAccess(UserRole.RECEPTIONNAIRE), false);

  console.log("✔ Permissions de simulation compagnon validées");
}

console.log("All workshop-planning-load tests completed successfully!");
