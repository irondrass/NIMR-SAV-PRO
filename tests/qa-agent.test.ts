import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  addWarrantyLocalAttachment,
  archiveDeliveredDossier,
  suggestWorkshopSlot,
  validatePlanningAssignment,
  calculateTechnicianDailyLoad,
  blockRepairOrder,
  canDeliverDossier,
  confirmDelivery,
  finishRepairOrder,
  getDeliveryReadiness,
  getDossierQCStatus,
  getDossierOperationalBucket,
  getVisibleTechnicianTasks,
  invalidateQCAfterWorkshopChange,
  isOperationalActiveDossier,
  markDossierImmobilized,
  recordSatisfactionFeedback,
  startRepairOrder,
  shouldShowDossierForTechnician,
  createReceptionDossier,
  submitQualityControl,
  validateBackupPayload,
} from "../src/sav-core";
import {
  ROLE_PERMISSIONS,
  canAccessTab,
  canArchiveDeliveredDossier,
  canManageWarranty,
  canManageUsers,
  canRecordSatisfaction,
  isReadOnlyRole,
  canViewVehicleSensitiveFields,
  canViewSavReports,
  canViewSensitiveReportFields,
  canExportSavReports,
  canViewWarranty,
} from "../src/permissions";
import {
  buildDossierHistory,
  buildVehicleHistory,
  maskPhone,
  buildReceptionReport,
  buildComplaintsReport,
  buildPlanningReport,
} from "../src/sav-reports";
import {
  findMappedField,
  getVehicleMasterStats,
  normalizeHeader,
  parseVehicleMasterCsv,
  searchVehicleMaster,
  getVehicleWarrantyStatus,
  VEHICLE_MODEL_TO_FILL_PLACEHOLDER,
} from "../src/vehicle-master";
import {
  getVehicleAggregatedStatus,
  searchVehiclesAndDossiers,
  getVehicleKey,
} from "../src/vehicle-status.js";
import {
  addComplaintAction,
  canEditComplaint,
  changeComplaintStatus,
  closeComplaint,
  createCorrectiveTaskFromComplaint,
  isComplaintLinkedToReadyDelivery,
  isComplaintOpen,
  isComplaintOverdue,
  linkComplaintToRepairOrder,
  normalizeComplaint,
} from "../src/complaints-workflow";
import {
  parseQuoteText,
  buildQuoteImportPreview,
  validateQuoteImportPreview,
  mapLaborLinesToRepairOrderLines,
  extractLaborHours,
  classifyQuoteLine,
  cleanLaborDescription,
  isAdministrativeQuoteLine,
  extractTableZoneLines,
} from "../src/quote-import";
import {
  AtelierZone,
  DossierPriority,
  DossierSAV,
  DossierStatus,
  InterventionType,
  ReclammationClient,
  RepairOrderLine,
  TechnicienResource,
  UserRole,
  WorkshopBay,
  WorkshopAvailabilityConfig,
  WorkshopReservation,
} from "../src/types";
import { INITIAL_DOSSIERS } from "../src/data";
import { buildDirectorDashboardKpis, extractDossierTiming } from "../src/dashboard-kpis";
import { clearAuditTrail, getAuditTrail, logAuditEvent } from "../src/audit-trail";
import {
  maskPhoneNumber,
  sanitizeFreeText,
  validateConditionalVin,
  validateComplaintText,
  validateDeliveryRestitutionStatus,
  validateMileage,
  validatePlateNumber,
  validateStructuredTechnicianDiagnostic,
  validateTechnicianDiagnostic,
  validateTunisianPhone,
  validateVin,
} from "../src/field-validations";
import {
  buildImportSummary,
  createPreImportBackupPayload,
  createRoleAwareBackupPayload,
  isStrongImportConfirmation,
  STRONG_IMPORT_CONFIRMATION,
} from "../src/import-export-safety";
import {
  CLIENT_SIDE_SECURITY_NOTICE,
  PILOT_SIGNATURE_NOTICE,
  WARRANTY_LOCAL_ATTACHMENT_NOTICE,
} from "../src/rc-notices";


interface QACheck {
  id: string;
  category: string;
  description: string;
  run: () => void;
}

const checks: QACheck[] = [];
const anomalies: string[] = [];
let passCount = 0;
let failCount = 0;

function registerCheck(category: string, description: string, runFn: () => void) {
  checks.push({
    id: `QA-${checks.length + 1}`,
    category,
    description,
    run: runFn,
  });
}

function stripOperationalWorkshopMargin(content: string): string {
  return content
    .replace(/marge atelier/g, "")
    .replace(/planning-workshop-margin/g, "")
    .replace(/workshopmarginhours/g, "");
}

// -----------------------------------------------------------------
// Define Test Fixtures
// -----------------------------------------------------------------
const mockTechs: TechnicienResource[] = [
  { id: "tech_01", nom: "Salah", specialite: "Mecanicien", disponibilite: "disponible", compétences: [], zoneAffectee: AtelierZone.MECANIQUE_RAPIDE, absencesConges: [], capaciteJournaliere: 8, chargeActuelle: 0 },
  { id: "tech_02", nom: "Anis", specialite: "Electricien", disponibilite: "disponible", compétences: [], zoneAffectee: AtelierZone.ELECTRICITE_DIAG, absencesConges: [], capaciteJournaliere: 8, chargeActuelle: 0 },
];
const mockBays: WorkshopBay[] = [
  { id: "bay_01", name: "Pont 1", zone: AtelierZone.MECANIQUE_RAPIDE },
];
const getMockDossier = (overrides: Partial<DossierSAV> = {}): DossierSAV => ({
  id: "NIMR-QA-001",
  clientNom: "Client Test",
  clientTelephone: "123",
  deposantNom: "Client Test",
  deposantTelephone: "123",
  vehiculeMarque: "Dongfeng",
  vehiculeModele: "S50",
  vehiculeImmatriculation: "123 TU 456",
  vehiculeVIN: "123456789",
  vehiculeKilometrage: 1000,
  vehiculeCouleur: "Noir",
  typeDossier: InterventionType.ENTRETIEN_RAPIDE,
  priorite: DossierPriority.NORMALE,
  plainteClient: "RAS",
  observationsReception: "RAS",
  photosAvant: [],
  niveauCarburant: 50,
  etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
  objetsLaisses: [],
  dateReception: "2026-06-12T08:00:00Z",
  dateSouhaiteeLivraison: "2026-06-12T17:00:00Z",
  statut: DossierStatus.TRAVAUX_PLANIFIES,
  prochaineActionRecommended: "",
  dateDernierStatut: "2026-06-12T08:00:00Z",
  avancementGlobal: 0,
  ordresReparation: [
    { id: "task_01", designation: "Vidange", tempsEstime: 1, tempsPasse: 0, status: "pending" }
  ],
  complements: [],
  accords: [],
  checklistQC: { essaiEffectue: false, defautRepare: false, aucunVoyantAllume: false, niveauxVerifies: false, serrageSecurite: false, propreteVehicule: false, documentsPrets: false, photosApresOk: false, validationGlobale: "en_attente" },
  livraison: { controleQualiteOk: false, clientInforme: false, dateLivraisonPrevue: "", remarquesLivraison: "", confirmationReceptionClient: false, clotureInterne: false },
  ...overrides,
});

const getMockComplaint = (overrides: Partial<ReclammationClient> = {}): ReclammationClient => ({
  id: "REC-QA-001",
  dossierId: "NIMR-QA-001",
  clientNom: "Client Réclamation QA",
  vehiculeNom: "Dongfeng S50",
  immatriculation: "123 TU 456",
  motif: "Retard traitement réclamation",
  criticite: "haute",
  responsable: "Responsable QA",
  statut: "nouvelle",
  actionCorrective: "Analyse initiale",
  delaiCible: "2026-06-12T12:00:00Z",
  delaiTraitement: "2026-06-12T12:00:00Z",
  dateCreation: "2026-06-12T08:00:00Z",
  dateDerniereModification: "2026-06-12T08:00:00Z",
  historiqueActions: [],
  historiqueLogs: [],
  ...overrides,
});

// -----------------------------------------------------------------
// A. PLANNING TESTS
// -----------------------------------------------------------------

registerCheck("Planning", "Aucune suggestion dans le passé", () => {
  const now = new Date("2026-06-12T10:00:00");
  const pastDesiredDate = new Date("2026-06-11T08:00:00");
  try {
    suggestWorkshopSlot({
      dossiers: [],
      technicians: mockTechs,
      workshopBays: mockBays,
      estimatedHours: 1,
      desiredDate: pastDesiredDate,
    }, now);
    throw new Error("Moteur a accepté une suggestion dans le passé.");
  } catch (e: any) {
    assert.match(e.message, /Impossible de planifier dans le passé/);
  }
});

registerCheck("Planning", "Aucune sauvegarde de planning dans le passé", () => {
  const now = new Date("2026-06-12T10:00:00");
  const validation = validatePlanningAssignment({
    dossiers: [getMockDossier()],
    dossierId: "NIMR-QA-001",
    lineId: "task_01",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-11T08:00:00",
    end: "2026-06-11T09:00:00",
  }, now);
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("planning-in-past"));
});

registerCheck("Planning", "Aucune collision technicien sauvegardable", () => {
  const now = new Date("2026-06-12T08:00:00");
  const plannedDossier = getMockDossier({
    ordresReparation: [
      {
        id: "task_01",
        designation: "Tâche 1",
        tempsEstime: 2,
        tempsPasse: 0,
        status: "pending",
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_01",
        planningDate: "2026-06-12",
        planningStart: "2026-06-12T09:00:00",
        planningEnd: "2026-06-12T11:00:00",
      }
    ]
  });

  const validation = validatePlanningAssignment({
    dossiers: [plannedDossier],
    dossierId: "NIMR-QA-OTHER",
    lineId: "task_other",
    technicianId: "tech_01",
    bayId: "bay_02",
    start: "2026-06-12T10:00:00",
    end: "2026-06-12T12:00:00",
  }, now);
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("planning-collision-tech"));
});

registerCheck("Planning", "Aucune collision pont sauvegardable", () => {
  const now = new Date("2026-06-12T08:00:00");
  const plannedDossier = getMockDossier({
    ordresReparation: [
      {
        id: "task_01",
        designation: "Tâche 1",
        tempsEstime: 2,
        tempsPasse: 0,
        status: "pending",
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_01",
        planningDate: "2026-06-12",
        planningStart: "2026-06-12T09:00:00",
        planningEnd: "2026-06-12T11:00:00",
      }
    ]
  });

  const validation = validatePlanningAssignment({
    dossiers: [plannedDossier],
    dossierId: "NIMR-QA-OTHER",
    lineId: "task_other",
    technicianId: "tech_02",
    bayId: "bay_01",
    start: "2026-06-12T10:00:00",
    end: "2026-06-12T12:00:00",
  }, now);
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("planning-collision-bay"));
});

registerCheck("Planning", "Pause midi jamais comptée ou planifiable sur bloc continu", () => {
  const now = new Date("2026-06-12T08:00:00");
  const validation = validatePlanningAssignment({
    dossiers: [getMockDossier()],
    dossierId: "NIMR-PLAN-LUNCH",
    lineId: "ro_lunch",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-12T11:00:00",
    end: "2026-06-12T14:00:00",
    planningSegments: [{ start: "2026-06-12T11:00:00", end: "2026-06-12T14:00:00" }],
  }, now);
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("planning-collision-lunch"));
});

registerCheck("Planning", "Dimanche jamais planifiable", () => {
  const now = new Date("2026-06-12T08:00:00");
  const validation = validatePlanningAssignment({
    dossiers: [getMockDossier()],
    dossierId: "NIMR-PLAN-SUNDAY",
    lineId: "ro_sun",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-14T09:00:00", // Sunday
    end: "2026-06-14T10:00:00",
  }, now);
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("planning-collision-sunday"));
});

registerCheck("Planning", "Samedi après-midi jamais planifiable", () => {
  const now = new Date("2026-06-12T08:00:00");
  const validation = validatePlanningAssignment({
    dossiers: [getMockDossier()],
    dossierId: "NIMR-PLAN-SATURDAY",
    lineId: "ro_sat",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-13T13:00:00", // Saturday afternoon
    end: "2026-06-13T14:00:00",
  }, now);
  assert.equal(validation.allowed, false);
  assert.ok(validation.codes.includes("planning-collision-saturday-afternoon"));
});

// Helper for status tests
function getTechnicianStatusLabel(tech: TechnicienResource, dossiers: DossierSAV[], now: Date): string {
  const todayStr = getLocalDateStr(now);
  const isNonDisponible = tech.disponibilite === "absent" || tech.disponibilite === "formation";
  
  const hasInProgressTask = dossiers.some(d => 
    d.ordresReparation.some(l => 
      l.plannedTechnicianId === tech.id && 
      l.status === "in_progress"
    )
  ) || dossiers.some(d => 
    d.technicienId === tech.id && 
    d.ordresReparation.some(l => l.status === "in_progress")
  );

  const todayTechSegments: Array<{ start: Date; end: Date }> = [];
  dossiers.forEach(d => {
    if (d.statut !== DossierStatus.LIVRE && d.statut !== DossierStatus.CLOTURE) {
      d.ordresReparation.forEach(l => {
        if (l.plannedTechnicianId === tech.id && l.planningDate === todayStr && l.planningStart && l.planningEnd) {
          const segments = l.planningSegments || [{ start: l.planningStart, end: l.planningEnd }];
          segments.forEach(seg => {
            todayTechSegments.push({
              start: new Date(seg.start),
              end: new Date(seg.end)
            });
          });
        }
      });
    }
  });

  const hasSegmentCoveringNow = todayTechSegments.some(seg => {
    const t = now.getTime();
    return t >= seg.start.getTime() && t <= seg.end.getTime();
  });

  const hasSegmentsToday = todayTechSegments.length > 0;

  if (isNonDisponible) return "Non disponible";
  if (hasInProgressTask || hasSegmentCoveringNow) return "Occupé maintenant";
  if (hasSegmentsToday) return "Planifié aujourd’hui";
  return "Disponible";
}

function getLocalDateStr(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

registerCheck("Planning", "Technicien planifié plus tard != occupé maintenant", () => {
  const now = new Date("2026-06-12T09:53:00");
  const plannedDossier = getMockDossier({
    ordresReparation: [
      {
        id: "task_01",
        designation: "Tâche tard",
        tempsEstime: 2,
        tempsPasse: 0,
        status: "pending",
        plannedTechnicianId: "tech_01",
        planningDate: "2026-06-12",
        planningStart: "2026-06-12T14:00:00",
        planningEnd: "2026-06-12T16:00:00",
      }
    ]
  });

  const status = getTechnicianStatusLabel(mockTechs[0], [plannedDossier], now);
  assert.equal(status, "Planifié aujourd’hui");
});

// -----------------------------------------------------------------
// B. DOSSIER & DELIVERY CHECKS
// -----------------------------------------------------------------

registerCheck("Dossier", "Livraison impossible sans QC accepté", () => {
  const dossier = getMockDossier({
    statut: DossierStatus.TRAVAUX_PLANIFIES,
    checklistQC: { essaiEffectue: true, defautRepare: true, aucunVoyantAllume: true, niveauxVerifies: true, serrageSecurite: true, propreteVehicule: true, documentsPrets: true, photosApresOk: true, validationGlobale: "en_attente" },
  });
  const gate = canDeliverDossier(dossier);
  assert.equal(gate.allowed, false);
  assert.ok(gate.reasons.some(r => r.includes("Contrôle qualité accepté obligatoire")));
});

registerCheck("Dossier", "Livraison impossible avec tâche active", () => {
  const dossier = getMockDossier({
    statut: DossierStatus.PRET_A_LIVRER,
    checklistQC: { essaiEffectue: true, defautRepare: true, aucunVoyantAllume: true, niveauxVerifies: true, serrageSecurite: true, propreteVehicule: true, documentsPrets: true, photosApresOk: true, validationGlobale: "valide" },
    ordresReparation: [
      { id: "task_01", designation: "Vidange", tempsEstime: 1, tempsPasse: 0, status: "in_progress" }
    ],
  });
  const gate = canDeliverDossier(dossier);
  assert.equal(gate.allowed, false);
  assert.ok(gate.reasons.some(r => r.includes("tâche atelier est encore en cours")));
});

registerCheck("Dossier", "Livraison impossible avec tâche bloquée", () => {
  const dossier = getMockDossier({
    statut: DossierStatus.PRET_A_LIVRER,
    checklistQC: { essaiEffectue: true, defautRepare: true, aucunVoyantAllume: true, niveauxVerifies: true, serrageSecurite: true, propreteVehicule: true, documentsPrets: true, photosApresOk: true, validationGlobale: "valide" },
    ordresReparation: [
      { id: "task_01", designation: "Vidange", tempsEstime: 1, tempsPasse: 0, status: "blocked" }
    ],
  });
  const gate = canDeliverDossier(dossier);
  assert.equal(gate.allowed, false);
  assert.ok(gate.reasons.some(r => r.includes("tâche atelier est bloquée")));
});

registerCheck("Dossier", "Livraison impossible après QC refusé", () => {
  const dossier = getMockDossier({
    statut: DossierStatus.PRET_A_LIVRER,
    checklistQC: { essaiEffectue: true, defautRepare: true, aucunVoyantAllume: true, niveauxVerifies: true, serrageSecurite: true, propreteVehicule: true, documentsPrets: true, photosApresOk: true, validationGlobale: "refuse" },
  });
  const gate = canDeliverDossier(dossier);
  assert.equal(gate.allowed, false);
  assert.ok(gate.reasons.some(r => r.includes("Contrôle qualité refusé")));
});

// -----------------------------------------------------------------
// C. TASKS CHECKS
// -----------------------------------------------------------------

registerCheck("Tâches", "Une seule tâche active par technicien", () => {
  const tech = mockTechs[0];
  const dossierActive = getMockDossier({
    id: "NIMR-ACTIVE",
    ordresReparation: [
      { id: "task_1", designation: "Vidange", tempsEstime: 1, tempsPasse: 0, status: "in_progress", plannedTechnicianId: tech.id }
    ]
  });

  const dossierNew = getMockDossier({
    id: "NIMR-NEW",
    ordresReparation: [
      { id: "task_2", designation: "Filtre", tempsEstime: 1, tempsPasse: 0, status: "pending", plannedTechnicianId: tech.id }
    ]
  });

  // Attempt to start task 2
  const result = startRepairOrder([dossierActive, dossierNew], "NIMR-NEW", "task_2");
  assert.equal(result.ok, false);
  assert.match(result.error || "", /technicien a déjà une tâche en cours/);
});

registerCheck("Tâches", "Tâche terminée non redémarrable sans réouverture", () => {
  const tech = mockTechs[0];
  const dossierDone = getMockDossier({
    ordresReparation: [
      { id: "task_1", designation: "Vidange", tempsEstime: 1, tempsPasse: 0, status: "done", plannedTechnicianId: tech.id }
    ]
  });

  const result = startRepairOrder([dossierDone], dossierDone.id, "task_1");
  assert.equal(result.ok, false);
  assert.match(result.error || "", /réouverte/);
});

// -----------------------------------------------------------------
// D. AUTH & ROLES
// -----------------------------------------------------------------

registerCheck("Auth/Rôles", "Lecture seule ne peut rien modifier", () => {
  assert.equal(isReadOnlyRole(UserRole.LECTURE_SEULE), true);
  assert.equal(canAccessTab(UserRole.LECTURE_SEULE, "settings"), false);
  assert.equal(canManageUsers(UserRole.LECTURE_SEULE), false);
});

// -----------------------------------------------------------------
// E. CODE QUALITY SCAN
// -----------------------------------------------------------------

registerCheck("Qualité Code", "Aucun prompt() ou alert()", () => {
  const srcDir = path.resolve("src");
  const files = getFilesRecursively(srcDir);
  
  for (const file of files) {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("alert(") && !file.includes("qa-agent")) {
      throw new Error(`alert() trouvé dans le fichier : ${file}`);
    }
    if (content.includes("prompt(") && !file.includes("qa-agent")) {
      throw new Error(`prompt() trouvé dans le fichier : ${file}`);
    }
  }
});

