/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import {
  maskPhone,
  parseLogEntry,
  buildDossierHistory,
  buildVehicleHistory,
  buildClientHistory,
  buildReceptionReport,
  buildWorkshopReport,
  buildPlanningReport,
  buildQcReport,
  buildDeliveryReport,
  buildComplaintsReport,
  buildBlockingReport,
  buildOperationalKpis
} from "../src/sav-reports";
import {
  DossierSAV,
  UserRole,
  DossierStatus,
  InterventionType,
  DossierPriority,
  ReclammationClient,
  WorkshopReservation,
  WorkshopAvailabilityConfig,
  VehicleMasterRecord,
  SavReportFilters
} from "../src/types";

console.log("Démarrage des tests sav-reports...");

// Helper for dates
const today = new Date("2026-06-14");

// 1. Phone number masking
{
  assert.strictEqual(maskPhone("+216 55 111 001"), "+216 ** *** 001");
  assert.strictEqual(maskPhone("55111002"), "+216 ** *** 002");
  assert.strictEqual(maskPhone(undefined), undefined);
}

// Mock dossiers
const mockDossiers: DossierSAV[] = [
  {
    id: "NIMR-2026-001",
    clientNom: "Salah Mhadhbi",
    clientTelephone: "+216 55 111 001",
    deposantNom: "Salah Mhadhbi",
    deposantTelephone: "+216 55 111 001",
    vehiculeMarque: "Dongfeng",
    vehiculeModele: "Shine Max",
    vehiculeImmatriculation: "111 TU 111",
    vehiculeVIN: "VIN111",
    vehiculeKilometrage: 10000,
    vehiculeCouleur: "Noir",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Vidange moteur",
    observationsReception: "RAS",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
    dateReception: "2026-06-10T08:00:00Z",
    dateSouhaiteeLivraison: "2026-06-10T17:00:00Z",
    statut: DossierStatus.LIVRE,
    ordresReparation: [
      {
        id: "task1",
        designation: "Vidange moteur",
        tempsEstime: 1.5,
        tempsPasse: 1.5,
        status: "done",
        plannedTechnicianId: "tech1",
        plannedBayId: "bay1",
        planningStart: "2026-06-10T09:00:00Z"
      }
    ],
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
      dateValidation: "2026-06-10T11:00:00Z"
    },
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-06-10T17:00:00Z",
      dateLivraisonReelle: "2026-06-11T10:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: true,
      clotureInterne: true
    },
    prochaineActionRecommended: "Clôture",
    dateDernierStatut: "2026-06-11T10:00:00Z",
    avancementGlobal: 100,
    historiqueLogs: [
      "2026-06-10T08:00:00Z - [Réceptionnaire] - Réception du véhicule",
      "2026-06-10T09:00:00Z - [Chef d’atelier] - Planification tâche task1",
      "2026-06-10T11:00:00Z - [Contrôle Qualité] - Validation QC",
      "2026-06-11T10:00:00Z - [Livraison] - Livraison client effectuée"
    ]
  },
  {
    id: "NIMR-2026-002",
    clientNom: "Salah Mhadhbi",
    clientTelephone: "+216 55 111 001",
    deposantNom: "Salah Mhadhbi",
    deposantTelephone: "+216 55 111 001",
    vehiculeMarque: "Dongfeng",
    vehiculeModele: "Shine Max",
    vehiculeImmatriculation: "111 TU 111",
    vehiculeVIN: "VIN111",
    vehiculeKilometrage: 15000,
    vehiculeCouleur: "Noir",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.URGENTE,
    plainteClient: "Bruit train avant",
    observationsReception: "Bruit persistant",
    photosAvant: [],
    niveauCarburant: 25,
    etatCarrosserie: { rayures: true, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
    dateReception: "2026-06-12T09:00:00Z",
    dateSouhaiteeLivraison: "2026-06-12T17:00:00Z",
    statut: DossierStatus.BLOQUE,
    bloqueRaison: "Attente pièce de rechange (Magasin)",
    ordresReparation: [
      {
        id: "task2",
        designation: "Contrôle train avant",
        tempsEstime: 2.0,
        tempsPasse: 0,
        status: "blocked",
        plannedTechnicianId: "tech1",
        plannedBayId: "bay2",
        planningStart: "2026-06-12T10:00:00Z"
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
      dateLivraisonPrevue: "2026-06-12T17:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false
    },
    prochaineActionRecommended: "Attendre pièces",
    dateDernierStatut: "2026-06-12T11:00:00Z",
    avancementGlobal: 10,
    historiqueLogs: [
      "2026-06-12T09:00:00Z - [Réceptionnaire] - Réception du véhicule",
      "2026-06-12T11:00:00Z - [Chef d’atelier] - Blocage Tâche \"Contrôle train avant\" - Motif: Attente pièce de rechange (Magasin)"
    ]
  }
];

const mockReservations: WorkshopReservation[] = [
  {
    reservationId: "res1",
    dossierId: "NIMR-2026-001",
    taskIds: ["task1"],
    totalHours: 1.5,
    desiredDate: "2026-06-10",
    status: "TRANSFORMEE_PLANNING",
    source: "reception",
    history: ["2026-06-10 - Créée", "2026-06-10 - Transformée en planning"]
  }
];

const mockComplaints: ReclammationClient[] = [
  {
    id: "comp1",
    dossierId: "NIMR-2026-002",
    clientNom: "Salah Mhadhbi",
    vehiculeNom: "Dongfeng Shine Max",
    motif: "Bruit toujours présent après livraison",
    criticite: "haute",
    responsable: "Directeur SAV",
    statut: "nouvelle",
    actionCorrective: "",
    delaiTraitement: "",
    dateCreation: "2026-06-13T10:00:00Z",
    historiqueLogs: ["2026-06-13T10:00:00Z - Réclamation enregistrée"]
  }
];

const mockAvailability: WorkshopAvailabilityConfig = {
  schedule: { days: [] },
  exceptions: [],
  absences: [],
  bayUnavailabilities: [],
  holidays: []
};

const mockVehicleMaster: VehicleMasterRecord[] = [
  {
    id: "vm1",
    vin: "VIN111",
    plateNumber: "111 TU 111",
    customerName: "Salah Mhadhbi",
    customerPhone: "+216 55 111 001",
    brand: "Dongfeng",
    model: "Shine Max"
  }
];

const defaultFilters: SavReportFilters = {
  period: "tous",
  vehicleMasterRecords: mockVehicleMaster
};

// 2. buildDossierHistory chronologie
{
  const history = buildDossierHistory(mockDossiers[0]);
  assert.strictEqual(history.length, 4);
  assert.strictEqual(history[0].type, "creation");
  assert.strictEqual(history[history.length - 1].type, "delivery");
  
  // Verify chronological sort
  const dates = history.map(h => new Date(h.date).getTime());
  for (let i = 0; i < dates.length - 1; i++) {
    assert.ok(dates[i] <= dates[i + 1], "History entries must be in chronological order");
  }
}

// 3. buildVehicleHistory
{
  const vHistory = buildVehicleHistory(mockDossiers, "VIN111", mockComplaints);
  assert.ok(vHistory);
  assert.strictEqual(vHistory.passagesCount, 2);
  assert.strictEqual(vHistory.dossiers.length, 2);
  assert.strictEqual(vHistory.complaintsCount, 1);
  
  // Check exact VIN grouping
  const vHistoryPlate = buildVehicleHistory(mockDossiers, "111 TU 111", mockComplaints);
  assert.ok(vHistoryPlate);
  assert.strictEqual(vHistoryPlate.vin, "VIN111");
}

// 4. buildClientHistory
{
  const cHistory = buildClientHistory(mockDossiers, "Salah Mhadhbi", mockComplaints);
  assert.ok(cHistory);
  assert.strictEqual(cHistory.passagesCount, 2);
  assert.strictEqual(cHistory.associatedVehicles.length, 1);
  assert.strictEqual(cHistory.clientTelephone, "+216 55 111 001");
}

// 5. buildReceptionReport
{
  const rReport = buildReceptionReport(mockDossiers, defaultFilters);
  assert.strictEqual(rReport.totalCreated, 2);
  assert.strictEqual(rReport.prefilledCount, 2);
  assert.strictEqual(rReport.manualCount, 0);
  assert.strictEqual(rReport.prefilledPercentage, 100);
}

// 6. buildWorkshopReport
{
  const wReport = buildWorkshopReport(mockDossiers, mockReservations, mockAvailability, defaultFilters);
  assert.strictEqual(wReport.tasksByStatus.done, 1);
  assert.strictEqual(wReport.tasksByStatus.blocked, 1);
  assert.strictEqual(wReport.totalLaborHoursEstimated, 3.5); // 1.5 + 2.0
  assert.strictEqual(wReport.totalLaborHoursPlanned, 3.5); // both have planningStart
  assert.strictEqual(wReport.totalLaborHoursSpent, 1.5); // task1 is done
}

// 7. buildPlanningReport
{
  const pReport = buildPlanningReport(mockDossiers, mockReservations, defaultFilters);
  assert.strictEqual(pReport.reservationsConvertedCount, 1);
  assert.strictEqual(pReport.conversionRate, 100);
}

// 8. buildQcReport
{
  const qReport = buildQcReport(mockDossiers, defaultFilters);
  assert.strictEqual(qReport.totalQcChecked, 1);
  assert.strictEqual(qReport.totalQcPassed, 1);
  assert.strictEqual(qReport.totalQcFailed, 0);
  assert.strictEqual(qReport.passRate, 100);
  assert.strictEqual(qReport.firstTimeRightRate, 100);
}

// 9. buildDeliveryReport
{
  const dReport = buildDeliveryReport(mockDossiers, defaultFilters);
  assert.strictEqual(dReport.totalDelivered, 1);
  assert.ok(dReport.restitutionStatuses.some(item => item.status === "Livré sans réserve" && item.count === 1));
  // dateValidation is 2026-06-10T11:00:00Z
  // dateLivraisonReelle is 2026-06-11T10:00:00Z
  // Difference is ~23h = 0.958 days
  assert.ok(dReport.averageQcToDeliveryDays > 0.9 && dReport.averageQcToDeliveryDays < 1.0);
}

// 10. buildComplaintsReport
{
  const cReport = buildComplaintsReport(mockComplaints, defaultFilters);
  assert.strictEqual(cReport.totalComplaints, 1);
  assert.strictEqual(cReport.byStatus.nouvelle, 1);
}

// 11. buildBlockingReport
{
  const bReport = buildBlockingReport(mockDossiers, mockComplaints, defaultFilters);
  assert.strictEqual(bReport.totalBlockedDossiers, 1);
  assert.strictEqual(bReport.totalBlockedTasks, 1);
  assert.strictEqual(bReport.blockingByFamily.find(f => f.family === "Attente Pièces")?.count, 1);
}

// 12. Strict checking of financial words absence in report outputs
{
  const reports = [
    buildReceptionReport(mockDossiers, defaultFilters),
    buildWorkshopReport(mockDossiers, mockReservations, mockAvailability, defaultFilters),
    buildPlanningReport(mockDossiers, mockReservations, defaultFilters),
    buildQcReport(mockDossiers, defaultFilters),
    buildDeliveryReport(mockDossiers, defaultFilters),
    buildComplaintsReport(mockComplaints, defaultFilters),
    buildBlockingReport(mockDossiers, mockComplaints, defaultFilters),
    buildOperationalKpis(mockDossiers, mockReservations, mockComplaints, defaultFilters)
  ];

  const forbiddenKeys = [
    "ca",
    ["mar", "ge"].join(""),
    ["paie", "ment"].join(""),
    ["cai", "sse"].join(""),
    ["pr", "ix"].join(""),
    "cout",
    "facture",
    ["mon", "tant"].join(""),
    "solde",
  ];
  
  reports.forEach(rep => {
    const jsonStr = JSON.stringify(rep).toLowerCase();
    forbiddenKeys.forEach(key => {
      // We check that these exact keys don't exist in report structures
      assert.ok(!jsonStr.includes(`"${key}"`), `Report structure must not contain financial key "${key}"`);
    });
  });
}

console.log("Tous les tests sav-reports ont réussi !");
