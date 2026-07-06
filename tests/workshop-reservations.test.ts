/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { DossierSAV, DossierStatus, DossierPriority, InterventionType, TechnicienResource, WorkshopBay } from "../src/types";
import {
  calculateReservationDuration,
  createReservationNeed,
  suggestReservationSlot,
  validateReservationSlot,
  confirmReservation,
  cancelReservation,
  convertReservationToPlanning
} from "../src/workshop-reservations";

// Helper to create mock dossiers with local timezone strings
function mockDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return {
    id: "NIMR-2026-TEST",
    clientNom: "Bob",
    clientTelephone: "123",
    deposantNom: "Bob",
    deposantTelephone: "123",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory",
    vehiculeImmatriculation: "123 TU 456",
    vehiculeVIN: "VIN456",
    vehiculeKilometrage: 5000,
    vehiculeCouleur: "Noir",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Test",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: {
      rayures: false,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: ""
    },
    objetsLaisses: [],
    dateReception: "2026-06-15T08:00:00",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
    statut: DossierStatus.NOUVEAU,
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
      dateLivraisonPrevue: "2026-06-15",
      confirmationReceptionClient: false,
      clotureInterne: false,
      remarquesLivraison: ""
    },
    prochaineActionRecommended: "",
    dateDernierStatut: "2026-06-15T08:00:00",
    avancementGlobal: 0,
    ...overrides
  };
}

const mockTech: TechnicienResource = {
  id: "tech_test",
  nom: "Ali",
  specialite: "Electricité",
  disponibilite: "disponible",
  compétences: ["diagnostics"],
  zoneAffectee: "MECANIQUE_RAPIDE" as any,
  capaciteJournaliere: 8,
  chargeActuelle: 0,
  absencesConges: []
};

const mockBay: WorkshopBay = {
  id: "bay_test",
  name: "Pont Test",
  zone: "MECANIQUE_RAPIDE" as any
};

console.log("▶ Running tests/workshop-reservations.test.ts...");

// 1. réservation impossible sans durée MO validée
{
  const dossier = mockDossier({
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "preset", isEstimatedDurationValidated: false }
    ]
  });
  const duration = calculateReservationDuration(dossier);
  assert.equal(duration, 0);
  const need = createReservationNeed(dossier);
  assert.equal(need, null);
  console.log("✔ Réservation impossible sans durée MO validée OK");
}