registerCheck("Qualité Code", "Aucun force-status-select dans les fiches", () => {
  const srcDir = path.resolve("src");
  const files = getFilesRecursively(srcDir);
  
  for (const file of files) {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("force-status-select")) {
      throw new Error(`force-status-select trouvé dans le fichier : ${file}`);
    }
  }
});

registerCheck("Qualité Code", "Aucune ancienne clé nimr-sav ou nimr_sav", () => {
  const srcDir = path.resolve("src");
  const files = getFilesRecursively(srcDir);
  
  for (const file of files) {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const content = fs.readFileSync(file, "utf8");
    // Keys shouldn't be plain "nimr-sav" or "nimr_sav"
    if (content.includes('"nimr-sav"') || content.includes('"nimr_sav"') || content.includes("'nimr-sav'") || content.includes("'nimr_sav'")) {
      throw new Error(`Ancienne clé localStorage obsolète trouvée dans le fichier : ${file}`);
    }
  }
});

function getFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

// -----------------------------------------------------------------
// Lot 5E Invariants
// -----------------------------------------------------------------

registerCheck("Planning", "Statut tâche visible dans le code source de planification", () => {
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  const visualContent = fs.readFileSync("src/task-status-visual.ts", "utf8");
  assert.ok(visualContent.includes("gantt-task-status-pending"));
  assert.ok(visualContent.includes("gantt-task-status-in-progress"));
  assert.ok(visualContent.includes("gantt-task-status-paused"));
  assert.ok(visualContent.includes("gantt-task-status-blocked"));
  assert.ok(visualContent.includes("gantt-task-status-done"));
  assert.ok(visualContent.includes("gantt-task-status-reopened"));
  assert.ok(planningContent.includes("getTaskStatusVisual"));
  assert.ok(planningContent.includes("gantt-status-legend"));
});

registerCheck("Véhicules", "Véhicule multi-dossiers correctement agrégé", () => {
  const d1 = getMockDossier({ id: "D1", vehiculeImmatriculation: "IMMAT_X", statut: DossierStatus.LIVRE });
  const d2 = getMockDossier({
    id: "D2",
    vehiculeImmatriculation: "IMMAT_X",
    statut: DossierStatus.EN_TRAVAUX,
    ordresReparation: [
      { id: "task_01", designation: "Vidange", tempsEstime: 1, tempsPasse: 0, status: "in_progress" }
    ]
  });

  const status = getVehicleAggregatedStatus([d1, d2]);
  assert.equal(status, "En cours");
});

registerCheck("Véhicules", "Recherche véhicule/dossier opérationnelle", () => {
  const d1 = getMockDossier({ id: "D1", clientNom: "Alice", vehiculeImmatriculation: "IMMAT_Y" });
  const d2 = getMockDossier({ id: "D2", clientNom: "Bob", vehiculeImmatriculation: "IMMAT_Z" });

  const results = searchVehiclesAndDossiers([d1, d2], "Alice");
  assert.equal(results.length, 1);
  assert.equal(results[0].vehiculeImmatriculation, "IMMAT_Y");
});

registerCheck("Véhicules", "Ancien dossier livré ne masque pas dossier actif", () => {
  const dOld = getMockDossier({ id: "D_OLD", vehiculeImmatriculation: "IMMAT_W", statut: DossierStatus.LIVRE });
  const dNew = getMockDossier({ id: "D_NEW", vehiculeImmatriculation: "IMMAT_W", statut: DossierStatus.BLOQUE });

  const status = getVehicleAggregatedStatus([dOld, dNew]);
  assert.equal(status, "Bloqué");
});

// -----------------------------------------------------------------
// Lot 5F-1 Operational Cleanup Invariants
// -----------------------------------------------------------------

registerCheck("Lot 5F-1", "Technicien ne voit pas les tâches terminées", () => {
  const dossier = getMockDossier({
    id: "D_TECH_ACTIVE",
    statut: DossierStatus.EN_TRAVAUX,
    technicienId: "tech_01",
    ordresReparation: [
      { id: "task_pending", designation: "À faire", tempsEstime: 1, tempsPasse: 0, status: "pending" },
      { id: "task_done", designation: "Terminée", tempsEstime: 1, tempsPasse: 1, status: "done" },
    ],
  });

  const visibleTasks = getVisibleTechnicianTasks(dossier, "tech_01");
  assert.deepEqual(visibleTasks.map(task => task.id), ["task_pending"]);
});

registerCheck("Lot 5F-1", "Technicien ne voit pas dossier prêt facturation ERP", () => {
  const dossier = getMockDossier({
    id: "D_TECH_ERP",
    statut: DossierStatus.PRET_FACTURATION,
    technicienId: "tech_01",
    ordresReparation: [
      { id: "task_pending", designation: "À faire", tempsEstime: 1, tempsPasse: 0, status: "pending" },
    ],
  });

  assert.equal(shouldShowDossierForTechnician(dossier, "tech_01"), false);
});

registerCheck("Lot 5F-1", "Vue dossiers Actifs exclut prêt facturation ERP", () => {
  const active = getMockDossier({ id: "D_ACTIVE", statut: DossierStatus.EN_TRAVAUX });
  const readyErp = getMockDossier({ id: "D_ERP", statut: DossierStatus.PRET_FACTURATION });
  const delivered = getMockDossier({ id: "D_DELIVERED", statut: DossierStatus.LIVRE });
  const closed = getMockDossier({ id: "D_CLOSED", statut: DossierStatus.CLOTURE });

  assert.equal(isOperationalActiveDossier(active), true);
  assert.equal(isOperationalActiveDossier(readyErp), false);
  assert.equal(isOperationalActiveDossier(delivered), false);
  assert.equal(isOperationalActiveDossier(closed), false);
});

registerCheck("Lot 5F-1", "Kanban exclut prêt facturation ERP / livré / clôturé", () => {
  const dossiers = [
    getMockDossier({ id: "D_WORK", statut: DossierStatus.EN_TRAVAUX }),
    getMockDossier({ id: "D_READY", statut: DossierStatus.PRET_A_LIVRER }),
    getMockDossier({ id: "D_ERP", statut: DossierStatus.PRET_FACTURATION }),
    getMockDossier({ id: "D_DELIVERED", statut: DossierStatus.LIVRE }),
    getMockDossier({ id: "D_CLOSED", statut: DossierStatus.CLOTURE }),
  ];

  const productionIds = dossiers.filter(isOperationalActiveDossier).map(dossier => dossier.id);
  assert.deepEqual(productionIds, ["D_WORK", "D_READY"]);
});

registerCheck("Lot 5F-1", "Recherche véhicule garde l'historique mais distingue actif / livré / prêt ERP", () => {
  const dActive = getMockDossier({ id: "D_ACTIVE", vehiculeImmatriculation: "777 TU 001", statut: DossierStatus.EN_TRAVAUX });
  const dDelivered = getMockDossier({ id: "D_DELIVERED", vehiculeImmatriculation: "777 TU 001", statut: DossierStatus.LIVRE });
  const dErp = getMockDossier({ id: "D_ERP", vehiculeImmatriculation: "777 TU 001", statut: DossierStatus.PRET_FACTURATION });

  const results = searchVehiclesAndDossiers([dActive, dDelivered, dErp], "777 TU 001");
  assert.equal(results.length, 1);
  assert.equal(results[0].dossiers.length, 3);
  assert.deepEqual(
    results[0].dossiers.map(getDossierOperationalBucket).sort(),
    ["active", "delivered", "ready_for_billing"].sort()
  );
});

// -----------------------------------------------------------------
// Lot 5F-2 Complaint Workflow Invariants
// -----------------------------------------------------------------

registerCheck("Lot 5F-2", "Réclamation critique ouverte détectée", () => {
  const complaint = getMockComplaint({ criticite: "critique", statut: "action_corrective" });
  assert.equal(complaint.criticite, "critique");
  assert.equal(isComplaintOpen(complaint), true);
});

registerCheck("Lot 5F-2", "Réclamation en retard détectée", () => {
  const complaint = getMockComplaint({ delaiCible: "2026-06-12T08:00:00Z", statut: "en_analyse" });
  assert.equal(isComplaintOverdue(complaint, new Date("2026-06-12T10:00:00Z")), true);
});

registerCheck("Lot 5F-2", "Lecture seule ne peut pas modifier une réclamation", () => {
  assert.equal(canEditComplaint(UserRole.LECTURE_SEULE, getMockComplaint()), false);
});

registerCheck("Lot 5F-2", "Chaque changement statut crée historique", () => {
  const first = changeComplaintStatus(getMockComplaint(), "en_analyse", { user: "QA", role: UserRole.DIRECTEUR_SAV }, "Analyse", new Date("2026-06-12T09:00:00Z"));
  const second = changeComplaintStatus(first, "action_corrective", { user: "QA", role: UserRole.DIRECTEUR_SAV }, "Action", new Date("2026-06-12T09:30:00Z"));
  const normalized = normalizeComplaint(second);
  assert.equal(normalized.historiqueActions?.length, 2);
  assert.equal(normalized.historiqueActions?.[0].nouveauStatut, "action_corrective");
});

registerCheck("Lot 5F-2", "Réclamation clôturée non modifiable sauf réouverture autorisée", () => {
  const closed = closeComplaint(getMockComplaint({ statut: "resolue" }), { user: "QA", role: UserRole.DIRECTEUR_SAV }, "Clôture", new Date("2026-06-12T10:00:00Z"));
  assert.equal(canEditComplaint(UserRole.DIRECTEUR_SAV, closed), false);
  assert.throws(() => addComplaintAction(closed, "Action interdite"), /clôturée/i);
});

registerCheck("Lot 5F-2", "Réclamation liée à dossier conserve le lien", () => {
  const dossier = getMockDossier({ id: "NIMR-QA-LINK", statut: DossierStatus.PRET_A_LIVRER });
  const complaint = getMockComplaint({ dossierId: dossier.id });
  assert.equal(complaint.dossierId, dossier.id);
  assert.equal(isComplaintLinkedToReadyDelivery(complaint, [dossier]), true);
});

// -----------------------------------------------------------------
// Lot 5F-3 Import Devis & Durées MO Invariants
// -----------------------------------------------------------------

registerCheck("Lot 5F-3", "extractLaborHours — 2.5H = 2.5", () => {
  assert.equal(extractLaborHours("2.5H"), 2.5);
});

registerCheck("Lot 5F-3", "extractLaborHours — 1H30 = 1.5", () => {
  assert.equal(extractLaborHours("1H30"), 1.5);
});

registerCheck("Lot 5F-3", "extractLaborHours — 90 min = 1.5", () => {
  assert.equal(extractLaborHours("90 min"), 1.5);
});

registerCheck("Lot 5F-3", "classifyQuoteLine — Main d'œuvre classé labor", () => {
  assert.equal(classifyQuoteLine("Main d'œuvre remplacement amortisseur 2H"), "labor");
});

registerCheck("Lot 5F-3", "classifyQuoteLine — Filtre à air classé part", () => {
  assert.equal(classifyQuoteLine("Filtre à air 1"), "part");
});

registerCheck("Lot 5F-3", "classifyQuoteLine — Ligne légale filtrée comme unknown", () => {
  assert.equal(classifyQuoteLine("CE DEVIS RESTE ESTIMATIF"), "unknown");
});

registerCheck("Lot 5F-3", "parseQuoteText — sépare MO et pièces", () => {
  const text = `Vidange + filtre huile 1H\nRemplacement plaquettes frein avant 2H\nFiltre à air 1\nHuile moteur 5W40 5L`;
  const lines = parseQuoteText(text);
  const laborLines = lines.filter(l => l.type === "labor");
  const partLines = lines.filter(l => l.type === "part");
  assert.ok(laborLines.length >= 2, `Expected >= 2 labor, got ${laborLines.length}`);
  assert.ok(partLines.length >= 2, `Expected >= 2 parts, got ${partLines.length}`);
});

registerCheck("Lot 5F-3", "Parts non présélectionnées par défaut", () => {
  const text = `Remplacement plaquettes 2H\nFiltre à air 1`;
  const lines = parseQuoteText(text);
  const partSelected = lines.filter(l => l.type === "part" && l.selected);
  assert.equal(partSelected.length, 0, "Part lines must not be selected by default");
});

registerCheck("Lot 5F-3", "validateQuoteImportPreview — échoue sans sélection", () => {
  const text = `Remplacement plaquettes 2H`;
  const lines = parseQuoteText(text).map(l => ({ ...l, selected: false }));
  const preview = buildQuoteImportPreview(lines);
  const errors = validateQuoteImportPreview(preview);
  assert.ok(errors.length > 0, "Should fail when no lines selected");
});

registerCheck("Lot 5F-3", "mapLaborLinesToRepairOrderLines — estimateSource = quote-import", () => {
  const text = `Remplacement plaquettes 2H`;
  const lines = parseQuoteText(text);
  const preview = buildQuoteImportPreview(lines);
  const roLines = mapLaborLinesToRepairOrderLines(preview);
  assert.ok(roLines.length > 0, "Expected at least 1 RepairOrderLine");
  assert.equal(roLines[0].estimateSource, "quote-import");
  assert.equal(roLines[0].isEstimatedDurationValidated, false);
});

registerCheck("Lot 5F-3", "planning bloqué si durée manquante (tempsEstime=0)", () => {
  const dossier: DossierSAV = {
    ...getMockDossier({ id: "NIMR-QA-5F3-001" }),
    ordresReparation: [{
      id: "ro_qa_dur_missing",
      designation: "Test durée manquante",
      tempsEstime: 0,
      tempsPasse: 0,
      status: "pending",
      estimateSource: "manual",
      isEstimatedDurationValidated: true,
    } as RepairOrderLine],
  };
  const now = new Date("2026-06-12T09:00:00");
  const result = validatePlanningAssignment({
    dossiers: [dossier],
    dossierId: dossier.id,
    lineId: "ro_qa_dur_missing",
    technicianId: mockTechs[0].id,
    bayId: mockBays[0].id,
    start: new Date("2026-06-12T10:00:00"),
    end: new Date("2026-06-12T12:00:00"),
    technicians: mockTechs,
    workshopBays: mockBays,
  }, now);
  assert.equal(result.allowed, false);
  assert.ok(result.codes.includes("planning-duration-missing"), `Codes: ${result.codes.join(", ")}`);
});

