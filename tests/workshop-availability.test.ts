/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { 
  getDefaultWorkshopSchedule, 
  getEffectiveWorkshopWindows, 
  isWorkshopClosed, 
  isTechnicianAbsent, 
  isBayUnavailable, 
  validateAvailabilityForSlot, 
  findNextAvailableWorkingSlot 
} from "../src/workshop-availability";
import { 
  validatePlanningAssignment 
} from "../src/sav-core";
import { 
  WorkshopAvailabilityConfig, 
  DossierSAV, 
  TechnicienResource, 
  WorkshopBay, 
  InterventionType, 
  DossierPriority, 
  DossierStatus 
} from "../src/types";

function mockConfig(overrides: Partial<WorkshopAvailabilityConfig> = {}): WorkshopAvailabilityConfig {
  return {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [],
    ...overrides
  };
}

const mockTech: TechnicienResource = {
  id: "tech_1",
  nom: "Technicien Test",
  specialite: "Mecanique",
  disponibilite: "disponible",
  compétences: [],
  zoneAffectee: "GRANDS_TRAVAUX" as any,
  capaciteJournaliere: 8,
  chargeActuelle: 0,
  absencesConges: []
};

const mockBay: WorkshopBay = {
  id: "bay_1",
  name: "Pont 1",
  zone: "GRANDS_TRAVAUX" as any
};

console.log("▶ Running tests/workshop-availability.test.ts...");

// 1. Horaires par défaut corrects
{
  const config = mockConfig();
  
  // Lundi (jour ouvrable)
  const monday = new Date("2026-06-15T09:00:00"); // Lundi
  const mondayWins = getEffectiveWorkshopWindows(monday, config);
  assert.equal(mondayWins.length, 2);
  assert.equal(mondayWins[0].start, "08:00");
  assert.equal(mondayWins[0].end, "12:00");
  assert.equal(mondayWins[1].start, "13:00");
  assert.equal(mondayWins[1].end, "17:00");
  assert.equal(isWorkshopClosed(monday, config), false);

  // Samedi
  const saturday = new Date("2026-06-20T09:00:00"); // Samedi
  const satWins = getEffectiveWorkshopWindows(saturday, config);
  assert.equal(satWins.length, 1);
  assert.equal(satWins[0].start, "08:00");
  assert.equal(satWins[0].end, "12:00");
  assert.equal(isWorkshopClosed(saturday, config), false);

  console.log("✔ Horaires par défaut corrects OK");
}

// 2. Dimanche fermé
{
  const config = mockConfig();
  const sunday = new Date("2026-06-14T09:00:00"); // Dimanche
  const sunWins = getEffectiveWorkshopWindows(sunday, config);
  assert.equal(sunWins.length, 0);
  assert.equal(isWorkshopClosed(sunday, config), true);
  console.log("✔ Dimanche fermé OK");
}

// 3. Samedi après-midi fermé par défaut
{
  const config = mockConfig();
  const satAfternoon = new Date("2026-06-20T14:00:00");
  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-20T13:00:00",
    endTime: "2026-06-20T15:00:00",
    config
  });
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("outside-effective-working-hours") || validation.codes.includes("workshop-closed"));
  console.log("✔ Samedi après-midi fermé OK");
}

// 4. Jour férié ferme l'atelier
{
  const config = mockConfig({
    holidays: [{ id: "h1", date: "2026-06-15", name: "Fête du Travail" }]
  });
  const mondayHoliday = new Date("2026-06-15T09:00:00");
  assert.equal(isWorkshopClosed(mondayHoliday, config), true);
  
  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-15T09:00:00",
    endTime: "2026-06-15T10:00:00",
    config
  });
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("workshop-holiday"));
  console.log("✔ Jour férié ferme l'atelier OK");
}

