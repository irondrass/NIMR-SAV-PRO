import assert from "node:assert/strict";
import fs from "node:fs";
import { buildVehicleAutoReservationPlan, getVehicleETAInfo } from "../src/sav-core";
import { DossierSAV, DossierStatus, DossierPriority, RepairOrderLine, UserRole, WorkshopAvailabilityConfig, WorkshopReservation, AtelierZone, InterventionType, TechnicienResource } from "../src/types";

console.log("Démarrage du test: planning-actionability...");

// Check that WorkshopPlanning.tsx allows Directeur SAV and contains the buttons
const planningSource = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");

assert.ok(planningSource.includes('data-testid="planning-reserve-button"'), "Auto-reserve button must be present in WorkshopPlanning.");
assert.ok(planningSource.includes('data-testid="planning-suggest-btn"'), "Suggest button must be present in WorkshopPlanning.");
assert.ok(planningSource.includes('data-testid="auto-reserve-confirmation"'), "Confirmation card must be present in WorkshopPlanning.");

// Verify role guards allow Directeur SAV
assert.ok(planningSource.includes("[UserRole.CHEF_ATELIER, UserRole.DIRECTEUR_SAV]"), "Role checks must allow CHEF_ATELIER and DIRECTEUR_SAV.");

// Test that building auto-reservation sets planning start, end, and ETA becomes defined
const task1: RepairOrderLine = {
  id: "task_1",
  designation: "Vidange moteur",
  tempsEstime: 2,
  tempsPasse: 0,
  status: "pending",
  isEstimatedDurationValidated: true,
  estimateSource: "preset",
};

const dossier: DossierSAV = {
  id: "DOS-TEST-PLAN",
  clientNom: "NIMR Client",
  clientTelephone: "123456",
  deposantNom: "Deposant",
  deposantTelephone: "78910",
  vehiculeMarque: "NIMR",
  vehiculeModele: "SAV",
  vehiculeImmatriculation: "123-A-45",
  vehiculeVIN: "VIN12345",
  vehiculeKilometrage: 10000,
  vehiculeCouleur: "rouge",
  typeDossier: "mécanique" as InterventionType,
  priorite: DossierPriority.NORMALE,
  plainteClient: "Bruit moteur",
  observationsReception: "Aucune",
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
  dateReception: "2026-07-02T08:00:00.000Z",
  dateSouhaiteeLivraison: "2026-07-03T17:00:00.000Z",
  statut: DossierStatus.VEHICULE_RECU,
  ordresReparation: [task1],
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
    dateLivraisonPrevue: "2026-07-03T17:00:00.000Z",
    remarquesLivraison: "",
    confirmationReceptionClient: false,
    clotureInterne: false,
  },
  prochaineActionRecommended: "",
  dateDernierStatut: "2026-07-02T08:00:00.000Z",
  avancementGlobal: 0,
  stepServiceTypes: {
    "mechanical": "mecanique",
  },
};

const availabilityConfig: WorkshopAvailabilityConfig = {
  schedule: {
    days: [
      { dayOfWeek: 1, isClosed: false, windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }] },
      { dayOfWeek: 2, isClosed: false, windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }] },
      { dayOfWeek: 3, isClosed: false, windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }] },
      { dayOfWeek: 4, isClosed: false, windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }] },
      { dayOfWeek: 5, isClosed: false, windows: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }] },
    ]
  },
  exceptions: [],
  absences: [],
  bayUnavailabilities: [],
  holidays: [],
};

const testTechs: TechnicienResource[] = [
  {
    id: "tech_meca",
    nom: "Meca Guy",
    specialite: "Mécanicien",
    disponibilite: "disponible",
    compétences: [],
    zoneAffectee: AtelierZone.MECANIQUE_RAPIDE,
    absencesConges: [],
    capaciteJournaliere: 8,
    chargeActuelle: 0,
  }
];

const result = buildVehicleAutoReservationPlan({
  dossiers: [dossier],
  reservations: [],
  targetDossierId: dossier.id,
  selectedDate: new Date("2026-07-03T08:00:00.000Z"),
  technicians: testTechs,
  workshopBays: [{ id: "bay_1", name: "Pont 1", zone: AtelierZone.MECANIQUE_RAPIDE }],
  availabilityConfig,
}, new Date("2026-07-03T08:00:00.000Z"));

assert.equal(result.ok, true, "Auto-reservation plan building should succeed.");
if (result.ok) {
  assert.equal(result.createdReservations.length, 1, "One reservation should have been created.");
  const updatedDossier = result.dossiers.find(d => d.id === dossier.id);
  assert.ok(updatedDossier, "Dossier should have been updated.");
  assert.equal(updatedDossier?.statut, DossierStatus.TRAVAUX_PLANIFIES, "Dossier status should be TRAVAUX_PLANIFIES.");

  // Verify ETA becomes defined
  const etaInfo = getVehicleETAInfo(result.dossiers, dossier.id, result.reservations, testTechs);
  assert.ok(etaInfo.etaDateTime, "ETA date time should be defined after planning.");
  assert.equal(etaInfo.reliability, "Élevée", "Reliability should be high when all tasks are planned.");
}

console.log("planning-actionability.test.ts OK");