// 2. tâche done exclue de la durée réservation
{
  const dossier = mockDossier({
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 2, status: "done", estimateSource: "manual", isEstimatedDurationValidated: true },
      { id: "t2", designation: "Task 2", tempsEstime: 1.5, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const duration = calculateReservationDuration(dossier);
  assert.equal(duration, 1.5);
  console.log("✔ Tâche done exclue de la durée réservation OK");
}

// 3. dossier prêt facturation ERP exclu
{
  const dossier = mockDossier({
    statut: DossierStatus.PRET_FACTURATION,
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const duration = calculateReservationDuration(dossier);
  assert.equal(duration, 0);
  console.log("✔ Dossier prêt facturation ERP exclu OK");
}

// 4. suggestion refuse dimanche
{
  const dossier = mockDossier({
    dateSouhaiteeLivraison: "2026-06-14T10:00:00", // 14 June 2026 is Sunday
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  
  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-14T08:00:00"));

  const startDay = new Date(res.startTime!).getDay();
  assert.notEqual(startDay, 0); // Not Sunday
  console.log("✔ Suggestion refuse dimanche OK");
}

// 5. suggestion refuse passé
{
  const dossier = mockDossier({
    dateSouhaiteeLivraison: "2026-06-10T10:00:00",
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);

  assert.throws(() => {
    suggestReservationSlot({
      reservation: need,
      dossiers: [],
      reservations: [],
      technicians: [mockTech],
      workshopBays: [mockBay]
    }, new Date("2026-06-13T08:00:00")); // past desiredDate
  }, /passé/);
  console.log("✔ Suggestion refuse passé OK");
}

// 6. suggestion respecte pause midi
{
  const dossier = mockDossier({
    dateSouhaiteeLivraison: "2026-06-15T11:00:00", // Monday
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 3.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);

  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T08:00:00"));

  const val = validateReservationSlot({
    reservation: res,
    dossiers: [],
    reservations: [],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T08:00:00"));
  assert.ok(val.allowed);
  console.log("✔ Suggestion respecte pause midi OK");
}

// 7. suggestion évite collision planning
{
  const dossierPlanifie = mockDossier({
    id: "NIMR-2026-PLANNED",
    ordresReparation: [
      {
        id: "t_planned",
        designation: "Planned Task",
        tempsEstime: 2.0,
        tempsPasse: 0,
        status: "pending",
        planningStart: "2026-06-15T08:00:00",
        planningEnd: "2026-06-15T10:00:00",
        planningSegments: [{ start: "2026-06-15T08:00:00", end: "2026-06-15T10:00:00" }],
        plannedTechnicianId: "tech_test",
        plannedBayId: "bay_test",
        planningDate: "2026-06-15"
      }
    ]
  });

  const dossierA = mockDossier({
    id: "NIMR-2026-A",
    dateSouhaiteeLivraison: "2026-06-15T08:00:00",
    ordresReparation: [
      { id: "t_a", designation: "Task A", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });

  const need = createReservationNeed(dossierA);
  assert.ok(need);

  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [dossierPlanifie],
    reservations: [],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T08:00:00"));

  // Should schedule after 10:00 because of collision
  const startTime = new Date(res.startTime!);
  assert.ok(startTime.getHours() >= 10);
  console.log("✔ Suggestion évite collision planning OK");
}

// 8. suggestion évite collision réservation confirmée
{
  const existingResConfirm: any = {
    reservationId: "res_existing",
    dossierId: "NIMR-2026-EXISTING",
    taskIds: ["t_existing"],
    totalHours: 2.0,
    desiredDate: "2026-06-15T08:00:00",
    startTime: "2026-06-15T08:00:00",
    endTime: "2026-06-15T10:00:00",
    segments: [{ start: "2026-06-15T08:00:00", end: "2026-06-15T10:00:00" }],
    technicianId: "tech_test",
    bayId: "bay_test",
    status: "RESERVATION_CONFIRMEE",
    source: "manual",
    history: []
  };

  const dossierA = mockDossier({
    id: "NIMR-2026-A",
    dateSouhaiteeLivraison: "2026-06-15T08:00:00",
    ordresReparation: [
      { id: "t_a", designation: "Task A", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });

  const need = createReservationNeed(dossierA);
  assert.ok(need);

  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [existingResConfirm],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T08:00:00"));

  // Should schedule after 10:00 because reservation confirms blocks
  const startTime = new Date(res.startTime!);
  assert.ok(startTime.getHours() >= 10);
  console.log("✔ Suggestion évite collision réservation confirmée OK");
}

// 9. annulation libère le créneau
{
  const resConfirm: any = {
    reservationId: "res_existing",
    dossierId: "NIMR-2026-EXISTING",
    taskIds: ["t_existing"],
    totalHours: 2.0,
    desiredDate: "2026-06-15T08:00:00",
    startTime: "2026-06-15T08:00:00",
    endTime: "2026-06-15T10:00:00",
    segments: [{ start: "2026-06-15T08:00:00", end: "2026-06-15T10:00:00" }],
    technicianId: "tech_test",
    bayId: "bay_test",
    status: "RESERVATION_CONFIRMEE",
    source: "manual",
    history: []
  };

  const cancelledRes = cancelReservation(resConfirm);
  assert.equal(cancelledRes.status, "ANNULEE");

  const dossierA = mockDossier({
    id: "NIMR-2026-A",
    dateSouhaiteeLivraison: "2026-06-15T08:00:00",
    ordresReparation: [
      { id: "t_a", designation: "Task A", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });

  const need = createReservationNeed(dossierA);
  assert.ok(need);

  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [cancelledRes],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T08:00:00"));

  // Since cancelled reservation doesn't block anymore, should schedule at 8:00
  const startTime = new Date(res.startTime!);
  assert.equal(startTime.getHours(), 8);
  console.log("✔ Annulation libère le créneau OK");
}

// 10. conversion crée de vrais segments Gantt & 11. conversion ne crée aucune tâche durée 0
{
  const dossier = mockDossier({
    id: "NIMR-2026-CONV",
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true },
      { id: "t2", designation: "Task 2", tempsEstime: 0.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true },
      { id: "t3", designation: "Task 3", tempsEstime: 1.5, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });

  const need = createReservationNeed(dossier);
  assert.ok(need);
  assert.equal(need.totalHours, 3.5);

  const resProposed = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T08:00:00"));

  const resConfirmed = confirmReservation(resProposed);

  const result = convertReservationToPlanning(resConfirmed, [dossier]);
  assert.equal(result.reservation.status, "TRANSFORMEE_PLANNING");
  
  const updatedDossier = result.dossiers[0];
  assert.equal(updatedDossier.statut, DossierStatus.TRAVAUX_PLANIFIES);
  
  // Verify task 1 planning
  const t1 = updatedDossier.ordresReparation.find(l => l.id === "t1")!;
  assert.ok(t1.planningStart);
  assert.ok(t1.planningEnd);
  assert.equal(t1.plannedTechnicianId, "tech_test");
  assert.equal(t1.plannedBayId, "bay_test");

  // Verify task 2 (duration 0) has NO planning segments
  const t2 = updatedDossier.ordresReparation.find(l => l.id === "t2")!;
  assert.equal(t2.planningStart, undefined);
  assert.equal(t2.planningEnd, undefined);

  // Verify task 3 planning
  const t3 = updatedDossier.ordresReparation.find(l => l.id === "t3")!;
  assert.ok(t3.planningStart);
  assert.ok(t3.planningEnd);
  assert.equal(t3.plannedTechnicianId, "tech_test");
  assert.equal(t3.plannedBayId, "bay_test");

  // Sequential planning check: t3 should start exactly where t1 ended (since t2 was ignored)
  assert.equal(t3.planningStart, t1.planningEnd);

  console.log("✔ Conversion crée de vrais segments Gantt OK");
  console.log("✔ Conversion ne crée aucune tâche durée 0 OK");
}

// 12. Réservation multi-jours de 52 heures
{
  const dossier52 = mockDossier({
    id: "NIMR-2026-52H",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00", // Start suggesting from Monday 15 June 2026
    ordresReparation: [
      { id: "task_52", designation: "Task 52 Hours", tempsEstime: 52.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });

  const need52 = createReservationNeed(dossier52);
  assert.ok(need52);
  assert.equal(need52.totalHours, 52.0);

  const resProposed = suggestReservationSlot({
    reservation: need52,
    dossiers: [],
    reservations: [],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T08:00:00"));

  assert.ok(resProposed.startTime);
  assert.ok(resProposed.endTime);
  assert.ok(resProposed.segments);
  
  // Total duration of all segments should sum to exactly 52.0 hours
  const totalDuration = resProposed.segments.reduce((sum, seg) => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    return sum + (e.getTime() - s.getTime()) / (3600000);
  }, 0);
  assert.equal(totalDuration, 52.0);

  // Validate should pass with no errors/warnings (allowed: true)
  const valResult = validateReservationSlot({
    reservation: resProposed,
    dossiers: [],
    reservations: [],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T08:00:00"));
  assert.ok(valResult.allowed, `Validation failed: ${valResult.reasons.join(", ")}`);

  // Ensure no segment overlaps lunch break (12h-13h) on weekdays
  resProposed.segments.forEach(seg => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    if (s.getDay() !== 6) { // Not Saturday
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      assert.ok(sMin >= 13 * 60 || eMin <= 12 * 60, `Segment overlaps lunch break: ${seg.start} to ${seg.end}`);
    }
  });

  console.log("✔ Réservation de 52h (multi-jours) OK");
}

// 13. une réservation confirmée synchronisée sur la tâche reste convertible
{
  const dossier = mockDossier({
    id: "NIMR-2026-CONVERTIBLE",
    ordresReparation: [
      { id: "t_convert", designation: "Task convertible", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });

  const need = createReservationNeed(dossier, new Date("2026-06-15T07:00:00"));
  assert.ok(need);

  const proposed = suggestReservationSlot({
    reservation: need,
    dossiers: [dossier],
    reservations: [],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T07:00:00"));
  const confirmed = confirmReservation(proposed, new Date("2026-06-15T07:10:00"));
  const syncedDossier = {
    ...dossier,
    ordresReparation: dossier.ordresReparation.map(line => line.id === "t_convert" ? {
      ...line,
      planningStart: confirmed.startTime,
      planningEnd: confirmed.endTime,
      planningSegments: confirmed.segments,
      plannedTechnicianId: confirmed.technicianId,
      plannedBayId: confirmed.bayId,
    } : line),
  };

  const validation = validateReservationSlot({
    reservation: confirmed,
    dossiers: [syncedDossier],
    reservations: [confirmed],
    technicians: [mockTech],
    workshopBays: [mockBay]
  }, new Date("2026-06-15T07:15:00"));

  assert.ok(validation.allowed, `Validation failed: ${validation.codes.join(", ")}`);
  console.log("✔ Réservation confirmée synchronisée reste convertible OK");
}

console.log("✔ All workshop-reservations tests completed successfully!");