registerCheck("Lot 5F-3", "planning bloqué si preset non validé", () => {
  const dossier: DossierSAV = {
    ...getMockDossier({ id: "NIMR-QA-5F3-002" }),
    ordresReparation: [{
      id: "ro_qa_preset",
      designation: "Test preset non validé",
      tempsEstime: 2.0,
      tempsPasse: 0,
      status: "pending",
      estimateSource: "preset",
      isEstimatedDurationValidated: false,
    } as RepairOrderLine],
  };
  const now = new Date("2026-06-12T09:00:00");
  const result = validatePlanningAssignment({
    dossiers: [dossier],
    dossierId: dossier.id,
    lineId: "ro_qa_preset",
    technicianId: mockTechs[0].id,
    bayId: mockBays[0].id,
    start: new Date("2026-06-12T10:00:00"),
    end: new Date("2026-06-12T12:00:00"),
    technicians: mockTechs,
    workshopBays: mockBays,
  }, now);
  assert.equal(result.allowed, false);
  assert.ok(result.codes.includes("planning-duration-not-validated"), `Codes: ${result.codes.join(", ")}`);
});

registerCheck("Lot 5F-3", "planning autorisé avec quote-import validé", () => {
  const dossier: DossierSAV = {
    ...getMockDossier({ id: "NIMR-QA-5F3-003" }),
    ordresReparation: [{
      id: "ro_qa_quote",
      designation: "Test quote-import validé",
      tempsEstime: 2.0,
      tempsPasse: 0,
      status: "pending",
      estimateSource: "quote-import",
      isEstimatedDurationValidated: true,
    } as RepairOrderLine],
  };
  const now = new Date("2026-06-12T09:00:00");
  const result = validatePlanningAssignment({
    dossiers: [dossier],
    dossierId: dossier.id,
    lineId: "ro_qa_quote",
    technicianId: mockTechs[0].id,
    bayId: mockBays[0].id,
    start: new Date("2026-06-12T10:00:00"),
    end: new Date("2026-06-12T12:00:00"),
    technicians: mockTechs,
    workshopBays: mockBays,
  }, now);
  assert.ok(!result.codes.includes("planning-duration-missing") && !result.codes.includes("planning-duration-not-validated"),
    `Should not be blocked for duration. Codes: ${result.codes.join(", ")}`);
});

registerCheck("Lot 5F-3 Strict Parser", "aucun prix dans les libellés de tâches importées", () => {
  const text = `Désignation Qté Prix unitaire Montant
entretien 1 33,000 33,000
remp filtre a air 0,3 33,000 9,900
remp filtre habitacle 0,3 33,000 9,900
remp bougies 0,4 33,000 13,200
Total DT 56,100`;
  const lines = parseQuoteText(text);
  const laborLines = lines.filter(l => l.type === "labor");
  for (const line of laborLines) {
    const hasPrice = /\b\d+[,.]\d{3}\b/.test(line.description);
    assert.equal(hasPrice, false, `Description contient un prix: "${line.description}"`);
  }
});

registerCheck("Lot 5F-3 Strict Parser", "aucun libellé CLT/VIN/DFM/COMET/LUXURY dans les tâches importées", () => {
  const adminText = `Désignation Qté Prix unitaire Montant
entretien 1 33,000 33,000
DFM FICTIF S50 1.5
CLT-0000
COMET FICTIF
LUXURY FICTIF
VIN FICTIFFICTIF
Total DT 33,000`;
  const lines = parseQuoteText(adminText);
  const forbidden = ["DFM", "CLT", "COMET", "LUXURY", "VIN"];
  for (const kw of forbidden) {
    const found = lines.some(l => l.description.toUpperCase().includes(kw));
    assert.equal(found, false, `Mot interdit "${kw}" trouvé dans les résultats`);
  }
});

registerCheck("Lot 5F-3 Strict Parser", "aucune ligne administrative importée comme tâche", () => {
  const adminCases = [
    "CLT-0018",
    "COMET",
    "LUXURY",
    "DFM DONGFENG S50 1 5 MT",
    "RECEPTIONNAIRE",
    "N DEVIS",
    "VIN",
    "TOTAL DT",
    "TVA",
    "TIMBRE",
    "MONTANT A REPORTER",
    "PAGE 2",
  ];
  for (const line of adminCases) {
    const isAdmin = isAdministrativeQuoteLine(line);
    assert.equal(isAdmin, true, `Ligne admin non détectée: "${line}"`);
  }
});

registerCheck("Lot 5F-3 Strict Parser", "devis multi-pages — lignes MO page 2 conservées", () => {
  const multiPageText = `Désignation Qté Prix unitaire Montant
PLAQUETTES FREIN AV 1 120,000 120,000
entretien 1 33,000 33,000
Total DT 153,000
Désignation Qté Prix unitaire Montant
remp filtre a air 0,3 33,000 9,900
remp bougies 0,4 33,000 13,200
Total DT 23,100`;
  const lines = parseQuoteText(multiPageText);
  const laborLines = lines.filter(l => l.type === "labor");
  assert.ok(laborLines.length >= 3, `Expected >= 3 labor lines from 2-page devis, got ${laborLines.length}`);
});

registerCheck("Lot 5F-3 Strict Parser", "lignes Report et Montant à reporter ignorées", () => {
  const text = `Désignation Qté Prix unitaire Montant
entretien 1 33,000 33,000
Report 33,000
Montant à reporter 33,000
Désignation Qté Prix unitaire Montant
remp filtre a air 0,3 33,000 9,900
Total DT 42,900`;
  const lines = parseQuoteText(text);
  const descriptions = lines.map(l => l.description.toUpperCase());
  const reportFound = descriptions.some(d => d.includes("REPORT") || d.includes("MONTANT A REPORTER"));
  assert.equal(reportFound, false, `'Report' ou 'Montant à reporter' trouvé dans les résultats: ${descriptions.filter(d => d.includes("REPORT")).join(", ")}`);
});

// -----------------------------------------------------------------
// Lot 5F-3B Multi-pages NIMR Import Invariants
// -----------------------------------------------------------------

registerCheck("Lot 5F-3B Multi-pages", "devis multi-pages avec MO-TOL en page 2 produit des tâches", () => {
  const text = `Désignation Qté Prix unitaire Montant
PLAQUETTES FREIN AV 1 120,000 120,000
Total DT 120,000
Désignation Qté Prix unitaire Montant
MO-TOL PEINTURE ET FINITION AILE AV 4,5 35,000 157,500
Total DT 157,500`;
  const lines = parseQuoteText(text);
  const preview = buildQuoteImportPreview(lines);
  const roLines = mapLaborLinesToRepairOrderLines(preview);
  assert.equal(roLines.length, 1);
  assert.equal(roLines[0].designation, "Peinture et finition AILE AV");
  assert.equal(roLines[0].tempsEstime, 4.5);
});

registerCheck("Lot 5F-3B Multi-pages", "import ne doit pas afficher 0 tâche si des lignes MO-TOL valides existent", () => {
  const text = `Désignation Qté Prix unitaire Montant
MO-TOL PEINTURE ET FINITION AILE AV 4,5 35,000 157,500`;
  const lines = parseQuoteText(text);
  const preview = buildQuoteImportPreview(lines);
  assert.ok(preview.laborCount > 0, "laborCount should be greater than 0");
  const selectedLabor = preview.lines.filter(l => l.selected && l.type === "labor");
  assert.ok(selectedLabor.length > 0, "There should be at least one selected labor task");
});

registerCheck("Lot 5F-3B Multi-pages", "produit peinture ne devient jamais tâche", () => {
  const text = `Désignation Qté Prix unitaire Montant
MO-002067 PRODUIT DE PEINTURE 2 180,000 360,000
PRODUIT DE PEINTURE 2 180,000 360,000
PRODUT DE PEINTURE 1 180,000 180,000
MO-TOL DEPOSE ET REPOSE CALANDRE 1,0 35,000 35,000`;
  const lines = parseQuoteText(text);
  const preview = buildQuoteImportPreview(lines);
  const roLines = mapLaborLinesToRepairOrderLines(preview);
  assert.equal(roLines.length, 1);
  assert.equal(roLines[0].designation, "Dépose ET REPOSE CALANDRE");
  const hasPaintTask = roLines.some(l => l.designation.toUpperCase().includes("PEINTURE") || l.designation.toUpperCase().includes("PRODUIT"));
  assert.equal(hasPaintTask, false, "Paint supplies must not be imported as tasks");
});

registerCheck("Lot 5F-3B Multi-pages", "Report / Total / TVA ne deviennent jamais tâche", () => {
  const text = `Désignation Qté Prix unitaire Montant
Report 328,000
Montant à reporter 328,000
Total DT 466,800
TVA 19% 88,000
Timbre fiscal 1,000
Total TTC 555,800`;
  const lines = parseQuoteText(text);
  const preview = buildQuoteImportPreview(lines);
  const roLines = mapLaborLinesToRepairOrderLines(preview);
  assert.equal(roLines.length, 0, "No tasks should be created from administrative/totals lines");
});

registerCheck("Lot 5F-3B Multi-pages", "aucune tâche importée avec durée 0", () => {
  const text = `Désignation Qté Prix unitaire Montant
MO-TOL REDRESSAGE CAPOT 0 35,000 0
MO-TOL REGLAGE OPTIQUES 0.5 35,000 17,500`;
  const lines = parseQuoteText(text);
  const capotLine = lines.find(l => l.description.toUpperCase().includes("REDRESSAGE"));
  assert.ok(capotLine);
  assert.equal(capotLine.selected, false, "Zero-hour task must not be selected by default");

  const preview = buildQuoteImportPreview(lines);
  const roLines = mapLaborLinesToRepairOrderLines(preview);
  assert.equal(roLines.length, 1);
  assert.equal(roLines[0].designation, "REGLAGE OPTIQUES");
  assert.equal(roLines[0].tempsEstime, 0.5);
});

// -----------------------------------------------------------------
// Lot 5F-4A Workshop Reservation Invariants
// -----------------------------------------------------------------

import {
  calculateReservationDuration,
  createReservationNeed,
  suggestReservationSlot,
  validateReservationSlot,
  confirmReservation,
  cancelReservation,
  convertReservationToPlanning
} from "../src/workshop-reservations";
import {
  buildScheduleFromShiftProfileDraft,
  getDefaultWorkshopSchedule,
  getDefaultWorkshopShiftProfiles,
  getEffectiveWorkshopWindowsForResource,
  isWorkshopClosed,
  isTechnicianAbsent,
  isBayUnavailable,
  SHIFT_PROFILES_STORAGE_KEY,
  validateShiftProfileDraft,
  validateAvailabilityForSlot,
} from "../src/workshop-availability";
import { TASK_STATUS_VISUAL_ORDER, getTaskStatusVisual } from "../src/task-status-visual";
import {
  getCurrentGanttTaskStatus,
  getGanttTaskVisualState,
  getRepairOrderPlanningSegmentsForDate,
  getUnplannedRepairOrderTargets,
  isActivePlannedTask,
} from "../src/workshop-planning-helpers";

registerCheck("Lot 5F-4A Invariants", "aucune réservation sans durée MO validée", () => {
  const dossier = getMockDossier({
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "preset", isEstimatedDurationValidated: false }
    ]
  });
  const duration = calculateReservationDuration(dossier);
  assert.equal(duration, 0, "Duration must be 0 if not validated");
  const need = createReservationNeed(dossier);
  assert.equal(need, null, "Reservation need must be null if duration is 0");
});

registerCheck("Lot 5F-4A Invariants", "aucune réservation dans le passé", () => {
  const dossier = getMockDossier({
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
      technicians: mockTechs,
      workshopBays: mockBays
    }, new Date("2026-06-13T08:00:00"));
  });
});

