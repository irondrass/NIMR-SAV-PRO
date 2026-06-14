/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { buildDirectorDashboardKpis, extractDossierTiming } from "../src/dashboard-kpis";
import { DossierSAV, UserRole, DossierStatus, InterventionType, AtelierZone, DossierPriority, WorkshopReservation, TechnicienResource } from "../src/types";

console.log("Démarrage des tests dashboard-kpis...");

// Mock data helpers
const mockTechs: TechnicienResource[] = [
  {
    id: "tech_01",
    nom: "Tech 1",
    specialite: "Mecanique",
    disponibilite: "disponible",
    capaciteJournaliere: 8,
    compétences: [],
    zoneAffectee: AtelierZone.MECANIQUE_RAPIDE,
    absencesConges: [],
    chargeActuelle: 0
  }
];

const fixedNow = new Date("2026-06-11T10:00:00.000Z");

// Test 1: BUG-001 & BUG-002: Dashboard KPIs with zero capacity and occupancy calculation
{
  const emptyDossiers: DossierSAV[] = [];
  
  // Case A: Zero capacity (no technicians)
  const zeroCapKpis = buildDirectorDashboardKpis({
    dossiers: emptyDossiers,
    techniciens: [],
    reservations: [],
    filters: { period: "all", now: fixedNow }
  });
  
  assert.strictEqual(zeroCapKpis.workshop.occupancyRate, null);
  assert.strictEqual(zeroCapKpis.workshop.occupancyLabel, "Non mesurable");
  assert.strictEqual(zeroCapKpis.workshop.plannedLoadRate, null);
  assert.strictEqual(zeroCapKpis.workshop.plannedLoadLabel, "Non mesurable");
  assert.strictEqual(zeroCapKpis.workshop.reservedLoadRate, null);
  assert.strictEqual(zeroCapKpis.workshop.reservedLoadLabel, "Non mesurable");
  assert.strictEqual(zeroCapKpis.workshop.detailsCalcul.totalCapacity, 0);
  assert.strictEqual(zeroCapKpis.workshop.detailsCalcul.plannedHours, 0);
  assert.strictEqual(zeroCapKpis.workshop.detailsCalcul.reservedHours, 0);
  assert.strictEqual(zeroCapKpis.workshop.detailsCalcul.inProgressHours, 0);
  assert.strictEqual(zeroCapKpis.workshop.detailsCalcul.usedCapacityHours, 0);

  // Case B: Normal capacity, zero load
  const normalCapKpis = buildDirectorDashboardKpis({
    dossiers: emptyDossiers,
    techniciens: mockTechs,
    reservations: [],
    filters: { period: "all", now: fixedNow }
  });
  
  assert.strictEqual(normalCapKpis.workshop.occupancyRate, 0);
  assert.strictEqual(normalCapKpis.workshop.occupancyLabel, "0%");
  assert.strictEqual(normalCapKpis.workshop.plannedLoadRate, 0);
  assert.strictEqual(normalCapKpis.workshop.plannedLoadLabel, "0%");
  assert.strictEqual(normalCapKpis.workshop.reservedLoadRate, 0);
  assert.strictEqual(normalCapKpis.workshop.reservedLoadLabel, "0%");
  assert.ok(normalCapKpis.workshop.detailsCalcul.totalCapacity > 0);
  assert.strictEqual(normalCapKpis.workshop.detailsCalcul.plannedHours, 0);
  assert.strictEqual(normalCapKpis.workshop.detailsCalcul.reservedHours, 0);
  assert.strictEqual(normalCapKpis.workshop.detailsCalcul.inProgressHours, 0);
  assert.strictEqual(normalCapKpis.workshop.detailsCalcul.usedCapacityHours, 0);
}

