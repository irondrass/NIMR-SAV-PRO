import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  suggestWorkshopSlot,
  validatePlanningAssignment,
  calculateTechnicianDailyLoad,
  canDeliverDossier,
  startRepairOrder,
} from "../src/sav-core";
import {
  canAccessTab,
  canManageUsers,
  isReadOnlyRole,
} from "../src/permissions";
import {
  getVehicleAggregatedStatus,
  searchVehiclesAndDossiers,
  getVehicleKey,
} from "../src/vehicle-status.js";
import {
  AtelierZone,
  DossierPriority,
  DossierSAV,
  DossierStatus,
  InterventionType,
  TechnicienResource,
  UserRole,
  WorkshopBay,
} from "../src/types";

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
  const fileContent = fs.readFileSync("src/components/WorkshopPlanning.tsx", "utf8");
  assert.ok(fileContent.includes("gantt-task-status-pending"));
  assert.ok(fileContent.includes("gantt-task-status-in-progress"));
  assert.ok(fileContent.includes("gantt-task-status-paused"));
  assert.ok(fileContent.includes("gantt-task-status-blocked"));
  assert.ok(fileContent.includes("gantt-task-status-done"));
  assert.ok(fileContent.includes("gantt-task-status-reopened"));
  assert.ok(fileContent.includes("gantt-status-legend"));
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
- **Version** : v1.1.0 (Lot 5E - Statut Planning & Recherche Véhicule)
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