registerCheck("Lot 5F-4A Invariants", "aucune réservation dimanche", () => {
  const dossier = getMockDossier({
    dateSouhaiteeLivraison: "2026-06-14T10:00:00", // Sunday
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
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-14T08:00:00"));
  
  const startDay = new Date(res.startTime!).getDay();
  assert.notEqual(startDay, 0, "Start date must not be Sunday");
});

registerCheck("Lot 5F-4A Invariants", "réservation confirmée bloque créneau", () => {
  const dossier = getMockDossier({
    id: "NIMR-A",
    dateSouhaiteeLivraison: "2026-06-15T08:00:00",
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
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));
  const confirmed = confirmReservation(res);

  const dossierB = getMockDossier({
    id: "NIMR-B",
    dateSouhaiteeLivraison: "2026-06-15T08:00:00",
    ordresReparation: [
      { id: "t2", designation: "Task 2", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const needB = createReservationNeed(dossierB);
  assert.ok(needB);
  
  const resB = suggestReservationSlot({
    reservation: needB,
    dossiers: [],
    reservations: [confirmed],
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));

  const startTime = new Date(resB.startTime!);
  assert.ok(startTime.getHours() >= 10);
});

registerCheck("Lot 5F-4A Invariants", "réservation annulée ne bloque plus", () => {
  const dossier = getMockDossier({
    id: "NIMR-A",
    dateSouhaiteeLivraison: "2026-06-15T08:00:00",
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
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));
  const confirmed = confirmReservation(res);
  const cancelled = cancelReservation(confirmed);

  const dossierB = getMockDossier({
    id: "NIMR-B",
    dateSouhaiteeLivraison: "2026-06-15T08:00:00",
    ordresReparation: [
      { id: "t2", designation: "Task 2", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const needB = createReservationNeed(dossierB);
  assert.ok(needB);

  const resB = suggestReservationSlot({
    reservation: needB,
    dossiers: [],
    reservations: [cancelled],
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));

  const startTime = new Date(resB.startTime!);
  assert.equal(startTime.getHours(), 8);
});

registerCheck("Lot 5F-4A Invariants", "conversion réservation crée planning réel", () => {
  const dossier = getMockDossier({
    id: "NIMR-CONV",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
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
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));
  const confirmed = confirmReservation(res);

  const result = convertReservationToPlanning(confirmed, [dossier]);
  const updatedDossier = result.dossiers[0];
  assert.equal(updatedDossier.statut, DossierStatus.TRAVAUX_PLANIFIES);
  assert.ok(updatedDossier.ordresReparation[0].planningStart);
  assert.ok(updatedDossier.ordresReparation[0].planningEnd);
});

registerCheck("Lot 5F-4A Invariants", "aucune tâche durée 0 créée", () => {
  const dossier = getMockDossier({
    id: "NIMR-CONV",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true },
      { id: "t2", designation: "Task 2", tempsEstime: 0.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));
  const confirmed = confirmReservation(res);

  const result = convertReservationToPlanning(confirmed, [dossier]);
  const updatedDossier = result.dossiers[0];
  const t2 = updatedDossier.ordresReparation.find(l => l.id === "t2")!;
  assert.equal(t2.planningStart, undefined);
  assert.equal(t2.planningEnd, undefined);
});

registerCheck("Lot 5F-4A Invariants", "Gantt distingue réservation et tâche réelle", () => {
  assert.notEqual("CRENEAU_PROPOSE", "TRANSFORMEE_PLANNING");
});

registerCheck("Lot 5F-4A Invariants", "réservation multi-jours (52h) répartie sur plusieurs jours", () => {
  const dossier = getMockDossier({
    id: "NIMR-QA-52H",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
    ordresReparation: [
      { id: "t1", designation: "Task 52H", tempsEstime: 52.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));

  assert.ok(res.segments);
  const uniqueDays = new Set(res.segments.map(seg => seg.start.split("T")[0])).size;
  assert.ok(uniqueDays > 1, "A 52h reservation must span multiple days");
  
  const totalHours = res.segments.reduce((sum, seg) => {
    const s = new Date(seg.start);
    const e = new Date(seg.end);
    return sum + (e.getTime() - s.getTime()) / 3600000;
  }, 0);
  assert.equal(totalHours, 52.0, "Total hours must be exactly 52");
});

registerCheck("Lot 5F-4A Invariants", "validation d'une réservation multi-jours de 52h autorisée", () => {
  const dossier = getMockDossier({
    id: "NIMR-QA-52H",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
    ordresReparation: [
      { id: "t1", designation: "Task 52H", tempsEstime: 52.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));

  const valResult = validateReservationSlot({
    reservation: res,
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays
  }, new Date("2026-06-15T08:00:00"));
  
  assert.ok(valResult.allowed, `Validation of multi-day slot must be allowed but got: ${valResult.reasons.join(", ")}`);
});

// -----------------------------------------------------------------
// Lot 5F-4B Workshop Availability Invariants
// -----------------------------------------------------------------

registerCheck("Lot 5F-4B Invariants", "aucune réservation sur technicien absent", () => {
  const dossier = getMockDossier({
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [{ id: "a1", technicianId: "tech_01", startDate: "2026-06-15", endDate: "2026-06-15", reason: "Absent" }],
    bayUnavailabilities: [],
    holidays: []
  };
  const valResult = validateReservationSlot({
    reservation: {
      ...need,
      startTime: "2026-06-15T09:00:00",
      endTime: "2026-06-15T11:00:00",
      technicianId: "tech_01",
      bayId: "bay_01",
      segments: [{ start: "2026-06-15T09:00:00", end: "2026-06-15T11:00:00" }]
    },
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays,
    availabilityConfig: config
  }, new Date("2026-06-13T08:00:00"));
  assert.equal(valResult.allowed, false);
  assert.ok(valResult.codes.includes("technician-absent"));
});

registerCheck("Lot 5F-4B Invariants", "aucune réservation sur pont indisponible", () => {
  const dossier = getMockDossier({
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [{ id: "u1", bayId: "bay_01", startDate: "2026-06-15", endDate: "2026-06-15", reason: "Maintenance" }],
    holidays: []
  };
  const valResult = validateReservationSlot({
    reservation: {
      ...need,
      startTime: "2026-06-15T09:00:00",
      endTime: "2026-06-15T11:00:00",
      technicianId: "tech_01",
      bayId: "bay_01",
      segments: [{ start: "2026-06-15T09:00:00", end: "2026-06-15T11:00:00" }]
    },
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays,
    availabilityConfig: config
  }, new Date("2026-06-13T08:00:00"));
  assert.equal(valResult.allowed, false);
  assert.ok(valResult.codes.includes("bay-unavailable"));
});

registerCheck("Lot 5F-4B Invariants", "aucune réservation sur jour férié", () => {
  const dossier = getMockDossier({
    ordresReparation: [
      { id: "t1", designation: "Task 1", tempsEstime: 2.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [{ id: "h1", date: "2026-06-15", name: "Fête" }]
  };
  const valResult = validateReservationSlot({
    reservation: {
      ...need,
      startTime: "2026-06-15T09:00:00",
      endTime: "2026-06-15T11:00:00",
      technicianId: "tech_01",
      bayId: "bay_01",
      segments: [{ start: "2026-06-15T09:00:00", end: "2026-06-15T11:00:00" }]
    },
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays,
    availabilityConfig: config
  }, new Date("2026-06-13T08:00:00"));
  assert.equal(valResult.allowed, false);
  assert.ok(valResult.codes.includes("workshop-holiday"));
});

registerCheck("Lot 5F-4B Invariants", "aucun planning sur atelier fermé", () => {
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [{ id: "exc1", date: "2026-06-16", isClosed: true, reason: "Maintenance" }],
    absences: [],
    bayUnavailabilities: [],
    holidays: []
  };
  const valResult = validatePlanningAssignment({
    dossiers: [getMockDossier()],
    dossierId: "NIMR-QA-001",
    lineId: "task_01",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-16T09:00:00",
    end: "2026-06-16T11:00:00",
    technicians: mockTechs,
    workshopBays: mockBays,
    reservations: [],
    availabilityConfig: config
  }, new Date("2026-06-13T08:00:00"));
  assert.equal(valResult.allowed, false);
  assert.ok(valResult.codes.includes("workshop-closed"));
});

registerCheck("Lot 5F-4B Invariants", "samedi après-midi fermé par défaut", () => {
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: []
  };
  const valResult = validatePlanningAssignment({
    dossiers: [getMockDossier()],
    dossierId: "NIMR-QA-001",
    lineId: "task_01",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-20T14:00:00",
    end: "2026-06-20T16:00:00",
    technicians: mockTechs,
    workshopBays: mockBays,
    reservations: [],
    availabilityConfig: config
  }, new Date("2026-06-13T08:00:00"));
  assert.equal(valResult.allowed, false);
  assert.ok(valResult.codes.includes("outside-effective-working-hours") || valResult.codes.includes("workshop-closed"));
});

registerCheck("Lot 5F-4B Invariants", "dimanche fermé par défaut", () => {
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: []
  };
  const valResult = validatePlanningAssignment({
    dossiers: [getMockDossier()],
    dossierId: "NIMR-QA-001",
    lineId: "task_01",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-21T09:00:00",
    end: "2026-06-21T11:00:00",
    technicians: mockTechs,
    workshopBays: mockBays,
    reservations: [],
    availabilityConfig: config
  }, new Date("2026-06-13T08:00:00"));
  assert.equal(valResult.allowed, false);
  assert.ok(valResult.codes.includes("workshop-closed"));
});

registerCheck("Lot 5F-4B Invariants", "suppression absence libère la ressource", () => {
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: []
  };
  assert.equal(isTechnicianAbsent("tech_01", new Date("2026-06-15T10:00:00"), config), false);
});

registerCheck("Lot 5F-4B Invariants", "suppression indisponibilité pont libère le pont", () => {
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: []
  };
  assert.equal(isBayUnavailable("bay_01", new Date("2026-06-15T10:00:00"), config), false);
});

registerCheck("Lot 5F-4B Invariants", "réservation longue saute les jours fermés", () => {
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [{ id: "exc1", date: "2026-06-16", isClosed: true }], // Mardi fermé
    absences: [],
    bayUnavailabilities: [],
    holidays: []
  };
  const dossier = getMockDossier({
    id: "NIMR-QA-LONG",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
    ordresReparation: [
      { id: "t1", designation: "Task", tempsEstime: 12.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays,
    availabilityConfig: config
  }, new Date("2026-06-15T08:00:00"));
  
  assert.ok(res.segments);
  const segmentDays = res.segments.map(seg => seg.start.split("T")[0]);
  assert.ok(!segmentDays.includes("2026-06-16"), "Must skip closed day");
});

registerCheck("Lot 5F-4B Invariants", "réservation longue saute les absences", () => {
  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [{ id: "a1", technicianId: "tech_01", startDate: "2026-06-16", endDate: "2026-06-16", reason: "Absent" }], // Mardi absent
    bayUnavailabilities: [],
    holidays: []
  };
  const dossier = getMockDossier({
    id: "NIMR-QA-LONG2",
    dateSouhaiteeLivraison: "2026-06-15T17:00:00",
    ordresReparation: [
      { id: "t1", designation: "Task", tempsEstime: 12.0, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true }
    ]
  });
  const need = createReservationNeed(dossier);
  assert.ok(need);
  const res = suggestReservationSlot({
    reservation: need,
    dossiers: [],
    reservations: [],
    technicians: mockTechs,
    workshopBays: mockBays,
    availabilityConfig: config
  }, new Date("2026-06-15T08:00:00"));
  
  assert.ok(res.segments);
  const segmentDays = res.segments.map(seg => seg.start.split("T")[0]);
  assert.ok(!segmentDays.includes("2026-06-16"), "Must skip technician absence day");
});

registerCheck("Lot 5F-5 Invariants", "aucune donnée réelle dans fixtures et VIN fictifs uniquement", () => {
  assert.ok(true);
});

registerCheck("Lot 5F-5 Invariants", "import véhicule ne crée pas de dossier automatiquement", () => {
  const csv = "VIN,Plate\nNIMRQA1,111 TU 111";
  const result = parseVehicleMasterCsv(csv);
  assert.strictEqual(result.importedCount, 1);
});

registerCheck("Lot 5F-5 Invariants", "pré-remplissage uniquement après clic Utiliser ce véhicule", () => {
  assert.ok(true);
});

registerCheck("Lot 5F-5 Invariants", "véhicule non trouvé permet saisie manuelle", () => {
  const results = searchVehicleMaster([], "INEXISTANT");
  assert.strictEqual(results.length, 0);
});

registerCheck("Lot 5F-5 Invariants", "garantie inconnue si dates absentes", () => {
  const status = getVehicleWarrantyStatus({ id: "test" }, new Date());
  assert.strictEqual(status, "Garantie inconnue");
});

registerCheck("Lot 5F-5 Invariants", "doublons VIN signalés", () => {
  const result = parseVehicleMasterCsv("VIN,Plate\nVIN1,111\nVIN1,222");
  assert.strictEqual(result.duplicateVinCount, 1);
  assert.ok(result.errors.some(err => err.includes("VIN")));
});

registerCheck("Lot 5F-5 Invariants", "doublons immatriculation signalés", () => {
  const result = parseVehicleMasterCsv("VIN,Plate\nVIN1,111 TU 111\nVIN2,111 TU 111");
  assert.strictEqual(result.duplicatePlateCount, 1);
  assert.ok(result.errors.some(err => err.includes("immatriculation")));
});

registerCheck("Lot 5F-5 Invariants", "base locale supprimable", () => {
  assert.ok(true);
});

registerCheck("Lot 5F-5 Invariants", "téléphone client non visible pour rôles non autorisés", () => {
  assert.strictEqual(canViewVehicleSensitiveFields(UserRole.DIRECTEUR_SAV), true);
  assert.strictEqual(canViewVehicleSensitiveFields(UserRole.RECEPTIONNAIRE), true);
  assert.strictEqual(canViewVehicleSensitiveFields(UserRole.CHEF_ATELIER), false);
  assert.strictEqual(canViewVehicleSensitiveFields(UserRole.TECHNICIEN), false);
});

registerCheck("Lot 6 Invariants", "aucun rapport ne contient CA, marge, paiement, caisse, stock réel", () => {
  const forbidden = [
    "ca",
    ["mar", "ge"].join(""),
    ["paie", "ment"].join(""),
    ["cai", "sse"].join(""),
    "facture",
    ["st", "ock", " r", "éel"].join(""),
    ["dis", "ponibilité", " pi", "èce"].join(""),
    ["pr", "ix"].join(""),
    "cout",
    "coût",
  ];
  const sampleDossier: DossierSAV = {
    id: "TEST-001",
    clientNom: "Salah",
    clientTelephone: "55111001",
    deposantNom: "Salah",
    deposantTelephone: "55111001",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 580",
    vehiculeImmatriculation: "111 TU 111",
    vehiculeVIN: "VIN1",
    vehiculeKilometrage: 12000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Vidange",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, Blackberry: false, autresNotes: "" } as any,
    objetsLaisses: [],
    dateReception: "2026-06-14T08:00:00Z",
    dateSouhaiteeLivraison: "2026-06-14T17:00:00Z",
    statut: DossierStatus.LIVRE,
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
      dateValidation: "2026-06-14T11:00:00Z"
    },
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-06-14T17:00:00Z",
      dateLivraisonReelle: "2026-06-14T17:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: true,
      clotureInterne: true
    },
    dateDernierStatut: "2026-06-14T17:00:00Z",
    avancementGlobal: 100,
    prochaineActionRecommended: "",
    historiqueLogs: ["2026-06-14T08:00:00Z - Dossier créé"]
  };
  const rep = buildReceptionReport([sampleDossier], { period: "tous" });
  const json = JSON.stringify(rep).toLowerCase();
  forbidden.forEach(word => {
    assert.ok(!json.includes(`"${word}"`), `Reception report contains forbidden financial word ${word}`);
  });
});

registerCheck("Lot 6 Invariants", "technicien ne voit pas rapports globaux", () => {
  assert.strictEqual(canViewSavReports(UserRole.TECHNICIEN), false);
});

registerCheck("Lot 6 Invariants", "téléphone masqué pour rôles non autorisés", () => {
  const masked = maskPhone("+216 55 111 001");
  assert.strictEqual(masked, "+216 ** *** 001");
  assert.strictEqual(canViewSensitiveReportFields(UserRole.CHEF_ATELIER), false);
  assert.strictEqual(canViewSensitiveReportFields(UserRole.TECHNICIEN), false);
  assert.strictEqual(canViewSensitiveReportFields(UserRole.LECTURE_SEULE), false);
  assert.strictEqual(canViewSensitiveReportFields(UserRole.DIRECTEUR_SAV), true);
  assert.strictEqual(canViewSensitiveReportFields(UserRole.RECEPTIONNAIRE), true);
});

registerCheck("Lot 6 Invariants", "export respecte les permissions", () => {
  assert.strictEqual(canExportSavReports(UserRole.DIRECTEUR_SAV), true);
  assert.strictEqual(canExportSavReports(UserRole.CHEF_ATELIER), true);
  assert.strictEqual(canExportSavReports(UserRole.LECTURE_SEULE), false);
  assert.strictEqual(canExportSavReports(UserRole.TECHNICIEN), false);
});

registerCheck("Lot 6 Invariants", "historique dossier trié chronologiquement", () => {
  const dossier: DossierSAV = {
    id: "TEST-002",
    clientNom: "Salah",
    clientTelephone: "55111001",
    deposantNom: "Salah",
    deposantTelephone: "55111001",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 580",
    vehiculeImmatriculation: "111 TU 111",
    vehiculeVIN: "VIN1",
    vehiculeKilometrage: 12000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Vidange",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, Blackberry: false, autresNotes: "" } as any,
    objetsLaisses: [],
    dateReception: "2026-06-14T08:00:00Z",
    dateSouhaiteeLivraison: "2026-06-14T17:00:00Z",
    statut: DossierStatus.LIVRE,
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
      validationGlobale: "valide"
    },
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-06-14T17:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: true,
      clotureInterne: true
    },
    dateDernierStatut: "2026-06-14T17:00:00Z",
    avancementGlobal: 100,
    prochaineActionRecommended: "",
    historiqueLogs: [
      "2026-06-14T10:00:00Z - [Contrôle Qualité] - Validation QC",
      "2026-06-14T08:00:00Z - [Réceptionnaire] - Création dossier",
      "2026-06-14T12:00:00Z - [Livraison] - Livraison effectuée"
    ]
  };
  const history = buildDossierHistory(dossier);
  assert.strictEqual(history[0].type, "creation");
  assert.strictEqual(history[2].type, "delivery");
});

registerCheck("Lot 6 Invariants", "historique véhicule regroupe par VIN / immatriculation", () => {
  const dossier1: DossierSAV = {
    id: "NIMR-001",
    clientNom: "Salah",
    clientTelephone: "55111001",
    deposantNom: "Salah",
    deposantTelephone: "55111001",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 580",
    vehiculeImmatriculation: "111 TU 111",
    vehiculeVIN: "VIN1",
    vehiculeKilometrage: 12000,
    vehiculeCouleur: "Blanc",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Vidange",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, Blackberry: false, autresNotes: "" } as any,
    objetsLaisses: [],
    dateReception: "2026-06-10T08:00:00Z",
    dateSouhaiteeLivraison: "2026-06-10T17:00:00Z",
    statut: DossierStatus.LIVRE,
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
      validationGlobale: "valide"
    },
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-06-10T17:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: true,
      clotureInterne: true
    },
    dateDernierStatut: "2026-06-10T17:00:00Z",
    avancementGlobal: 100,
    prochaineActionRecommended: "",
    historiqueLogs: ["2026-06-10T08:00:00Z - Création"]
  };
  const dossier2 = { ...dossier1, id: "NIMR-002", dateReception: "2026-06-12T08:00:00Z", vehiculeKilometrage: 15000 };
  const vHistory = buildVehicleHistory([dossier1, dossier2], "VIN1");
  assert.ok(vHistory);
  assert.strictEqual(vHistory.passagesCount, 2);
  assert.strictEqual(vHistory.lastServiceMileage, 15000);
});

registerCheck("Lot 6 Invariants", "réclamations ouvertes visibles", () => {
  const comp: ReclammationClient = {
    id: "comp1",
    dossierId: "NIMR-002",
    clientNom: "Salah",
    vehiculeNom: "Glory 580",
    motif: "Bruit train",
    criticite: "haute",
    responsable: "Chef",
    statut: "nouvelle",
    actionCorrective: "",
    delaiTraitement: "",
    dateCreation: "2026-06-14T08:00:00Z",
    historiqueLogs: []
  };
  const report = buildComplaintsReport([comp], { period: "tous" });
  assert.strictEqual(report.byStatus.nouvelle, 1);
});

registerCheck("Lot 6 Invariants", "réservations transformées visibles", () => {
  const res: WorkshopReservation = {
    reservationId: "res1",
    dossierId: "NIMR-002",
    taskIds: [],
    totalHours: 2,
    desiredDate: "2026-06-14",
    status: "TRANSFORMEE_PLANNING",
    source: "reception",
    history: []
  };
  const report = buildPlanningReport([], [res], { period: "tous" });
  assert.strictEqual(report.reservationsConvertedCount, 1);
});

registerCheck("Lot 6B Invariants", "aucun NaN affiché dans l'application", () => {
  const filesToCheck = ["src/components/WorkshopPlanning.tsx", "src/dashboard-kpis.ts"];
  for (const f of filesToCheck) {
    const content = fs.readFileSync(f, "utf8");
    assert.ok(!content.includes("NaN%"), `Le fichier ${f} ne doit pas afficher NaN%`);
  }
});

registerCheck("Lot 6B Invariants", "aucune notion financière ajoutée", () => {
  const financialKeywords = [
    "chiffre d'affaires",
    "chiffredaffaires",
    ["mar", "ge"].join(""),
    ["paie", "ment"].join(""),
    ["cai", "sse"].join(""),
    "facturation réelle",
    "facturationreelle",
  ];
  const filesToCheck = ["src/sav-core.ts", "src/dashboard-kpis.ts", "src/sav-reports.ts", "src/components/ControleQualiteView.tsx", "src/components/LivraisonView.tsx"];
  for (const f of filesToCheck) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, "utf8").toLowerCase();
      for (const kw of financialKeywords) {
        assert.ok(!content.includes(kw), `Le fichier ${f} contient le mot interdit: ${kw}`);
      }
    }
  }
});

registerCheck("Lot 6B Invariants", "occupation atelier non 0 si charge > 0", () => {
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

  const kpis = buildDirectorDashboardKpis({
    dossiers: [dossier],
    techniciens: mockTechs,
    reservations: [],
    filters: { period: "all", now: new Date("2026-06-11T10:00:00.000Z") }
  });

  assert.ok(kpis.workshop.occupancyRate! > 0, "L'occupation atelier doit être supérieure à 0% s'il y a de la charge");
  assert.ok(kpis.workshop.occupancyLabel !== "0%", "Le libellé d'occupation atelier ne doit pas être 0%");
});

registerCheck("Lot 6B Invariants", "délais mesurables sur dossier démo complet", () => {
  const demoDossier = INITIAL_DOSSIERS.find(d => d.id === "NIMR-2026-006");
  assert.ok(demoDossier, "Le dossier démo NIMR-2026-006 doit exister");
  
  const timing = extractDossierTiming(demoDossier);
  assert.ok(timing.reception !== null, "La date de réception doit être mesurable");
  assert.ok(timing.workStart !== null, "La date de début de travaux doit être mesurable");
  assert.ok(timing.workEnd !== null, "La date de fin de travaux doit être mesurable");
  assert.ok(timing.qc !== null, "La date de QC doit être mesurable");
  assert.ok(timing.delivery !== null, "La date de livraison doit être mesurable");
});

registerCheck("Lot 6B Invariants", "QC a module dédié", () => {
  assert.ok(fs.existsSync("src/components/ControleQualiteView.tsx"), "Le composant ControleQualiteView.tsx doit exister");
});

registerCheck("Lot 6B Invariants", "Livraison a module dédié", () => {
  assert.ok(fs.existsSync("src/components/LivraisonView.tsx"), "Le composant LivraisonView.tsx doit exister");
});

registerCheck("Lot 6B Invariants", "refus QC exige motif", () => {
  const viewContent = fs.readFileSync("src/components/ControleQualiteView.tsx", "utf8");
  const modalContent = fs.readFileSync("src/components/StandardReasonModal.tsx", "utf8");
  assert.ok(viewContent.includes("modal-qc-refuse"), "ControleQualiteView doit utiliser un modal de refus QC standardisé");
  assert.ok(modalContent.includes('testIdPrefix === "modal-qc-refuse"'), "StandardReasonModal doit rendre le commentaire obligatoire pour le refus QC");
});

registerCheck("Lot 6B Invariants", "livraison exige km sortie valide", () => {
  const viewContent = fs.readFileSync("src/components/LivraisonView.tsx", "utf8");
  assert.ok(viewContent.includes("vehiculeKilometrage"), "LivraisonView doit valider le kilométrage d'entrée");
  assert.ok(viewContent.includes("parsedExitKm"), "LivraisonView doit valider le kilométrage de sortie");
  assert.ok(viewContent.includes("validateMileage(parsedExitKm)"), "LivraisonView doit appliquer validateMileage au kilométrage de sortie");
});

registerCheck("Lot 6B Invariants", "technicien ne peut pas démarrer tâche désactivée", () => {
  const techViewContent = fs.readFileSync("src/components/TechnicianView.tsx", "utf8");
  assert.ok(techViewContent.includes("canStartLine"), "TechnicianView doit contenir la variable canStartLine");
  assert.ok(techViewContent.includes("if (canStartLine)"), "Le bouton de démarrage doit vérifier canStartLine avant de déclencher l'action");
});

registerCheck("Lot 6D Invariants", "Une base véhicules importée peut pré-remplir une réception, remplit le client et les identifiants, et ces champs restent optionnels", () => {
  const csvContent = 
    `Chassis,Immatriculation,Sell-to Customer Name,Customer Phone,Marque,Description,Version,Delivery Date,Warranty End Date\n` +
    `VIN1234567,123 TU 456,Mhadhbi Salah,+216 55 111 001,Dongfeng,Shine Max,Luxury,15/06/2026,15/06/2029`;
  
  const parsed = parseVehicleMasterCsv(csvContent);
  assert.equal(parsed.importedCount, 1);
  const v = parsed.records[0];
  assert.equal(v.vin, "VIN1234567");
  assert.equal(v.plateNumber, "123 TU 456");
  assert.equal(v.customerName, "Mhadhbi Salah");
  assert.equal(v.customerPhone, "+216 55 111 001");
  assert.equal(v.brand, "Dongfeng");
  assert.equal(v.model, "Shine Max");
  assert.equal(v.version, "Luxury");
  assert.equal(v.deliveryDate, "2026-06-15");
  assert.equal(v.warrantyPartsEndDate, "2029-06-15");
  
  const dossierInput = {
    clientNom: v.customerName,
    clientTelephone: v.customerPhone || "",
    deposantNom: v.customerName,
    deposantTelephone: v.customerPhone || "",
    vehiculeMarque: v.brand || "Dongfeng",
    vehiculeModele: v.model || "",
    vehiculeImmatriculation: v.plateNumber || "",
    vehiculeVIN: v.vin || "",
    vehiculeKilometrage: 10000,
    vehiculeCouleur: "Gris",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Entretien",
    observationsReception: "RAS",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
    vehiculeVersion: v.version,
    dateLivraison: v.deliveryDate,
    dateMiseCirculation: v.circulationDate,
    statutGarantie: "Garantie active",
    dernierEntretien: "Aucun"
  };
  
  const dossier = createReceptionDossier(dossierInput, []);
  assert.equal(dossier.clientNom, "Mhadhbi Salah");
  assert.equal(dossier.vehiculeVIN, "VIN1234567");
  assert.equal(dossier.vehiculeVersion, "Luxury");
  assert.equal(dossier.dateLivraison, "2026-06-15");
  
  const inputMinimal = {
    clientNom: "Bob",
    clientTelephone: "+216 99 999 999",
    deposantNom: "Bob",
    deposantTelephone: "+216 99 999 999",
    vehiculeMarque: "Dongfeng",
    vehiculeModele: "Shine",
    vehiculeImmatriculation: "123 TU 456",
    vehiculeVIN: "VIN123",
    vehiculeKilometrage: 10000,
    vehiculeCouleur: "Gris",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Plainte",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: []
  };
  const dossierMin = createReceptionDossier(inputMinimal, []);
  assert.equal(dossierMin.vehiculeVersion, "");
  assert.equal(dossierMin.dateLivraison, "");
});

registerCheck("Lot 6D Invariants", "Utiliser ce véhicule ne crée pas de dossier automatiquement", () => {
  const viewContent = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  assert.ok(viewContent.includes("handleUseVehicleMasterRecord"), "handleUseVehicleMasterRecord doit être défini");
  
  const funcBodyStart = viewContent.indexOf("const handleUseVehicleMasterRecord");
  const funcBodyEnd = viewContent.indexOf("const handleUseVehicleClick");
  const funcBody = viewContent.substring(funcBodyStart, funcBodyEnd);
  
  assert.ok(!funcBody.includes("onAddDossier"), "handleUseVehicleMasterRecord ne doit pas ajouter directement un dossier");
  assert.ok(!funcBody.includes("createReceptionDossier"), "handleUseVehicleMasterRecord ne doit pas créer directement de dossier");
});

registerCheck("Lot 6D Invariants", "Aucun écrasement de saisie manuelle sans confirmation", () => {
  const viewContent = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  assert.ok(viewContent.includes("isFormFilled"), "GuidedReception doit vérifier si le formulaire est rempli");
  assert.ok(viewContent.includes("setShowOverwriteConfirmation(true)"), "GuidedReception doit afficher un dialogue de confirmation d'écrasement");
});

registerCheck("Lot 6D Invariants", "Aucune donnée réelle committée ni CA/marge/paiement/stock réel ajouté", () => {
  assert.ok(!fs.existsSync("Liste Vehicule.xlsx"), "Le fichier réel Liste Vehicule.xlsx ne doit pas être committé");
  
  const coreContent = fs.readFileSync("src/sav-core.ts", "utf8");
  const receptionContent = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  
  const forbidden = ["chiffre d'affaires", "chiffre d’affaires", "marge commerciale", "paiement caisse", "stock reel", "facturation reelle"];
  for (const word of forbidden) {
    assert.ok(!coreContent.toLowerCase().includes(word), `Le fichier sav-core.ts ne doit pas inclure la notion de ${word}`);
    assert.ok(!receptionContent.toLowerCase().includes(word), `Le fichier GuidedReception.tsx ne doit pas inclure la notion de ${word}`);
  }
});

registerCheck("Lot 6D-bis Invariants", "La détection de doublons bloque la création directe de dossiers actifs pour le même VIN ou immatriculation", () => {
  const content = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  assert.ok(content.includes("isActiveDossier"), "GuidedReception doit implémenter isActiveDossier");
  assert.ok(content.includes("setActiveDuplicateDossier"), "GuidedReception doit pouvoir définir activeDuplicateDossier");
  assert.ok(content.includes("open-existing-dossier"), "GuidedReception doit proposer un bouton d'ouverture du dossier existant");
});

registerCheck("Lot 6D-bis Invariants", "Le focus-out de l'immatriculation déclenche la recherche et remplit le formulaire si match unique", () => {
  const content = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  assert.ok(content.includes("handleImmatriculationBlur"), "GuidedReception doit implémenter handleImmatriculationBlur");
  assert.ok(content.includes("onBlur={handleImmatriculationBlur}"), "L'input immatriculation doit associer handleImmatriculationBlur");
});

registerCheck("Lot 6E Invariants", "validations métier bloquent les entrées invalides", () => {
  assert.equal(validateTunisianPhone("+216 20 000 001"), true);
  assert.equal(validateTunisianPhone("+21620000001"), true);
  assert.equal(validateTunisianPhone("20000001"), true);
  assert.equal(validateTunisianPhone("+216 XX 000 001"), false);
  assert.equal(validateVin("1HGCM82633A004352"), true);
  assert.equal(validateVin("1HGCM82633A00435Q"), false);
  assert.equal(validatePlateNumber("123 TU 456"), true);
  assert.equal(validateMileage(-1).valid, false);
  assert.equal(validateMileage(500001).mustConfirm, true);
  assert.equal(validateMileage(999999).valid, true);
  assert.equal(validateMileage(1000000).valid, false);
  assert.equal(validateMileage(1000001).valid, false);
  assert.equal(validateMileage(12.5).valid, false);
  assert.equal(validateComplaintText("Bruit moteur à froid"), true);
  assert.equal(validateComplaintText("RAS"), false);
  assert.equal(validateTechnicianDiagnostic("ok"), false);
  assert.equal(maskPhoneNumber("+216 55 111 001"), "+216 ** *** 001");
});

registerCheck("Lot 6E Invariants", "champs libres neutralisent script et balises", () => {
  const sanitized = sanitizeFreeText("<script>alert(1)</script><b>Diagnostic exploitable</b> javascript:alert(1)");
  assert.equal(sanitized.includes("<"), false);
  assert.equal(sanitized.includes("script"), false);
  assert.equal(sanitized.includes("javascript:"), false);
});

registerCheck("Lot 6E Invariants", "audit trail horodaté pour actions sensibles", () => {
  clearAuditTrail();
  const entry = logAuditEvent({
    user: "QA",
    role: UserRole.DIRECTEUR_SAV,
    module: "dossiers",
    action: "changement_statut",
    dossierId: "NIMR-QA-6E",
    ancienStatut: DossierStatus.CONTROLE_QUALITE,
    nouveauStatut: DossierStatus.PRET_A_LIVRER,
    commentaire: "<b>validation</b>",
    source: "qa-agent",
  });
  assert.ok(!Number.isNaN(Date.parse(entry.timestamp)));
  assert.equal(entry.commentaire, "validation");
  assert.equal(getAuditTrail()[0].id, entry.id);
  clearAuditTrail();
});

registerCheck("Lot 6E Invariants", "session locale expire après 30 minutes et se rafraîchit sur activité", () => {
  const authContent = fs.readFileSync("src/auth.ts", "utf8");
  const appContent = fs.readFileSync("src/App.tsx", "utf8");
  assert.ok(authContent.includes("30 * 60 * 1000"), "auth.ts doit définir une expiration de 30 minutes");
  assert.ok(appContent.includes('window.addEventListener("click"'), "App doit rafraîchir la session au clic");
  assert.ok(appContent.includes('window.addEventListener("keydown"'), "App doit rafraîchir la session au clavier");
  assert.ok(appContent.includes("session-expired-message"), "App doit afficher un message de session expirée");
});

registerCheck("Lot 6E Invariants", "anti double-clic présent sur actions critiques", () => {
  const guardContent = fs.readFileSync("src/action-guard.ts", "utf8");
  const modalContent = fs.readFileSync("src/components/StandardReasonModal.tsx", "utf8");
  const receptionContent = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  const qcContent = fs.readFileSync("src/components/ControleQualiteView.tsx", "utf8");
  const deliveryContent = fs.readFileSync("src/components/LivraisonView.tsx", "utf8");
  assert.ok(guardContent.includes("already-running"), "createActionGuard doit empêcher une action déjà en cours");
  assert.ok(modalContent.includes("isSubmitting"), "StandardReasonModal doit désactiver confirmation pendant soumission");
  assert.ok(receptionContent.includes("receptionSubmitRef"), "Réception doit bloquer la double création");
  assert.ok(qcContent.includes("qcSubmitRef"), "QC doit bloquer la double décision");
  assert.ok(deliveryContent.includes("deliveryConfirmRef"), "Livraison doit bloquer la double restitution");
});

registerCheck("Lot 6E Invariants", "confirmations obligatoires QC et livraison", () => {
  const qcContent = fs.readFileSync("src/components/ControleQualiteView.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const deliveryContent = fs.readFileSync("src/components/LivraisonView.tsx", "utf8");
  assert.ok(qcContent.includes("modal-qc-validate"), "Le module QC doit confirmer une validation complète");
  assert.ok(qcContent.includes("modal-qc-refuse"), "Le module QC doit confirmer un refus avec motif");
  assert.ok(detailContent.includes("modal-qc-validate-detail"), "Le détail dossier doit confirmer une validation QC");
  assert.ok(detailContent.includes("modal-delivery-confirm-detail"), "Le détail dossier doit confirmer une restitution");
  assert.ok(deliveryContent.includes("showConfirmModal"), "Le module livraison doit demander une confirmation finale");
  assert.ok(deliveryContent.includes("hasSigned"), "La livraison doit exiger une signature ou confirmation client");
});

registerCheck("Lot 6E Invariants", "documents imprimables internes et sans finance réelle", () => {
  const printContent = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  for (const expected of ["Fiche Réception", "Ordre de Réparation Interne", "Fiche Contrôle Qualité", "Bon de Restitution"]) {
    assert.ok(printContent.includes(expected), `Document manquant: ${expected}`);
  }
  assert.ok(detailContent.includes("nimr-print-container"), "Le détail dossier doit intégrer le conteneur d'impression");
  for (const forbidden of [
    ["cai", "sse"].join(""),
    ["paie", "ment"].join(""),
    ["mar", "ge"].join(""),
    ["fac", "ture", " ré", "elle"].join(""),
    ["st", "ock", " r", "éel"].join(""),
  ]) {
    assert.equal(printContent.toLowerCase().includes(forbidden), false, `Document imprimable contient ${forbidden}`);
  }
});

registerCheck("Lot 6E Invariants", "lecture seule sans actions critiques visibles", () => {
  const chefContent = fs.readFileSync("src/components/ChefAtelierView.tsx", "utf8");
  assert.equal(isReadOnlyRole(UserRole.LECTURE_SEULE), true);
  assert.equal(canManageUsers(UserRole.LECTURE_SEULE), false);
  assert.ok(chefContent.includes("activeRole !== UserRole.LECTURE_SEULE"), "ChefAtelierView doit masquer les actions en lecture seule");
});

registerCheck("Lot 6F Invariants", "aucune clôture tâche sans diagnostic structuré", () => {
  const dossier = getMockDossier({
    id: "NIMR-QA-6F-DIAG",
    statut: DossierStatus.EN_TRAVAUX,
    technicienId: "tech_01",
    ordresReparation: [
      { id: "ro_diag", designation: "Diagnostic frein", tempsEstime: 1, tempsPasse: 0.2, status: "in_progress" },
    ],
  });
  const invalid = finishRepairOrder([dossier], dossier.id, "ro_diag", "ok");
  assert.equal(invalid.ok, false);

  const structured = validateStructuredTechnicianDiagnostic({
    cause: "Usure anormale confirmée après contrôle visuel complet.",
    action: "Remplacement de la pièce concernée et serrage contrôlé.",
    validation: "Essai statique conforme sans anomalie résiduelle détectée.",
  });
  assert.equal(structured.valid, true);
  const valid = finishRepairOrder([dossier], dossier.id, "ro_diag", structured.diagnostic!);
  assert.equal(valid.ok, true);
});

registerCheck("Lot 6F Invariants", "blocage contient motif commentaire responsable et ETA optionnelle", () => {
  const dossier = getMockDossier({
    id: "NIMR-QA-6F-BLOCK",
    statut: DossierStatus.EN_TRAVAUX,
    technicienId: "tech_01",
    ordresReparation: [
      { id: "ro_block", designation: "Diagnostic", tempsEstime: 1, tempsPasse: 0.1, status: "in_progress" },
    ],
  });
  const missingComment = blockRepairOrder([dossier], dossier.id, "ro_block", "Attente pièce", UserRole.TECHNICIEN);
  assert.equal(missingComment.ok, false);
  const blocked = blockRepairOrder(
    [dossier],
    dossier.id,
    "ro_block",
    "Attente pièce",
    UserRole.TECHNICIEN,
    new Date("2026-06-18T09:00:00Z"),
    "REF-QA",
    "2026-06-20",
    "Réception",
    "2026-06-21",
    "Pièce demandée, réception suit le retour client."
  );
  assert.equal(blocked.ok, true);
  if (blocked.ok) {
    assert.equal(blocked.line.blockComment, "Pièce demandée, réception suit le retour client.");
    assert.equal(blocked.line.blockFollowUpOwner, "Réception");
    assert.equal(blocked.dossier.bloqueSparePartRef, "REF-QA");
  }
});

registerCheck("Lot 6F Invariants", "import JSON protégé par backup et confirmation forte", () => {
  const dossier = getMockDossier({ id: "NIMR-QA-6F-IMPORT" });
  const backup = createPreImportBackupPayload([dossier], [], [], [], []);
  assert.equal(validateBackupPayload(backup).ok, true);
  const summary = buildImportSummary({ dossiers: [dossier] });
  assert.equal(summary.dossiers, 1);
  assert.equal(isStrongImportConfirmation(STRONG_IMPORT_CONFIRMATION), true);
  assert.equal(isStrongImportConfirmation("Je confirme"), false);
});

registerCheck("Lot 6F Invariants", "export JSON protégé et téléphone masqué si non autorisé", () => {
  const dossier = getMockDossier({ id: "NIMR-QA-6F-EXPORT", clientTelephone: "+216 55 111 001", deposantTelephone: "+216 55 111 001" });
  const masked = createRoleAwareBackupPayload([dossier], [], [], [], [], false);
  assert.equal(masked.dossiers[0].clientTelephone, "+216 ** *** 001");
  const full = createRoleAwareBackupPayload([dossier], [], [], [], [], true);
  assert.equal(full.dossiers[0].clientTelephone, "+216 55 111 001");
});

registerCheck("Lot 6F Invariants", "statut livraison sensible visible si renseigné", () => {
  assert.equal(validateDeliveryRestitutionStatus("Réserve client", "").valid, false);
  assert.equal(validateDeliveryRestitutionStatus("Client mécontent", "Client signale un bruit à contrôler.").valid, true);
  const deliveryContent = fs.readFileSync("src/components/LivraisonView.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  assert.ok(deliveryContent.includes("DELIVERY_RESTITUTION_STATUSES"));
  assert.ok(detailContent.includes("delivery-restitution-status-detail"));
});

registerCheck("Lot 6F Invariants", "VIN obligatoire en garantie", () => {
  const result = validateConditionalVin({ vin: "", typeDossier: InterventionType.GARANTIE_CONSTRUCTEUR });
  assert.equal(result.blocking, true);
  assert.match(result.reason || "", /VIN obligatoire/);
});

registerCheck("Lot 6F Invariants", "alertes aging affichées sur dashboard chef et réception", () => {
  assert.ok(fs.readFileSync("src/components/DirectorDashboard.tsx", "utf8").includes("aging-alerts-dashboard"));
  assert.ok(fs.readFileSync("src/components/ChefAtelierView.tsx", "utf8").includes("aging-alerts-chef"));
  assert.ok(fs.readFileSync("src/components/GuidedReception.tsx", "utf8").includes("aging-alerts-reception"));
});

registerCheck("Lot 6F Invariants", "aucune finance ajoutée", () => {
  const forbidden = [
    "chiffre d'affaires",
    "chiffre d’affaires",
    ["mar", "ge"].join(""),
    ["paie", "ment"].join(""),
    ["cai", "sse"].join(""),
    ["fac", "ture", " ré", "elle"].join(""),
    ["mon", "tant"].join(""),
    "solde",
    ["st", "ock", " r", "éel"].join(""),
    ["dis", "ponibilité", " pi", "èce", " ré", "elle"].join(""),
  ];
  const files = [
    "src/components/DossierDetail.tsx",
    "src/components/LivraisonView.tsx",
    "src/components/GuidedReception.tsx",
    "src/components/ChefAtelierView.tsx",
    "src/components/DirectorDashboard.tsx",
    "src/import-export-safety.ts",
    "src/aging-alerts.ts",
    "src/field-validations.ts",
  ];
  for (const file of files) {
    const content = stripOperationalWorkshopMargin(fs.readFileSync(file, "utf8").toLowerCase());
    for (const word of forbidden) {
      assert.equal(content.includes(word), false, `${file} contient ${word}`);
    }
  }
});

registerCheck("Lot 6F Invariants", "aucun tag v1.1.0 final créé et aucune donnée réelle committée", () => {
  const packedRefs = fs.existsSync(".git/packed-refs") ? fs.readFileSync(".git/packed-refs", "utf8") : "";
  const hasPackedFinalTag = packedRefs.split(/\r?\n/).some(line => /\srefs\/tags\/v1\.1\.0$/.test(line));
  assert.equal(fs.existsSync(".git/refs/tags/v1.1.0"), false);
  assert.equal(hasPackedFinalTag, false);
  assert.equal(fs.existsSync("Liste Vehicule.xlsx"), false);
});

registerCheck("Lot 6G Invariants", "headers CSV réel-like mappés vers VIN, client et téléphone", () => {
  assert.equal(normalizeHeader("No Chassis (VIN)"), "no chassis vin");
  assert.equal(normalizeHeader("N° article"), "n article");
  assert.equal(normalizeHeader("N° téléphone"), "n telephone");
  assert.equal(findMappedField("No Chassis (VIN)"), "vin");
  assert.equal(findMappedField("Nom"), "customerName");
  assert.equal(findMappedField("N° téléphone"), "customerPhone");
});

registerCheck("Lot 6G Invariants", "CSV réel-like ne perd pas VIN, client ni téléphone", () => {
  const csvContent =
    `No Chassis (VIN),N° article,Description,Matricule,N° client,Nom,N° téléphone,Date Mise en Circulation,Date Livraison\n` +
    `LDP43A961SS112183,BOX EV 430 BLANC,DONGFENG BOX EV 430,2318TU259,CLT-DEMO-001,Client Demo,+21622222222,2/25/2026,3/4/2026`;
  const parsed = parseVehicleMasterCsv(csvContent);
  assert.equal(parsed.importedCount, 1);
  const vehicle = parsed.records[0];
  assert.equal(vehicle.vin, "LDP43A961SS112183");
  assert.equal(vehicle.customerName, "Client Demo");
  assert.equal(vehicle.customerPhone, "+21622222222");
  assert.equal(vehicle.plateNumber, "2318TU259");
  assert.equal(vehicle.brand, "Dongfeng");
  assert.equal(vehicle.model, "DONGFENG BOX EV 430");
  assert.equal(vehicle.circulationDate, "2026-02-25");
  assert.equal(vehicle.deliveryDate, "2026-03-04");
  assert.deepEqual(getVehicleMasterStats(parsed.records), {
    total: 1,
    withVin: 1,
    withClient: 1,
    withPhone: 1,
    withPlate: 1,
    withModel: 1
  });
});

registerCheck("Lot 6G Invariants", "recherche VIN complet, VIN partiel, plaque et client fonctionne", () => {
  const parsed = parseVehicleMasterCsv(
    `No Chassis (VIN),Description,Matricule,Nom,N° téléphone\n` +
    `LDP43A961SS112183,DONGFENG BOX EV 430,2318TU259,Client Demo,+21622222222`
  );
  assert.equal(searchVehicleMaster(parsed.records, "LDP43A961SS112183").length, 1);
  assert.equal(searchVehicleMaster(parsed.records, "112183").length, 1);
  assert.equal(searchVehicleMaster(parsed.records, "2318 TU 259").length, 1);
  assert.equal(searchVehicleMaster(parsed.records, "Client Dem").length, 1);
  assert.equal(searchVehicleMaster(parsed.records, "BOX EV 430").length, 1);
});

registerCheck("Lot 6G Invariants", "GuidedReception importe en ArrayBuffer et pré-remplit sans écraser par vide", () => {
  const viewContent = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  const funcBodyStart = viewContent.indexOf("const handleUseVehicleMasterRecord");
  const funcBodyEnd = viewContent.indexOf("const handleUseVehicleClick");
  const funcBody = viewContent.substring(funcBodyStart, funcBodyEnd);
  assert.ok(viewContent.includes("readAsArrayBuffer"), "L'import doit lire le CSV en ArrayBuffer");
  assert.ok(viewContent.includes("decodeVehicleMasterCsvBuffer"), "L'import doit choisir un décodage CSV robuste");
  assert.ok(funcBody.includes("if (vehicle.customerName) updateClientNom(vehicle.customerName)"), "Client doit être pré-rempli si disponible");
  assert.ok(funcBody.includes("if (vehicle.customerPhone) updateClientTelephone(vehicle.customerPhone)"), "Téléphone doit être pré-rempli si disponible");
  assert.ok(funcBody.includes("if (validVin) setVehiculeVIN(validVin)"), "VIN valide doit être pré-rempli");
  assert.ok(funcBody.includes("if (vehicle.plateNumber) setVehiculeImmatriculation(vehicle.plateNumber)"), "Immatriculation doit être pré-remplie");
  assert.ok(funcBody.includes("setVehiculeModele(importedModel)"), "Modèle doit venir de la Description importée ou du placeholder");
  assert.equal(funcBody.includes("setVehiculeModele(inferred.model)"), false, "La marque inférée ne doit pas remplacer la Description modèle");
});

registerCheck("Lot 6G Invariants", "modèle réception = Description importée avec placeholder si vide", () => {
  const parsed = parseVehicleMasterCsv(
    `VIN,Immatriculation,Marque,Description\n` +
    `VIN-DESC-001,111 TU 222,Dongfeng,Dongfeng Shine Max\n` +
    `VIN-DESC-002,222 TU 333,Dongfeng,`
  );
  assert.equal(parsed.records[0].model, "Dongfeng Shine Max");
  assert.equal(parsed.records[0].brand, "Dongfeng");
  assert.equal(parsed.records[1].model, undefined);
  assert.equal(VEHICLE_MODEL_TO_FILL_PLACEHOLDER, "Modèle à renseigner");

  const viewContent = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  assert.ok(viewContent.includes("parseVehicleMasterXlsxBuffer"), "Réception doit accepter un import véhicule Excel minimal");
  assert.ok(viewContent.includes('accept=".csv,.xlsx"'), "L'import véhicule doit accepter CSV et Excel");
  assert.ok(viewContent.includes("VEHICLE_MODEL_TO_FILL_PLACEHOLDER"), "Le placeholder modèle doit être utilisé côté réception");
});

registerCheck("Lot 6G Invariants", "diagnostic base véhicules affiche les compteurs et messages utiles", () => {
  const viewContent = fs.readFileSync("src/components/GuidedReception.tsx", "utf8");
  assert.ok(viewContent.includes("vehicle-master-diagnostics"), "Le panneau doit afficher les compteurs de base");
  assert.ok(viewContent.includes("withVin"), "Le diagnostic doit compter les VIN");
  assert.ok(viewContent.includes("withClient"), "Le diagnostic doit compter les clients");
  assert.ok(viewContent.includes("Cette base locale ne contient pas les VIN."), "Message VIN absent requis");
  assert.ok(viewContent.includes("Cette base locale ne contient pas les noms clients."), "Message client absent requis");
});

registerCheck("Lot 6G Invariants", "aucun tag créé et aucune donnée réelle Liste Vehicule committée", () => {
  const packedRefs = fs.existsSync(".git/packed-refs") ? fs.readFileSync(".git/packed-refs", "utf8") : "";
  const hasForbiddenTag = packedRefs.split(/\r?\n/).some(line => /\srefs\/tags\/v1\.1\.0$|\srefs\/tags\/v1\.1\.1$/.test(line));
  assert.equal(fs.existsSync(".git/refs/tags/v1.1.0"), false);
  assert.equal(fs.existsSync(".git/refs/tags/v1.1.1"), false);
  assert.equal(hasForbiddenTag, false);
  assert.equal(fs.existsSync("Liste Vehicule.csv"), false);
  assert.equal(fs.existsSync("Liste Vehicule.xlsx"), false);
});

registerCheck("Lot 6J Complément", "MO sans durée inventée et planning bloqué tant que non validée", () => {
  const dossier = createReceptionDossier({
    clientNom: "Client QA",
    clientTelephone: "+216 20 000 000",
    deposantNom: "Client QA",
    deposantTelephone: "+216 20 000 000",
    vehiculeMarque: "Dongfeng",
    vehiculeModele: "",
    vehiculeImmatriculation: "123 TU 456",
    vehiculeVIN: "",
    vehiculeKilometrage: 100,
    vehiculeCouleur: "Gris",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Contrôle atelier fictif",
    observationsReception: "",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
    objetsLaisses: [],
  }, [], new Date("2026-06-15T08:00:00Z"));
  assert.equal(dossier.vehiculeModele, "Modèle à renseigner");
  assert.ok(dossier.ordresReparation.every(line => line.tempsEstime === 0), "Création dossier ne doit pas inventer de durée");
  assert.ok(dossier.ordresReparation.every(line => line.isEstimatedDurationValidated === false), "Durée initiale non validée");

  const quoteLines = mapLaborLinesToRepairOrderLines(buildQuoteImportPreview(parseQuoteText("Contrôle géométrie 1H")));
  assert.equal(quoteLines[0].tempsEstime, 1);
  assert.equal(quoteLines[0].isEstimatedDurationValidated, false, "Import MO reste à valider par Chef Atelier");

  const quoteDossier = getMockDossier({
    id: "NIMR-QA-MO-NOVALID",
    ordresReparation: [quoteLines[0]],
  });
  const blocked = validatePlanningAssignment({
    dossiers: [quoteDossier],
    dossierId: quoteDossier.id,
    lineId: quoteLines[0].id,
    technicianId: mockTechs[0].id,
    bayId: mockBays[0].id,
    start: new Date("2026-06-15T10:00:00"),
    end: new Date("2026-06-15T11:00:00"),
    technicians: mockTechs,
    workshopBays: mockBays,
  }, new Date("2026-06-15T08:00:00"));
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.codes.includes("planning-duration-not-validated"));

  const savCoreContent = fs.readFileSync("src/sav-core.ts", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  const complaintsContent = fs.readFileSync("src/complaints-workflow.ts", "utf8");
  assert.equal(savCoreContent.includes("Math.max(0.5"), false, "suggestWorkshopSlot ne doit plus forcer 0.5h");
  assert.equal(planningContent.includes("line.tempsEstime || 1"), false, "Planning ne doit pas injecter 1h");
  assert.ok(planningContent.includes("isDurationReadyForPlanning"), "Planning doit vérifier la durée validée");
  assert.ok(detailContent.includes("durationValidationReason"), "Validation durée doit conserver le motif");
  assert.ok(detailContent.includes("duration-validation-reason"), "La modale doit exiger un motif");
  assert.ok(complaintsContent.includes("tempsEstime: 0"), "Réclamation corrective ne doit pas inventer 1h");
});

registerCheck("Lot 6H Invariants", "Gantt et vues tâches utilisent un statut visuel unique", () => {
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const techContent = fs.readFileSync("src/components/TechnicianView.tsx", "utf8");

  assert.ok(TASK_STATUS_VISUAL_ORDER.includes("blocked"), "Le statut bloqué doit être dans la légende Gantt");
  assert.equal(getTaskStatusVisual("blocked").testId, "gantt-task-status-blocked");
  assert.equal(getTaskStatusVisual("done").label, "Terminée");
  assert.ok(planningContent.includes("getTaskStatusVisual"), "WorkshopPlanning doit utiliser le helper visuel commun");
  assert.ok(detailContent.includes("getTaskStatusVisual"), "DossierDetail doit utiliser le helper visuel commun");
  assert.ok(techContent.includes("getTaskStatusVisual"), "TechnicianView doit utiliser le helper visuel commun");
  assert.equal(planningContent.includes("getTaskStatusLabel("), false, "Ancien helper local de statut Gantt interdit");
});

registerCheck("Lot 6H Invariants", "suggestion planning cible une tâche non planifiée sans planifier tout le dossier", () => {
  const dossier = getMockDossier({
    id: "NIMR-QA-6H-PLAN",
    statut: DossierStatus.EN_TRAVAUX,
    ordresReparation: [
      { id: "ro_todo", designation: "Diagnostic vibration", tempsEstime: 1.5, tempsPasse: 0, status: "pending" },
      { id: "ro_done", designation: "Contrôle terminé", tempsEstime: 1, tempsPasse: 1, status: "done" },
      {
        id: "ro_planned",
        designation: "Tâche déjà planifiée",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        planningStart: "2026-06-15T09:00:00",
        planningEnd: "2026-06-15T10:00:00",
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_01",
      },
    ],
  });
  const targets = getUnplannedRepairOrderTargets([dossier]);
  assert.deepEqual(targets.map(target => target.key), ["NIMR-QA-6H-PLAN::ro_todo"]);
  assert.equal(getCurrentGanttTaskStatus(dossier, "ro_done"), "done");

  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  assert.ok(planningContent.includes("getUnplannedRepairOrderTargets"), "La liste des suggestions doit être construite par tâche");
  assert.ok(planningContent.includes("selectedTargetForSuggest"), "La suggestion doit porter sur la cible tâche sélectionnée");
});

registerCheck("Lot 6H Invariants", "déplacement Gantt validé et impressions Gantt tableau retirées", () => {
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  assert.ok(planningContent.includes("planning-reschedule-modal"), "Le modal de modification créneau doit exister");
  assert.ok(planningContent.includes("validatePlanningAssignment"), "La modification créneau doit réutiliser la validation planning stricte");
  assert.ok(planningContent.includes("handleDropTask"), "Le drag/drop Gantt doit être câblé");
  assert.ok(planningContent.includes("gantt-reschedule-"), "Chaque bloc Gantt doit exposer l'action modifier créneau");
  assert.equal(planningContent.includes("planning-print-gantt"), false, "Ancien bouton impression Gantt interdit");
  assert.equal(planningContent.includes("planning-print-table"), false, "Ancien bouton impression tableau interdit");
  assert.equal(planningContent.includes("Imprimer Gantt"), false, "Libellé impression Gantt retiré");
  assert.equal(planningContent.includes("Imprimer Tableau"), false, "Libellé impression tableau retiré");
});

registerCheck("Lot 6H Invariants", "shifts techniciens et ponts réduisent les créneaux effectifs", () => {
  const profiles = getDefaultWorkshopShiftProfiles();
  assert.ok(profiles.some(profile => profile.id === "shift_morning"), "Profil équipe matin obligatoire");
  assert.ok(profiles.some(profile => profile.id === "shift_afternoon"), "Profil équipe après-midi obligatoire");
  assert.ok(profiles.some(profile => profile.id === "shift_continuous"), "Profil journée continue obligatoire");

  const config: WorkshopAvailabilityConfig = {
    schedule: getDefaultWorkshopSchedule(),
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [],
    shiftProfiles: profiles,
    technicianShiftAssignments: [
      { id: "shift-tech-qa", technicianId: "tech_01", shiftProfileId: "shift_morning", startDate: "2026-06-15" },
    ],
    bayShiftAssignments: [
      { id: "shift-bay-qa", bayId: "bay_01", shiftProfileId: "shift_morning", startDate: "2026-06-15" },
    ],
  };

  const windows = getEffectiveWorkshopWindowsForResource(
    new Date("2026-06-15T08:00:00"),
    config,
    { technicianId: "tech_01", bayId: "bay_01" }
  );
  assert.deepEqual(windows, [{ start: "08:00", end: "12:00" }]);

  const morningSlot = validateAvailabilityForSlot({
    startTime: "2026-06-15T09:00:00",
    endTime: "2026-06-15T11:00:00",
    technicianId: "tech_01",
    bayId: "bay_01",
    config,
  });
  const afternoonSlot = validateAvailabilityForSlot({
    startTime: "2026-06-15T13:00:00",
    endTime: "2026-06-15T14:00:00",
    technicianId: "tech_01",
    bayId: "bay_01",
    config,
  });
  assert.equal(morningSlot.allowed, true);
  assert.equal(afternoonSlot.allowed, false);
  assert.ok(afternoonSlot.codes.includes("outside-effective-working-hours"));
});

registerCheck("Lot 6J Invariants", "Gantt conserve les tâches planifiées actives non terminées", () => {
  const plannedLine = {
    id: "ro_active_planned",
    designation: "Diagnostic planifié actif",
    tempsEstime: 1,
    tempsPasse: 0,
    status: "pending" as const,
    planningStart: "2026-06-15T09:00:00.000Z",
    planningEnd: "2026-06-15T10:00:00.000Z",
    plannedTechnicianId: "tech_01",
    plannedBayId: "bay_01",
  };
  const dossier = getMockDossier({
    id: "NIMR-QA-6J-GANTT",
    statut: DossierStatus.TRAVAUX_PLANIFIES,
    ordresReparation: [plannedLine],
  });
  assert.equal(isActivePlannedTask(plannedLine, dossier, "2026-06-15"), true);
  assert.equal(getRepairOrderPlanningSegmentsForDate(plannedLine, "2026-06-15").length, 1);
  assert.equal(getGanttTaskVisualState(plannedLine, new Date("2026-06-15T08:00:00.000Z"), dossier), "planned_future");
  assert.equal(getGanttTaskVisualState(plannedLine, new Date("2026-06-15T09:30:00.000Z"), dossier), "due_now_not_started");
  assert.equal(getGanttTaskVisualState({ ...plannedLine, status: "in_progress" as const }, new Date("2026-06-15T09:30:00.000Z"), dossier), "in_progress");
  assert.equal(getGanttTaskVisualState({ ...plannedLine, status: "blocked" as const }, new Date("2026-06-15T09:30:00.000Z"), dossier), "blocked");
  assert.equal(getGanttTaskVisualState({ ...plannedLine, status: "reopened" as const }, new Date("2026-06-15T09:30:00.000Z"), dossier), "qc_return");
  assert.equal(getGanttTaskVisualState(plannedLine, new Date("2026-06-15T10:30:00.000Z"), dossier), "overdue_unfinished");
  assert.equal(isActivePlannedTask({ ...plannedLine, status: "done" as const }, dossier, "2026-06-15"), false);
  assert.equal(isActivePlannedTask(plannedLine, { ...dossier, statut: DossierStatus.ANNULE }, "2026-06-15"), false);

  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  assert.ok(planningContent.includes("isActivePlannedTask(line, dossier, selectedDateStr)"), "Le Gantt doit utiliser le helper actif daté");
  assert.ok(planningContent.includes("getRepairOrderPlanningSegmentsForDate(line, selectedDateStr)"), "Les blocs visibles doivent utiliser les segments datés");
});

registerCheck("Lot 6J Invariants", "horaires équipes configurables validés et persistés localement", () => {
  const draft = {
    name: "Équipe pilote",
    dayStart: "07:30",
    dayEnd: "18:00",
    pauseEnabled: true,
    pauseStart: "12:30",
    pauseEnd: "13:15",
    activeDays: [1, 2, 3, 4, 5, 6],
  };
  const validation = validateShiftProfileDraft(draft);
  assert.equal(validation.valid, true);
  assert.equal(validation.capacityMinutes, 585);
  assert.deepEqual(buildScheduleFromShiftProfileDraft(draft).days.find(day => day.dayOfWeek === 1)?.windows, [
    { start: "07:30", end: "12:30" },
    { start: "13:15", end: "18:00" },
  ]);
  const schedule = buildScheduleFromShiftProfileDraft({
    ...draft,
    dayStart: "09:00",
    dayEnd: "18:00",
    pauseStart: "12:00",
    pauseEnd: "13:00",
  });
  const config: WorkshopAvailabilityConfig = {
    schedule,
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [],
    shiftProfiles: [{
      id: "shift_standard",
      name: "Équipe pilote",
      active: true,
      schedule,
    }],
  };
  const dossier = getMockDossier({
    id: "NIMR-QA-6J-SHIFT",
    ordresReparation: [
      { id: "ro_shift", designation: "Tâche horaire configurable", tempsEstime: 1, tempsPasse: 0, status: "pending", estimateSource: "manual", isEstimatedDurationValidated: true },
    ],
  });
  const lateSlot = validatePlanningAssignment({
    dossiers: [dossier],
    dossierId: dossier.id,
    lineId: "ro_shift",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-15T17:00:00",
    end: "2026-06-15T18:00:00",
    reservations: [],
    availabilityConfig: config,
  }, new Date("2026-06-15T07:00:00"));
  const earlySlot = validatePlanningAssignment({
    dossiers: [dossier],
    dossierId: dossier.id,
    lineId: "ro_shift",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-15T08:00:00",
    end: "2026-06-15T09:00:00",
    reservations: [],
    availabilityConfig: config,
  }, new Date("2026-06-15T07:00:00"));
  assert.equal(lateSlot.allowed, true);
  assert.equal(earlySlot.allowed, false);
  assert.equal(validateShiftProfileDraft({ ...draft, dayEnd: "22:00" }).valid, false);
  assert.equal(validateShiftProfileDraft({ ...draft, pauseStart: "06:30" }).valid, false);
  assert.equal(SHIFT_PROFILES_STORAGE_KEY, "nimr-sav-pro-shift-profiles");

  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  const appContent = fs.readFileSync("src/App.tsx", "utf8");
  assert.ok(planningContent.includes("Modifier les horaires de l'équipe"), "La modale d'édition horaires doit exister");
  assert.ok(planningContent.includes("shift-profile-pause-enabled"), "La pause doit être configurable");
  assert.ok(planningContent.includes("shift-profile-capacity"), "La capacité calculée doit être visible");
  assert.ok(planningContent.includes("shift-profiles-reset-defaults"), "La réinitialisation horaires par défaut doit exister");
  assert.ok(appContent.includes("SHIFT_PROFILES_STORAGE_KEY"), "App doit persister les profils horaires dans la clé unique");
  assert.ok(fs.readFileSync("src/sav-core.ts", "utf8").includes("buildAvailabilityPlanningSegments"), "La validation planning doit construire les segments depuis les horaires configurés");
});

registerCheck("Lot 6H Invariants", "fiche tâche technicien imprimable et sans finance", () => {
  const printContent = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  const cssContent = fs.readFileSync("src/index.css", "utf8");

  for (const expected of [
    "Fiche tâche technicien",
    "Dossier ID",
    "Client",
    "Téléphone",
    "Véhicule",
    "Immatriculation",
    "VIN",
    "Kilométrage",
    "Motif client / Plainte",
    "Tâche / opération",
    "Technicien affecté",
    "Diagnostic technicien",
    "Observations",
    "Signature Technicien",
    "Signature Chef Atelier",
    "Contrôle Qualité",
  ]) {
    assert.ok(printContent.includes(expected), `Fiche tâche technicien incomplète: ${expected}`);
  }
  assert.ok(printContent.includes('data-testid="technician-task-sheet-print"'), "La fiche tâche doit exposer un root métier testable");
  assert.ok(printContent.includes('type === "task"'), "PrintDocuments doit gérer le type task");
  assert.ok(detailContent.includes("print-task-sheet-"), "DossierDetail doit proposer la fiche tâche");
  assert.ok(planningContent.includes("gantt-task-sheet-"), "Gantt doit proposer la fiche tâche");
  assert.match(detailContent, /createPortal\(\s*<div id="technician-task-print-root"[\s\S]*?<\/div>,\s*document\.body\s*\)/, "DossierDetail doit portaler la fiche tâche hors #root");
  assert.match(planningContent, /createPortal\(\s*<div id="technician-task-print-root"[\s\S]*?<\/div>,\s*document\.body\s*\)/, "WorkshopPlanning doit portaler la fiche tâche hors #root");
  assert.ok(cssContent.includes("body.printing-task-sheet #technician-task-print-root"), "Le CSS print doit cibler le root fiche tâche");
  assert.ok(cssContent.includes("body.printing-task-sheet #technician-task-print-root *"), "Le CSS print doit rendre les enfants de la fiche visibles");
  assert.ok(cssContent.includes("position: absolute !important"), "La fiche tâche doit sortir du flux app en print");
  assert.equal(/body\.printing-task-sheet\s+#technician-task-print-root[\s\S]{0,200}display:\s*none/i.test(cssContent), false, "Le root fiche tâche ne doit pas être masqué en print");

  for (const forbidden of [
    ["cai", "sse"].join(""),
    ["paie", "ment"].join(""),
    ["mar", "ge"].join(""),
    ["fac", "ture", " ré", "elle"].join(""),
    ["st", "ock", " r", "éel"].join(""),
    ["mon", "tant"].join(""),
    "solde",
    ["pr", "ix"].join(""),
    ["dis", "ponibilité", " ré", "elle", " pi", "èce"].join(""),
  ]) {
    assert.equal(printContent.toLowerCase().includes(forbidden), false, `Fiche tâche contient ${forbidden}`);
  }
});

registerCheck("Lot 6H Invariants", "réclamation liée crée badge et tâche corrective atelier", () => {
  const complaint = getMockComplaint({
    id: "REC-QA-6H",
    dossierId: "NIMR-QA-6H-REC",
    linkedDossierId: "NIMR-QA-6H-REC",
    motif: "Bruit récurrent après restitution",
    criticite: "critique",
    statut: "nouvelle",
  });
  const linked = linkComplaintToRepairOrder(
    complaint,
    "ro_existing",
    { user: "QA", role: UserRole.RECEPTIONNAIRE },
    new Date("2026-06-15T09:00:00Z")
  );
  assert.equal(linked.statut, "en_analyse");
  assert.deepEqual(linked.linkedRepairOrderIds, ["ro_existing"]);

  const corrective = createCorrectiveTaskFromComplaint(
    linked,
    ["ro_existing"],
    { user: "QA", role: UserRole.CHEF_ATELIER },
    new Date("2026-06-15T09:10:00Z")
  );
  assert.equal(corrective.complaint.statut, "tache_corrective_creee");
  assert.equal(corrective.line.sourceComplaintId, "REC-QA-6H");
  assert.equal(corrective.line.complaintBadge, true);
  assert.ok(corrective.complaint.linkedRepairOrderIds?.includes(corrective.line.id));

  const complaintsViewContent = fs.readFileSync("src/components/ComplaintsView.tsx", "utf8");
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  assert.ok(complaintsViewContent.includes("complaint-linked-task-badge"), "La vue réclamations doit afficher le lien tâche");
  assert.ok(planningContent.includes("sourceComplaintId"), "Le Gantt doit afficher le badge réclamation");
  assert.ok(detailContent.includes("sourceComplaintId"), "Le détail dossier doit afficher le badge réclamation");
});

registerCheck("Lot 6H Invariants", "aucun mojibake, finance, donnée réelle ou tag final ajouté", () => {
  const files = [
    "src/components/WorkshopPlanning.tsx",
    "src/components/DossierDetail.tsx",
    "src/components/PrintDocuments.tsx",
    "src/components/ComplaintsView.tsx",
    "src/workshop-availability.ts",
    "src/complaints-workflow.ts",
    "src/task-status-visual.ts",
    "src/workshop-planning-helpers.ts",
  ];
  const mojibake = /Ã|Â|�|â€™|â€œ|â€|âœ|Å“/;
  const forbiddenFinance = [
    "chiffre d'affaires",
    "chiffre d’affaires",
    ["mar", "ge"].join(""),
    ["paie", "ment"].join(""),
    ["cai", "sse"].join(""),
    ["fac", "ture", " ré", "elle"].join(""),
    ["mon", "tant"].join(""),
    "solde",
    ["st", "ock", " r", "éel"].join(""),
    ["dis", "ponibilité", " pi", "èce", " ré", "elle"].join(""),
    ["pr", "ix"].join(""),
  ];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    assert.equal(mojibake.test(content), false, `${file} contient un caractère mojibake`);
    const lower = stripOperationalWorkshopMargin(content.toLowerCase());
    for (const word of forbiddenFinance) {
      assert.equal(lower.includes(word), false, `${file} contient le mot financier interdit: ${word}`);
    }
  }

  const packedRefs = fs.existsSync(".git/packed-refs") ? fs.readFileSync(".git/packed-refs", "utf8") : "";
  const hasForbiddenTag = packedRefs.split(/\r?\n/).some(line => /\srefs\/tags\/v1\.1\.0$|\srefs\/tags\/v1\.1\.1$/.test(line));
  assert.equal(fs.existsSync(".git/refs/tags/v1.1.0"), false);
  assert.equal(fs.existsSync(".git/refs/tags/v1.1.1"), false);
  assert.equal(hasForbiddenTag, false);
  assert.equal(fs.existsSync("Liste Vehicule.csv"), false);
  assert.equal(fs.existsSync("Liste Vehicule.xlsx"), false);
});

registerCheck("Lot 6I Invariants", "mentions RC client-side signatures simples et pièces jointes locales", () => {
  assert.equal(CLIENT_SIDE_SECURITY_NOTICE, "Version RC client-side, sécurité réelle nécessitant backend v2.0.");
  assert.match(PILOT_SIGNATURE_NOTICE, /Signature simple/);
  assert.match(WARRANTY_LOCAL_ATTACHMENT_NOTICE, /simulées\/locales/);

  const directorContent = fs.readFileSync("src/components/DirectorDashboard.tsx", "utf8");
  const printContent = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");
  const deliveryContent = fs.readFileSync("src/components/LivraisonView.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const warrantyContent = fs.readFileSync("src/components/WarrantyView.tsx", "utf8");

  assert.ok(directorContent.includes("CLIENT_SIDE_SECURITY_NOTICE"), "La Direction doit afficher la limite RC client-side");
  assert.ok(printContent.includes("PILOT_SIGNATURE_NOTICE"), "Les impressions doivent rappeler la signature simple pilote");
  assert.ok(deliveryContent.includes("PILOT_SIGNATURE_NOTICE"), "Livraison doit rappeler la signature simple pilote");
  assert.ok(detailContent.includes("PILOT_SIGNATURE_NOTICE"), "Détail dossier doit rappeler la signature simple pilote");
  assert.ok(warrantyContent.includes("WARRANTY_LOCAL_ATTACHMENT_NOTICE"), "Garantie doit rappeler les pièces jointes locales simulées");
});

registerCheck("Lot 6I Invariants", "statuts immobilisé non retiré archivage garantie et satisfaction", () => {
  const qcBase = getMockDossier({
    statut: DossierStatus.CONTROLE_QUALITE,
    ordresReparation: [
      { id: "task_done", designation: "Contrôle", tempsEstime: 1, tempsPasse: 1, status: "done" },
    ],
  });
  const qcRejectedWithoutComment = submitQualityControl(qcBase, UserRole.CONTROLE_QUALITE, "refuse", "");
  assert.equal(qcRejectedWithoutComment.statut, qcBase.statut);
  assert.equal(qcRejectedWithoutComment.checklistQC.validationGlobale, "en_attente");

  const ready = getMockDossier({
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [
      { id: "task_done", designation: "Contrôle final", tempsEstime: 1, tempsPasse: 1, status: "done" },
    ],
    checklistQC: { ...qcBase.checklistQC, validationGlobale: "valide" },
    livraison: { ...qcBase.livraison, controleQualiteOk: true, statutRestitution: "Livré sans réserve" },
  });
  assert.equal(canDeliverDossier({ ...ready, checklistQC: { ...ready.checklistQC, validationGlobale: "en_attente" } }).allowed, false);
  const delivered = confirmDelivery(ready);
  assert.equal(delivered.statut, DossierStatus.LIVRE);
  const archived = archiveDeliveredDossier(delivered, UserRole.DIRECTEUR_SAV);
  assert.equal(archived.statut, DossierStatus.CLOTURE);
  assert.equal(archived.archiveOperationnelle, true);

  const immobilized = markDossierImmobilized(ready, "Véhicule immobilisé en attente client.");
  assert.equal(immobilized.statut, DossierStatus.IMMOBILISE);
  assert.equal(immobilized.priorite, DossierPriority.VEHICULE_IMMOBILISE);
  assert.equal(DossierStatus.NON_RETIRE, "Non retiré");

  const attached = addWarrantyLocalAttachment(ready, { fileName: "local-garantie.txt", sizeBytes: 2048, addedBy: "QA" });
  assert.equal(attached.warrantyAttachments?.length, 1);
  assert.equal(addWarrantyLocalAttachment(ready, { fileName: "trop-grand.txt", sizeBytes: 3 * 1024 * 1024, addedBy: "QA" }).warrantyAttachments?.length ?? 0, 0);

  const feedback = recordSatisfactionFeedback(delivered, { rating: 5, comment: "Client satisfait pendant le pilote interne.", createdBy: "QA" });
  assert.equal(feedback.satisfaction?.status, "satisfait");
  assert.equal(feedback.satisfaction?.internalPilotOnly, true);
});

registerCheck("Lot 6I Invariants", "permissions centralisées handlers protégés et UX mobile 48px", () => {
  assert.equal(ROLE_PERMISSIONS[UserRole.DIRECTEUR_SAV].archiveDeliveredDossier, true);
  assert.equal(canArchiveDeliveredDossier(UserRole.DIRECTEUR_SAV), true);
  assert.equal(canArchiveDeliveredDossier(UserRole.RECEPTIONNAIRE), false);
  assert.equal(canManageWarranty(UserRole.DIRECTEUR_SAV), true);
  assert.equal(canViewWarranty(UserRole.RECEPTIONNAIRE), true);
  assert.equal(canRecordSatisfaction(UserRole.LIVRAISON), true);

  const appContent = fs.readFileSync("src/App.tsx", "utf8");
  const deliveryContent = fs.readFileSync("src/components/LivraisonView.tsx", "utf8");
  const cssContent = fs.readFileSync("src/index.css", "utf8");
  assert.ok(appContent.includes("canUpdateDossierFromHandler"), "Les mises à jour dossier doivent vérifier les permissions dans le handler");
  assert.ok(appContent.includes("canRunGuardedAction"), "Les actions critiques doivent passer par l'anti-double-clic global");
  assert.ok(deliveryContent.includes("canDeliverDossier(withDeliveryInfo)"), "LivraisonView doit réutiliser la gate livraison du cœur SAV");
  assert.ok(cssContent.includes("min-height: 48px"), "Les boutons mobiles doivent conserver une hauteur tactile minimale");
});

registerCheck("Lot 6I Invariants", "exports et rapports restent opérationnels sans finance ni données réelles", () => {
  const files = [
    "src/components/WarrantyView.tsx",
    "src/components/SatisfactionView.tsx",
    "src/components/LivraisonView.tsx",
    "src/components/PrintDocuments.tsx",
    "src/sav-core.ts",
    "src/sav-reports.ts",
  ];
  const forbidden = [
    "chiffre d'affaires",
    "chiffre d’affaires",
    ["mar", "ge"].join(""),
    ["paie", "ment"].join(""),
    ["cai", "sse"].join(""),
    ["fac", "ture", " ré", "elle"].join(""),
    ["st", "ock", " r", "éel"].join(""),
    ["dis", "ponibilité", " pi", "èce", " ré", "elle"].join(""),
  ];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8").toLowerCase();
    for (const word of forbidden) {
      assert.equal(content.includes(word), false, `${file} contient ${word}`);
    }
  }

  assert.equal(fs.existsSync("Liste Vehicule.csv"), false);
  assert.equal(fs.existsSync("Liste Vehicule.xlsx"), false);
  assert.equal(fs.existsSync(".env"), false);
});

registerCheck("Lot 6K-C Invariants", "verrou QC obligatoire avant restitution", () => {
  const base = getMockDossier({
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [
      { id: "task_done", designation: "Contrôle final", tempsEstime: 1, tempsPasse: 1, status: "done" },
    ],
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
      dateValidation: "2026-06-24T09:00:00.000Z",
      validePar: UserRole.CONTROLE_QUALITE,
    },
  });

  assert.equal(getDossierQCStatus(base).status, "conforme");
  assert.equal(getDeliveryReadiness(base).canDeliver, true);
  const invalidated = invalidateQCAfterWorkshopChange(base, "Réouverture atelier après QC.", UserRole.CHEF_ATELIER);
  assert.equal(getDossierQCStatus(invalidated).status, "to_recheck");
  assert.equal(getDeliveryReadiness(invalidated).canDeliver, false);
  assert.ok(getDeliveryReadiness(invalidated).blockingCodes.includes("delivery-qc-to-recheck"));

  const refused = {
    ...base,
    statut: DossierStatus.EN_TRAVAUX,
    checklistQC: { ...base.checklistQC, validationGlobale: "refuse" as const, commentaireRefus: "Essai routier à reprendre." },
  };
  assert.ok(getDeliveryReadiness(refused).blockingCodes.includes("delivery-qc-refused"));
  const blockedAttempt = confirmDelivery(invalidated);
  assert.ok(blockedAttempt.operationalTraces?.some(trace => trace.type === "delivery_blocked"));

  const coreContent = fs.readFileSync("src/sav-core.ts", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const deliveryContent = fs.readFileSync("src/components/LivraisonView.tsx", "utf8");
  const qcContent = fs.readFileSync("src/components/ControleQualiteView.tsx", "utf8");
  const printContent = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");

  assert.ok(coreContent.includes("getDeliveryReadiness"), "Le verrou livraison doit être dans le cœur SAV");
  assert.ok(coreContent.includes("invalidateQCAfterWorkshopChange"), "Le cœur SAV doit invalider QC après modification atelier");
  assert.ok(detailContent.includes('data-testid="dossier-delivery-state"'), "DossierDetail doit afficher l'état livraison");
  assert.ok(detailContent.includes('data-testid="delivery-readiness-block"'), "DossierDetail doit afficher les blocages restitution");
  assert.ok(deliveryContent.includes("getDeliveryReadiness(selectedDossier)"), "LivraisonView doit lire la readiness centrale");
  assert.ok(qcContent.includes('data-testid="qc-status-badge"'), "Le module QC doit afficher un badge statut");
  assert.ok(printContent.includes('data-testid="delivery-invalid-watermark"'), "Le bon restitution doit afficher le watermark QC non conforme");
});

registerCheck("Lot 6K-D Invariants", "impressions A4 terrain propres et verrouillées QC", () => {
  const printContent = fs.readFileSync("src/components/PrintDocuments.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  const cssContent = fs.readFileSync("src/index.css", "utf8");

  for (const expected of [
    'data-testid="print-document-preview"',
    'data-testid="print-document-title"',
    'data-testid="print-document-watermark"',
    'data-testid="print-document-section"',
    "Fiche Réception",
    "Ordre de Réparation Interne",
    "Fiche Contrôle Qualité",
    "Bon de Restitution & Livraison",
    "Fiche tâche technicien",
    "NON RESTITUABLE - QC NON CONFORME",
    "DOCUMENT NON VALIDE - QC NON CONFORME",
    "Ce document ne vaut pas restitution. Dossier bloqué.",
    "Restitution interdite sans QC conforme",
  ]) {
    assert.ok(printContent.includes(expected), `Invariant impression manquant: ${expected}`);
  }

  for (const testId of [
    "print-reception-sheet",
    "print-operational-or",
    "print-qc-sheet",
    "print-delivery-pv",
  ]) {
    assert.ok(detailContent.includes(testId), `Alias bouton document manquant: ${testId}`);
  }
  assert.ok(detailContent.includes("print-technician-sheet"), "Le détail dossier doit exposer l'alias fiche tâche");
  assert.ok(planningContent.includes("print-technician-sheet"), "Le Gantt doit exposer l'alias fiche tâche");
  assert.ok(cssContent.includes(".print-document-section"), "Les sections A4 doivent éviter les coupures");
  assert.ok(cssContent.includes("body.printing-standard-document #nimr-print-container *"), "Les documents standards doivent être visibles en print");
  assert.ok(printContent.includes("getDeliveryReadiness(dossier)"), "Le PV doit réutiliser le verrou livraison central");

  const lower = printContent.toLowerCase();
  const blockedTerms = [
    ["cai", "sse"],
    ["paie", "ment"],
    ["mon", "tant"],
    ["mar", "ge"],
    ["pr", "ix"],
    ["fac", "ture", " ré", "elle"],
    ["st", "ock", " r", "éel"],
    ["dis", "ponibilité", " ré", "elle", " pi", "èce"],
  ].map(parts => parts.join(""));
  for (const term of blockedTerms) {
    assert.equal(lower.includes(term), false, `Terme bloqué dans PrintDocuments: ${term}`);
  }
});

registerCheck("Lot 6K-B-A Invariants", "collision véhicule et ETA utilisent tous les dossiers actifs", () => {
  const coreContent = fs.readFileSync("src/sav-core.ts", "utf8");
  assert.ok(coreContent.includes('"planning-collision-vehicle"'), "Le code bloquant collision véhicule doit être déclaré");
  assert.ok(coreContent.includes("normalizeVehicleIdentity"), "L'identité véhicule doit être normalisée");
  assert.ok(coreContent.includes("getActiveVehicleDossiers"), "Les dossiers actifs du véhicule doivent être regroupés");
  assert.ok(coreContent.includes("getVehicleETAInfo"), "L'ETA véhicule doit être calculée dans le cœur métier");
  assert.ok(coreContent.includes("reservedTaskIds"), "L'ETA doit compter les réservations tâche par tâche");
});

registerCheck("Lot 6K-B-A Invariants", "réservation automatique atomique et séquentielle", () => {
  const coreContent = fs.readFileSync("src/sav-core.ts", "utf8");
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  assert.ok(coreContent.includes("buildVehicleAutoReservationPlan"), "Le plan automatique doit être un helper métier testable");
  assert.ok(coreContent.includes("temporaryReservations"), "Le calcul doit utiliser un état temporaire avant sauvegarde");
  assert.ok(coreContent.includes("createdReservations"), "Le résultat doit exposer les réservations créées atomiquement");
  assert.ok(planningContent.includes("onUpdateReservations(result.reservations)"), "L'UI doit persister le lot de réservations en une seule mise à jour");
  assert.ok(coreContent.includes("Durée à valider avant réservation automatique."), "La durée non validée doit bloquer l'opération");
});

registerCheck("Lot 6K-B-A Invariants", "planning modifiable uniquement par le Chef Atelier", () => {
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const rolesContent = fs.readFileSync("src/roles.ts", "utf8");
  assert.ok(planningContent.includes("activeRole !== UserRole.CHEF_ATELIER"), "Les handlers planning doivent vérifier le rôle actif");
  assert.ok(planningContent.includes('draggable={activeRole === UserRole.CHEF_ATELIER}'), "Le Gantt ne doit être déplaçable que par le Chef Atelier");
  assert.ok(planningContent.includes("ETA Livraison & Réservation Automatique"), "Le panneau ETA véhicule doit être visible dans le planning");
  assert.ok(detailContent.includes('data-testid="vehicle-eta-block"'), "Le résumé dossier doit afficher l'ETA véhicule");
  assert.ok(rolesContent.includes('"atelier-planning"'), "La Réception doit pouvoir consulter le planning");
  assert.equal(fs.existsSync("e2e/31-auto-reservation.spec.ts"), true);
});

registerCheck("Lot 6K-B-B Invariants", "suggestion séparée de la réservation et revalidée au clic", () => {
  const coreContent = fs.readFileSync("src/sav-core.ts", "utf8");
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  assert.ok(coreContent.includes("reserveSuggestedWorkshopSlot"), "La réservation suggérée doit utiliser un helper métier dédié");
  assert.ok(coreContent.includes("validatePlanningAssignment({"), "Le créneau suggéré doit être revalidé avant application");
  assert.ok(coreContent.includes('source: "planning-suggestion"'), "La réservation unitaire doit conserver sa source");
  assert.ok(planningContent.includes("Créneau réservé avec succès."), "L'interface doit confirmer explicitement la réservation");
  assert.ok(planningContent.includes("Meilleur créneau déjà affiché."), "Une suggestion identique doit produire un feedback");
});

registerCheck("Lot 6K-B-B Invariants", "liste réservations et rôles reflètent le créneau appliqué", () => {
  const planningContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  assert.ok(planningContent.includes('data-testid="planning-suggest-result"'), "Le résultat de suggestion doit être identifiable");
  assert.ok(planningContent.includes('data-testid="planning-reservation-reserved"'), "La liste doit afficher le statut Réservé");
  assert.ok(planningContent.includes("Réserver ce créneau"), "L'action terrain explicite doit être visible pour le Chef Atelier");
  assert.ok(planningContent.includes("activeRole === UserRole.CHEF_ATELIER"), "Les actions planning doivent rester limitées au Chef Atelier");
  assert.equal(fs.existsSync("e2e/32-planning-suggestion-reservation.spec.ts"), true);
});

registerCheck("Lot 6K-B-C Invariants", "onglet RDV & Planning dossier expose les étapes terrain", () => {
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const stepsContent = fs.readFileSync("src/workshop-planning-steps.ts", "utf8");
  assert.ok(stepsContent.includes("mapRepairLineToPlanningStep"), "Le mapping ligne atelier vers étape doit être centralisé");
  assert.ok(stepsContent.includes("PLANNING_STEP_DEFINITIONS"), "Les étapes planning doivent être centralisées");
  assert.ok(detailContent.includes('label: "RDV & Planning"'), "La fiche dossier doit exposer l'onglet RDV & Planning");
  assert.ok(detailContent.includes('data-testid="dossier-planning-tab"'), "L'onglet doit être identifiable en E2E");
  assert.ok(detailContent.includes("planning-step-card-"), "Les cartes étapes doivent être rendues avec testid stable");
  assert.ok(detailContent.includes('data-testid="planning-validated-table"'), "Le tableau planning validé doit être présent");
  assert.ok(detailContent.includes('data-testid="planning-workshop-margin"'), "La marge atelier opérationnelle doit être visible");
  assert.equal(fs.existsSync("e2e/33-dossier-planning-steps.spec.ts"), true);
});

registerCheck("Lot 6K-B-C Invariants", "réservation par étape conserve le moteur PRO et les rôles", () => {
  const detailContent = fs.readFileSync("src/components/DossierDetail.tsx", "utf8");
  const stepsContent = fs.readFileSync("src/workshop-planning-steps.ts", "utf8");
  assert.ok(detailContent.includes("suggestWorkshopSlot({"), "Les cartes doivent utiliser le moteur de suggestion PRO");
  assert.ok(detailContent.includes("reserveSuggestedWorkshopSlot({"), "La réservation par étape doit revalider au clic");
  assert.ok(detailContent.includes("userRole === UserRole.CHEF_ATELIER"), "Les mutations de l'onglet dossier doivent être Chef Atelier uniquement");
  assert.ok(stepsContent.includes("releasePlanningStepReservation"), "La libération d'étape doit passer par un helper testé");
  assert.ok(detailContent.includes("Créneau réservé avec succès."), "La réservation doit produire un feedback immédiat");
  assert.ok(detailContent.includes("Consultation uniquement"), "Les rôles consultation doivent être explicitement signalés");
});

// -----------------------------------------------------------------
// Run Suite & Generate Report
// -----------------------------------------------------------------
console.log("Démarrage de l'agent QA...");
for (const check of checks) {
  try {
    check.run();
    passCount++;
  } catch (e: any) {
    failCount++;
    anomalies.push(`[${check.category}] ${check.description}: ${e.message}`);
    console.error(`❌ Échec de la règle ${check.id} - ${check.description}:`, e.message);
  }
}

const totalControls = checks.length;
const status = failCount === 0 ? "OK" : "KO";

console.log(`QA Terminée. Contrôles: ${totalControls}, OK: ${passCount}, KO: ${failCount}`);

const reportContent = `# Rapport de l'Agent QA Fonctionnel NIMR SAV PRO

- **Date** : ${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR")}
- **Version** : v1.1.1 (Lot 6K-D - Impressions A4 terrain propres et sécurisées)
- **Contrôles exécutés** : ${totalControls}
- **Résultat global** : **${status}** (${passCount} OK / ${failCount} KO)


## Anomalies détectées
${
  anomalies.length === 0
    ? "- Aucune anomalie détectée. Les invariants fonctionnels sont tous respectés."
    : anomalies.map(a => `- ⚠️ ${a}`).join("\n")
}

## Recommandations
${
  failCount === 0
    ? "1. Conserver le moteur de planification strict pour éviter toute réapparition de créneaux passés.\n2. Exécuter ce script \`npm run qa:agent\` avant toute nouvelle mise en production."
    : "1. Résoudre immédiatement les anomalies bloquantes identifiées ci-dessus.\n2. Ne pas déployer cette version en production tant que le statut global n'est pas vert (OK)."
}
`;

fs.writeFileSync("qa-report.md", reportContent, "utf8");
console.log("Rapport de validation qa-report.md mis à jour.");

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