// 5. Exception journée fermée
{
  const config = mockConfig({
    exceptions: [{ id: "exc1", date: "2026-06-16", isClosed: true, reason: "Maintenance" }]
  });
  const excDay = new Date("2026-06-16T09:00:00");
  assert.equal(isWorkshopClosed(excDay, config), true);

  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-16T09:00:00",
    endTime: "2026-06-16T10:00:00",
    config
  });
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("workshop-closed"));
  console.log("✔ Exception journée fermée OK");
}

// 6. Exception horaire remplace horaire normal
{
  const config = mockConfig({
    exceptions: [{ 
      id: "exc2", 
      date: "2026-06-17", 
      isClosed: false, 
      windows: [{ start: "09:00", end: "15:00" }],
      reason: "Journée continue" 
    }]
  });
  const excDay = new Date("2026-06-17T08:30:00");
  const wins = getEffectiveWorkshopWindows(excDay, config);
  assert.equal(wins.length, 1);
  assert.equal(wins[0].start, "09:00");
  assert.equal(wins[0].end, "15:00");

  // En dehors des horaires exceptionnels
  const validation1 = validateAvailabilityForSlot({
    startTime: "2026-06-17T08:00:00",
    endTime: "2026-06-17T09:00:00",
    config
  });
  assert.equal(validation1.allowed, false);

  // Dans les horaires exceptionnels
  const validation2 = validateAvailabilityForSlot({
    startTime: "2026-06-17T09:30:00",
    endTime: "2026-06-17T11:30:00",
    config
  });
  assert.equal(validation2.allowed, true);
  console.log("✔ Exception horaire remplace horaire normal OK");
}

// 7. Technicien absent bloque son créneau
{
  const config = mockConfig({
    absences: [{
      id: "abs1",
      technicianId: "tech_1",
      startDate: "2026-06-18",
      endDate: "2026-06-18",
      reason: "Maladie"
    }]
  });

  const targetDate = new Date("2026-06-18T10:00:00");
  assert.equal(isTechnicianAbsent("tech_1", targetDate, config), true);

  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-18T09:00:00",
    endTime: "2026-06-18T11:00:00",
    technicianId: "tech_1",
    config
  });
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("technician-absent"));
  console.log("✔ Technicien absent bloque son créneau OK");
}

// 8. Technicien absent ne bloque pas un autre technicien
{
  const config = mockConfig({
    absences: [{
      id: "abs1",
      technicianId: "tech_1",
      startDate: "2026-06-18",
      endDate: "2026-06-18",
      reason: "Maladie"
    }]
  });

  const targetDate = new Date("2026-06-18T10:00:00");
  assert.equal(isTechnicianAbsent("tech_2", targetDate, config), false);

  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-18T09:00:00",
    endTime: "2026-06-18T11:00:00",
    technicianId: "tech_2",
    config
  });
  assert.equal(validation.allowed, true);
  console.log("✔ Technicien absent ne bloque pas un autre technicien OK");
}

// 9. Pont indisponible bloque son créneau
{
  const config = mockConfig({
    bayUnavailabilities: [{
      id: "unav1",
      bayId: "bay_1",
      startDate: "2026-06-18",
      endDate: "2026-06-18",
      reason: "Maintenance"
    }]
  });

  const targetDate = new Date("2026-06-18T10:00:00");
  assert.equal(isBayUnavailable("bay_1", targetDate, config), true);

  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-18T09:00:00",
    endTime: "2026-06-18T11:00:00",
    bayId: "bay_1",
    config
  });
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("bay-unavailable"));
  console.log("✔ Pont indisponible bloque son créneau OK");
}

// 10. Pont indisponible ne bloque pas un autre pont
{
  const config = mockConfig({
    bayUnavailabilities: [{
      id: "unav1",
      bayId: "bay_1",
      startDate: "2026-06-18",
      endDate: "2026-06-18",
      reason: "Maintenance"
    }]
  });

  const targetDate = new Date("2026-06-18T10:00:00");
  assert.equal(isBayUnavailable("bay_2", targetDate, config), false);

  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-18T09:00:00",
    endTime: "2026-06-18T11:00:00",
    bayId: "bay_2",
    config
  });
  assert.equal(validation.allowed, true);
  console.log("✔ Pont indisponible ne bloque pas un autre pont OK");
}