// Test 2: BUG-002 occupancy rate threshold and components
{
  // Create a dossier with planned hours (segments)
  const dossier: DossierSAV = {
    id: "NIMR-TEST-001",
    clientNom: "Test",
    clientTelephone: "",
    deposantNom: "Test",
    deposantTelephone: "",
    vehiculeMarque: "Forthing",
    vehiculeModele: "T5 EVO",
    vehiculeImmatriculation: "111 TU 111",
    vehiculeVIN: "VIN111",
    vehiculeKilometrage: 1000,
    vehiculeCouleur: "",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, Flat: false } as any,
    objetsLaisses: [],
    dateReception: "2026-06-11T08:00:00Z",
    dateSouhaiteeLivraison: "2026-06-11T17:00:00Z",
    statut: DossierStatus.EN_TRAVAUX,
    technicienId: "tech_01",
    zoneAtelier: AtelierZone.MECANIQUE_RAPIDE,
    ordresReparation: [
      {
        id: "ro_1",
        designation: "Tâche 1",
        tempsEstime: 2.0,
        tempsPasse: 0.5,
        status: "in_progress",
        // Segment Gantt with 1 hour
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_01",
        planningDate: "2026-06-11",
        planningStart: "2026-06-11T09:00:00.000Z",
        planningEnd: "2026-06-11T10:00:00.000Z",
      }
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
      validationGlobale: "en_attente"
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-11T17:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false
    },
    prochaineActionRecommended: "",
    dateDernierStatut: "2026-06-11T08:00:00Z",
    avancementGlobal: 0
  };

  const reservations: WorkshopReservation[] = [
    {
      reservationId: "res_1",
      dossierId: "NIMR-TEST-001",
      totalHours: 1.5,
      desiredDate: "2026-06-11",
      technicianId: "tech_01",
      status: "RESERVATION_CONFIRMEE",
      taskIds: [],
      source: "manual",
      history: [],
    }
  ];

  const kpis = buildDirectorDashboardKpis({
    dossiers: [dossier],
    techniciens: mockTechs,
    reservations,
    filters: { period: "today", now: fixedNow }
  });

  // Effective capacity is 8 hours for tech_01
  // Charge components:
  // - Planned load (Gantt segments): 1.0 hour
  // - Reserved load (Reservations): 1.5 hours
  // - In progress with no Gantt segment: none
  // Total occupancy = (1.0 + 1.5) / 8 = 2.5 / 8 = 31.25% -> rounded to 31%
  assert.ok(kpis.workshop.occupancyRate! >= 30 && kpis.workshop.occupancyRate! <= 32);
  assert.strictEqual(kpis.workshop.plannedLoadRate, 13); // 1.0 / 8 = 12.5% -> 13%
  assert.strictEqual(kpis.workshop.reservedLoadRate, 19); // 1.5 / 8 = 18.75% -> 19%
  assert.strictEqual(kpis.workshop.detailsCalcul.plannedHours, 1.0);
  assert.strictEqual(kpis.workshop.detailsCalcul.reservedHours, 1.5);
  assert.strictEqual(kpis.workshop.detailsCalcul.inProgressHours, 0);
  assert.strictEqual(kpis.workshop.detailsCalcul.usedCapacityHours, 2.5);

  // Verify that if capacity is tiny and charge > 0, occupancy is not 0%
  const tinyCapacityKpis = buildDirectorDashboardKpis({
    dossiers: [dossier],
    techniciens: mockTechs,
    reservations: [],
    filters: { period: "all", now: fixedNow }
  });
  assert.ok(tinyCapacityKpis.workshop.occupancyRate! > 0);
  assert.ok(tinyCapacityKpis.workshop.occupancyLabel !== "0%");
}

// Test 3: BUG-003 delay extraction from logs
{
  const dossierWithLogs: DossierSAV = {
    id: "NIMR-LOGS-001",
    clientNom: "Test Logs",
    clientTelephone: "",
    deposantNom: "Test Logs",
    deposantTelephone: "",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 500",
    vehiculeImmatriculation: "111 TU 111",
    vehiculeVIN: "VIN111",
    vehiculeKilometrage: 1000,
    vehiculeCouleur: "",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, Flat: false } as any,
    objetsLaisses: [],
    dateReception: "2026-06-09T08:00:00.000Z",
    dateSouhaiteeLivraison: "2026-06-11T17:00:00Z",
    statut: DossierStatus.LIVRE,
    technicienId: "tech_01",
    zoneAtelier: AtelierZone.MECANIQUE_RAPIDE,
    ordresReparation: [],
    complements: [],
    accords: [],
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
      dateValidation: "2026-06-10T10:00:00.000Z"
    },
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-06-11T17:00:00Z",
      dateLivraisonReelle: "2026-06-11T09:00:00.000Z",
      remarquesLivraison: "",
      confirmationReceptionClient: true,
      clotureInterne: true
    },
    prochaineActionRecommended: "",
    dateDernierStatut: "2026-06-11T09:00:00.000Z",
    avancementGlobal: 100,
    historiqueLogs: [
      "2026-06-11T09:00:00.000Z - [LIVRAISON] - Restitution effectuée.",
      "2026-06-10T10:00:00.000Z - [CONTROLE_QUALITE] - Validation QC acceptée.",
      "2026-06-09T14:30:00.000Z - Tâche Vidange terminée",
      "2026-06-09T10:00:00.000Z - Tâche Vidange démarrée",
      "2026-06-09T08:00:00.000Z - [RECEPTIONNAIRE] - Dossier créé"
    ]
  };

  const timing = extractDossierTiming(dossierWithLogs);
  
  assert.ok(timing.reception !== null);
  assert.ok(timing.workStart !== null);
  assert.ok(timing.workEnd !== null);
  assert.ok(timing.qc !== null);
  assert.ok(timing.delivery !== null);

  assert.strictEqual(timing.reception!.toISOString(), "2026-06-09T08:00:00.000Z");
  assert.strictEqual(timing.workStart!.toISOString(), "2026-06-09T10:00:00.000Z");
  assert.strictEqual(timing.workEnd!.toISOString(), "2026-06-09T14:30:00.000Z");
  assert.strictEqual(timing.qc!.toISOString(), "2026-06-10T10:00:00.000Z");
  assert.strictEqual(timing.delivery!.toISOString(), "2026-06-11T09:00:00.000Z");
}

console.log("Tous les tests de dashboard-kpis ont réussi !");