// 11. Suppression absence libère la ressource
{
  const initialConfig = mockConfig({
    absences: [{
      id: "abs1",
      technicianId: "tech_1",
      startDate: "2026-06-18",
      endDate: "2026-06-18",
      reason: "Maladie"
    }]
  });

  // Suppression
  const configAfterDelete = {
    ...initialConfig,
    absences: initialConfig.absences.filter(a => a.id !== "abs1")
  };

  const targetDate = new Date("2026-06-18T10:00:00");
  assert.equal(isTechnicianAbsent("tech_1", targetDate, configAfterDelete), false);

  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-18T09:00:00",
    endTime: "2026-06-18T11:00:00",
    technicianId: "tech_1",
    config: configAfterDelete
  });
  assert.equal(validation.allowed, true);
  console.log("✔ Suppression absence libère la ressource OK");
}

// 12. Suppression indisponibilité libère le pont
{
  const initialConfig = mockConfig({
    bayUnavailabilities: [{
      id: "unav1",
      bayId: "bay_1",
      startDate: "2026-06-18",
      endDate: "2026-06-18",
      reason: "Maintenance"
    }]
  });

  // Suppression
  const configAfterDelete = {
    ...initialConfig,
    bayUnavailabilities: initialConfig.bayUnavailabilities.filter(u => u.id !== "unav1")
  };

  const targetDate = new Date("2026-06-18T10:00:00");
  assert.equal(isBayUnavailable("bay_1", targetDate, configAfterDelete), false);

  const validation = validateAvailabilityForSlot({
    startTime: "2026-06-18T09:00:00",
    endTime: "2026-06-18T11:00:00",
    bayId: "bay_1",
    config: configAfterDelete
  });
  assert.equal(validation.allowed, true);
  console.log("✔ Suppression indisponibilité libère le pont OK");
}

// 13. Réservation longue saute un jour férié
{
  const config = mockConfig({
    holidays: [{ id: "h1", date: "2026-06-16", name: "Férié" }] // Mardi férié
  });

  // Lundi 15 Juin 8:00 pour 12h
  // Devrait prendre Lundi 8-12, 13-17 (8h), sauter Mardi (férié), et continuer Mercredi 17 Juin 8-12 (4h)
  const slot = findNextAvailableWorkingSlot({
    durationMinutes: 12 * 60,
    startDate: new Date("2026-06-15T08:00:00"),
    technicianId: "tech_1",
    bayId: "bay_1",
    dossiers: [],
    reservations: [],
    config
  });

  assert.ok(slot);
  assert.equal(slot.segments.length, 3);
  assert.equal(slot.segments[0].start.split("T")[0], "2026-06-15");
  assert.equal(slot.segments[1].start.split("T")[0], "2026-06-15");
  assert.equal(slot.segments[2].start.split("T")[0], "2026-06-17"); // Saute le 16 !
  console.log("✔ Réservation longue saute un jour férié OK");
}

// 14. Réservation longue saute un jour technicien absent
{
  const config = mockConfig({
    absences: [{
      id: "abs1",
      technicianId: "tech_1",
      startDate: "2026-06-16",
      endDate: "2026-06-16",
      reason: "Absent"
    }] // Mardi absent
  });

  const slot = findNextAvailableWorkingSlot({
    durationMinutes: 12 * 60,
    startDate: new Date("2026-06-15T08:00:00"),
    technicianId: "tech_1",
    bayId: "bay_1",
    dossiers: [],
    reservations: [],
    config
  });

  assert.ok(slot);
  assert.equal(slot.segments.length, 3);
  assert.equal(slot.segments[0].start.split("T")[0], "2026-06-15");
  assert.equal(slot.segments[1].start.split("T")[0], "2026-06-15");
  assert.equal(slot.segments[2].start.split("T")[0], "2026-06-17"); // Saute le 16 !
  console.log("✔ Réservation longue saute un jour technicien absent OK");
}

// 15. validatePlanningAssignment refuse technicien absent
{
  const config = mockConfig({
    absences: [{
      id: "abs1",
      technicianId: "tech_1",
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      reason: "Absent"
    }]
  });

  const dossier: DossierSAV = {
    id: "NIMR-2026-001",
    clientNom: "Test",
    clientTelephone: "123",
    deposantNom: "Test",
    deposantTelephone: "123",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory",
    vehiculeImmatriculation: "123 TU 456",
    vehiculeVIN: "VIN123",
    vehiculeKilometrage: 1000,
    vehiculeCouleur: "Rouge",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
    dateReception: "2026-06-15T08:00:00",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
    statut: DossierStatus.NOUVEAU,
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ],
    complements: [],
    accords: [],
    checklistQC: { essaiEffectue: false, defautRepare: false, aucunVoyantAllume: false, niveauxVerifies: false, serrageSecurite: false, propreteVehicule: false, documentsPrets: false, photosApresOk: false, validationGlobale: "en_attente" },
    livraison: { controleQualiteOk: false, clientInforme: false, dateLivraisonPrevue: "2026-06-15", confirmationReceptionClient: false, clotureInterne: false, remarquesLivraison: "" },
    prochaineActionRecommended: "",
    dateDernierStatut: "2026-06-15T08:00:00",
    avancementGlobal: 0
  };

  const validation = validatePlanningAssignment({
    dossiers: [dossier],
    dossierId: dossier.id,
    lineId: "t1",
    technicianId: "tech_1",
    bayId: "bay_1",
    start: "2026-06-15T09:00:00",
    end: "2026-06-15T11:00:00",
    technicians: [mockTech],
    workshopBays: [mockBay],
    reservations: [],
    availabilityConfig: config
  }, new Date("2026-06-13T08:00:00"));

  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("technician-absent"));
  console.log("✔ validatePlanningAssignment refuse technicien absent OK");
}

// 16. validatePlanningAssignment refuse pont indisponible
{
  const config = mockConfig({
    bayUnavailabilities: [{
      id: "unav1",
      bayId: "bay_1",
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      reason: "Maintenance"
    }]
  });

  const dossier: DossierSAV = {
    id: "NIMR-2026-001",
    clientNom: "Test",
    clientTelephone: "123",
    deposantNom: "Test",
    deposantTelephone: "123",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory",
    vehiculeImmatriculation: "123 TU 456",
    vehiculeVIN: "VIN123",
    vehiculeKilometrage: 1000,
    vehiculeCouleur: "Rouge",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
    dateReception: "2026-06-15T08:00:00",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
    statut: DossierStatus.NOUVEAU,
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ],
    complements: [],
    accords: [],
    checklistQC: { essaiEffectue: false, defautRepare: false, aucunVoyantAllume: false, niveauxVerifies: false, serrageSecurite: false, propreteVehicule: false, documentsPrets: false, photosApresOk: false, validationGlobale: "en_attente" },
    livraison: { controleQualiteOk: false, clientInforme: false, dateLivraisonPrevue: "2026-06-15", confirmationReceptionClient: false, clotureInterne: false, remarquesLivraison: "" },
    prochaineActionRecommended: "",
    dateDernierStatut: "2026-06-15T08:00:00",
    avancementGlobal: 0
  };

  const validation = validatePlanningAssignment({
    dossiers: [dossier],
    dossierId: dossier.id,
    lineId: "t1",
    technicianId: "tech_1",
    bayId: "bay_1",
    start: "2026-06-15T09:00:00",
    end: "2026-06-15T11:00:00",
    technicians: [mockTech],
    workshopBays: [mockBay],
    reservations: [],
    availabilityConfig: config
  }, new Date("2026-06-13T08:00:00"));

  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("bay-unavailable"));
  console.log("✔ validatePlanningAssignment refuse pont indisponible OK");
}

console.log("✔ All workshop-availability tests completed successfully!");
