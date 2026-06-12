/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import {
  canManageUsers,
  createDefaultUsers,
  createSession,
  createUser,
  hashPin,
  isSessionValid,
  loginUser,
  resetUserPin,
  setUserActive,
  updateUserProfile,
  verifyPin,
  resetLoginAttempts,
} from "../src/auth";
import {
  addPhotoToDossier,
  assignTechnicianToDossier,
  canDeliverDossier,
  canSavePlanningAssignment,
  confirmDelivery,
  createBackupPayload,
  createReceptionDossier,
  finishRepairOrder,
  getDossierOperationalBucket,
  getVisibleTechnicianTasks,
  isArchivedOrErpReadyDossier,
  isDossierSAV,
  isOperationalActiveDossier,
  markReadyForBilling,
  parseStoredArray,
  releaseRepairOrderBlock,
  removePhotoFromDossier,
  reopenRepairOrder,
  startRepairOrder,
  submitQualityControl,
  shouldShowDossierForTechnician,
  suggestWorkshopSlot,
  validateBackupPayload,
  isWorkingDay,
  getWorkingWindowsForDate,
  alignToWorkingTime,
  addWorkingMinutes,
  buildPlanningSegments,
  detectTechnicianCollision,
  detectBayCollision,
  calculateTechnicianDailyLoad,
  validatePlanningAssignment,
} from "../src/sav-core";
import { APP_BASE_URL, APP_CACHE_NAME, APP_NAME, APP_VERSION } from "../src/app-identity";
import { buildDirectorDashboardKpis } from "../src/dashboard-kpis";
import { INITIAL_ACTIVITE_LOGS, INITIAL_DOSSIERS, INITIAL_RECLAMATIONS, MOCK_TECHNICIENS } from "../src/data";
import { canAccessTab, canChangeRole, getDefaultTabForRole, normalizeTabForRole, ROLE_TABS } from "../src/roles";
import * as perm from "../src/permissions";
import { LOCAL_STORAGE_PREFIX, STORAGE_KEYS } from "../src/storage-keys";
import { AtelierZone, DossierPriority, DossierSAV, DossierStatus, InterventionType, RepairOrderLine, TechnicienResource, UserRole, WorkshopBay } from "../src/types";

const fixedNow = new Date("2026-06-09T10:00:00.000Z");

function createReceptionFixture(existingIds = ["NIMR-2026-001", "NIMR-2026-005"]) {
  return createReceptionDossier({
    clientNom: "  Client Test  ",
    clientTelephone: "+216 20 000 000",
    deposantNom: "",
    deposantTelephone: "",
    vehiculeMarque: "Forthing",
    vehiculeModele: "T5 EVO",
    vehiculeImmatriculation: "000 TU 0999",
    vehiculeVIN: "",
    vehiculeKilometrage: 32000,
    vehiculeCouleur: "Noir",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.URGENTE,
    plainteClient: "Bruit train avant",
    observationsReception: "",
    photosAvant: [
      {
        id: "photo_test",
        url: "https://example.test/photo.jpg",
        title: "Face avant",
        date: "2026-06-09",
        category: "réception avant",
      },
    ],
    niveauCarburant: 140,
    etatCarrosserie: {
      rayures: true,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: "",
    },
    objetsLaisses: ["Carte grise"],
  }, existingIds, fixedNow);
}

function completeAllRepairOrders(dossier: DossierSAV): DossierSAV {
  return {
    ...dossier,
    ordresReparation: dossier.ordresReparation.map(line => ({
      ...line,
      status: "done",
      tempsPasse: Math.max(line.tempsPasse, line.tempsEstime),
    })),
    avancementGlobal: 100,
  };
}

function createReadyForDeliveryFixture(): DossierSAV {
  const completed = completeAllRepairOrders(createReceptionFixture());
  return submitQualityControl(completed, UserRole.CHEF_ATELIER, "valide", "", fixedNow);
}

function testReceptionCreation() {
  const dossier = createReceptionFixture();

  assert.equal(dossier.id, "NIMR-2026-006");
  assert.equal(dossier.clientNom, "Client Test");
  assert.equal(dossier.deposantNom, "Client Test");
  assert.equal(dossier.vehiculeVIN, "17-VIN-PLACEHOLDER");
  assert.equal(dossier.niveauCarburant, 100);
  assert.equal(dossier.statut, DossierStatus.VEHICULE_RECU);
  assert.equal(dossier.dateReception, fixedNow.toISOString());
  assert.equal(dossier.dateSouhaiteeLivraison, "2026-06-11T10:00:00.000Z");
  assert.equal(dossier.photosAvant[0].takenBy, "Conseiller Client NIMR");
  assert.equal(dossier.photosAvant[0].category, "réception avant");
  assert.equal(dossier.ordresReparation.length, 2);
  assert.ok(dossier.ordresReparation.every(line => line.id.startsWith("ro_auto_")));
  assert.ok(dossier.ordresReparation.every(line => line.status === "pending"));
}

function testTechnicianAssignment() {
  const dossier = createReceptionFixture(["NIMR-2026-001"]);
  const assigned = assignTechnicianToDossier(dossier, "tech_02", fixedNow);

  assert.equal(assigned.technicienId, "tech_02");
  assert.equal(assigned.statut, DossierStatus.EN_TRAVAUX);
  assert.equal(assigned.dateDernierStatut, fixedNow.toISOString());
  assert.match(assigned.prochaineActionRecommended, /ordres de travaux/i);
}

function testQualityControl() {
  const dossier = assignTechnicianToDossier(createReceptionFixture(), "tech_01", fixedNow);
  const accepted = submitQualityControl(dossier, UserRole.CONTROLE_QUALITE, "valide", "", fixedNow);

  assert.equal(accepted.statut, DossierStatus.PRET_A_LIVRER);
  assert.equal(accepted.checklistQC.validationGlobale, "valide");
  assert.equal(accepted.checklistQC.validePar, UserRole.CONTROLE_QUALITE);
  assert.equal(accepted.bloqueRaison, "");

  const rejected = submitQualityControl(dossier, UserRole.CONTROLE_QUALITE, "refuse", "Voyant ABS", fixedNow);
  assert.equal(rejected.statut, DossierStatus.BLOQUE);
  assert.equal(rejected.checklistQC.validationGlobale, "refuse");
  assert.equal(rejected.bloqueRaison, "Refus qualité: Voyant ABS");
}

function testDeliveryAndBilling() {
  const ready = createReadyForDeliveryFixture();
  const deliveryGate = canDeliverDossier(ready);
  assert.equal(deliveryGate.allowed, true);

  const delivered = confirmDelivery(ready, fixedNow);

  assert.equal(delivered.statut, DossierStatus.LIVRE);
  assert.equal(delivered.livraison.controleQualiteOk, true);
  assert.equal(delivered.livraison.clientInforme, true);
  assert.equal(delivered.livraison.confirmationReceptionClient, true);
  assert.equal(delivered.livraison.dateLivraisonReelle, fixedNow.toISOString());

  const billing = markReadyForBilling(delivered, fixedNow);
  assert.equal(billing.statut, DossierStatus.PRET_FACTURATION);
  assert.match(billing.prochaineActionRecommended, /comptabilité|ERP/i);
}

function testDeliveryGuards() {
  const baseReady = createReadyForDeliveryFixture();

  const withoutQc = { ...baseReady, checklistQC: { ...baseReady.checklistQC, validationGlobale: "en_attente" as const } };
  assert.equal(canDeliverDossier(withoutQc).allowed, false);
  assert.equal(confirmDelivery(withoutQc, fixedNow).statut, DossierStatus.PRET_A_LIVRER);

  const activeTask = {
    ...baseReady,
    ordresReparation: baseReady.ordresReparation.map((line, index) => index === 0 ? { ...line, status: "in_progress" as const } : line),
  };
  assert.equal(canDeliverDossier(activeTask).allowed, false);

  const blockedTask = {
    ...baseReady,
    ordresReparation: baseReady.ordresReparation.map((line, index) => index === 0 ? { ...line, status: "blocked" as const } : line),
  };
  assert.equal(canDeliverDossier(blockedTask).allowed, false);

  const qcRejected = {
    ...baseReady,
    checklistQC: { ...baseReady.checklistQC, validationGlobale: "refuse" as const },
    statut: DossierStatus.BLOQUE,
    bloqueRaison: "Refus qualité",
  };
  assert.equal(canDeliverDossier(qcRejected).allowed, false);

  const delivered = confirmDelivery(baseReady, fixedNow);
  assert.equal(canDeliverDossier(delivered).allowed, false);
}

function testImportExportValidation() {
  const backup = createBackupPayload(INITIAL_DOSSIERS, INITIAL_RECLAMATIONS, MOCK_TECHNICIENS, INITIAL_ACTIVITE_LOGS);
  const validated = validateBackupPayload(backup);

  assert.equal(validated.ok, true);
  if (validated.ok) {
    assert.equal(validated.data.dossiers?.length, INITIAL_DOSSIERS.length);
    assert.equal(validated.data.techList?.length, MOCK_TECHNICIENS.length);
  }

  const invalid = validateBackupPayload({ dossiers: [{ id: "cassé" }] });
  assert.equal(invalid.ok, false);

  const deliveredWithActiveTask = {
    ...createReadyForDeliveryFixture(),
    statut: DossierStatus.LIVRE,
    ordresReparation: createReadyForDeliveryFixture().ordresReparation.map((line, index) => (
      index === 0 ? { ...line, status: "in_progress" as const } : line
    )),
  };
  const invalidDelivered = validateBackupPayload(createBackupPayload([deliveredWithActiveTask], [], [], []));
  assert.equal(invalidDelivered.ok, false);
  if (!invalidDelivered.ok) assert.match(invalidDelivered.error, /tâches atelier non terminées/i);

  const readyWithQcRefused = {
    ...createReadyForDeliveryFixture(),
    checklistQC: { ...createReadyForDeliveryFixture().checklistQC, validationGlobale: "refuse" as const },
  };
  const invalidReady = validateBackupPayload(createBackupPayload([readyWithQcRefused], [], [], []));
  assert.equal(invalidReady.ok, false);
  if (!invalidReady.ok) assert.match(invalidReady.error, /prêt à livrer incohérent/i);

  const parsed = parseStoredArray(JSON.stringify(INITIAL_DOSSIERS), [], isDossierSAV);
  assert.equal(parsed.usedFallback, false);
  assert.equal(parsed.items.length, INITIAL_DOSSIERS.length);

  const fallback = parseStoredArray("pas du json", INITIAL_DOSSIERS, isDossierSAV);
  assert.equal(fallback.usedFallback, true);
  assert.equal(fallback.items, INITIAL_DOSSIERS);
}

function testPhotoMutationsAndImportExport() {
  const dossier = createReceptionFixture();
  const added = addPhotoToDossier(dossier, {
    id: "photo_km",
    url: "data:image/jpeg;base64,AAAA",
    title: "Compteur 32000 km",
    date: fixedNow.toISOString(),
    takenBy: "Réceptionnaire Test",
    category: "kilométrage",
    mimeType: "image/jpeg",
    sizeBytes: 3,
  }, fixedNow);

  assert.equal(added.photosAvant.length, dossier.photosAvant.length + 1);
  assert.equal(added.photosAvant.at(-1)?.category, "kilométrage");
  assert.match(added.historiqueLogs?.[0] ?? "", /Photo ajoutée/);

  const backup = createBackupPayload([added], [], [], []);
  const validation = validateBackupPayload(JSON.parse(JSON.stringify(backup)));
  assert.equal(validation.ok, true);
  if (validation.ok) {
    assert.equal(validation.data.dossiers?.[0].photosAvant.at(-1)?.title, "Compteur 32000 km");
    assert.equal(validation.data.dossiers?.[0].photosAvant.at(-1)?.category, "kilométrage");
  }

  const removed = removePhotoFromDossier(added, "photo_km", fixedNow);
  assert.equal(removed.photosAvant.some(photo => photo.id === "photo_km"), false);
  assert.match(removed.historiqueLogs?.[0] ?? "", /Photo supprimée/);
}

function createTaskDossier(id: string, technicianId: string, lines: RepairOrderLine[]): DossierSAV {
  return {
    ...createReceptionFixture([]),
    id,
    technicienId: technicianId,
    statut: DossierStatus.EN_TRAVAUX,
    ordresReparation: lines,
  };
}

function createLine(id: string, status: RepairOrderLine["status"]): RepairOrderLine {
  return {
    id,
    designation: `Tâche ${id}`,
    tempsEstime: 1,
    tempsPasse: status === "done" ? 1 : 0,
    status,
  };
}

function testTaskLockingSameDossier() {
  const dossier = createTaskDossier("NIMR-LOCK-001", "tech_01", [
    createLine("line_running", "in_progress"),
    createLine("line_pending", "pending"),
  ]);
  const result = startRepairOrder([dossier], dossier.id, "line_pending", fixedNow);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Une tâche est déjà en cours pour ce dossier.");
}

function testTaskLockingSameTechnician() {
  const first = createTaskDossier("NIMR-LOCK-TECH-001", "tech_01", [createLine("line_running", "in_progress")]);
  const second = createTaskDossier("NIMR-LOCK-TECH-002", "tech_01", [createLine("line_pending", "pending")]);
  const result = startRepairOrder([first, second], second.id, "line_pending", fixedNow);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Ce technicien a déjà une tâche en cours.");
}

function testTaskCannotStartWithoutTechnician() {
  const dossier = createTaskDossier("NIMR-NO-TECH-001", "", [createLine("line_pending", "pending")]);
  const result = startRepairOrder([dossier], dossier.id, "line_pending", fixedNow);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Affecter un technicien avant de démarrer la tâche.");
}

function testDoneTaskCannotRestart() {
  const dossier = createTaskDossier("NIMR-DONE-001", "tech_01", [createLine("line_done", "done")]);
  const result = startRepairOrder([dossier], dossier.id, "line_done", fixedNow);

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /réouverte/);
}

function testReopenDoneTaskByWorkshopChief() {
  const dossier = createTaskDossier("NIMR-REOPEN-001", "tech_01", [createLine("line_done", "done")]);
  const result = reopenRepairOrder([dossier], dossier.id, "line_done", UserRole.CHEF_ATELIER, "Retouche après QC", fixedNow);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.line.status, "reopened");
    assert.equal(result.line.reopenedReason, "Retouche après QC");
    assert.match(result.dossier.historiqueLogs?.[0] ?? "", /Retouche après QC/);
  }
}

function testTechnicianCannotReopenDoneTask() {
  const dossier = createTaskDossier("NIMR-REOPEN-002", "tech_01", [createLine("line_done", "done")]);
  const result = reopenRepairOrder([dossier], dossier.id, "line_done", UserRole.TECHNICIEN, "Retouche", fixedNow);

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Directeur SAV|Chef Atelier/);
}

function testFinishRequiresInProgress() {
  const dossier = createTaskDossier("NIMR-FINISH-001", "tech_01", [createLine("line_blocked", "blocked")]);
  const result = finishRepairOrder([dossier], dossier.id, "line_blocked", fixedNow);

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /en cours/);
}

function testBlockedTaskRequiresUnblockBeforeRestart() {
  const dossier = createTaskDossier("NIMR-BLOCK-001", "tech_01", [createLine("line_blocked", "blocked")]);
  const startBlocked = startRepairOrder([dossier], dossier.id, "line_blocked", fixedNow);

  assert.equal(startBlocked.ok, false);
  if (!startBlocked.ok) assert.match(startBlocked.error, /Lever le blocage/);

  const noReason = releaseRepairOrderBlock([dossier], dossier.id, "line_blocked", UserRole.CHEF_ATELIER, "", fixedNow);
  assert.equal(noReason.ok, false);

  const released = releaseRepairOrderBlock([dossier], dossier.id, "line_blocked", UserRole.CHEF_ATELIER, "Pièce reçue", fixedNow);
  assert.equal(released.ok, true);
  if (released.ok) {
    assert.equal(released.line.status, "paused");
    assert.match(released.line.history?.[0] ?? "", /Pièce reçue/);
    assert.equal(released.dossier.bloqueRaison, "");
  }
}

function testOperationalVisibilityHelpers() {
  const activeDossier = createTaskDossier("NIMR-ACTIVE-VIEW", "tech_01", [
    createLine("line_pending", "pending"),
    createLine("line_running", "in_progress"),
    createLine("line_paused", "paused"),
    createLine("line_blocked", "blocked"),
    createLine("line_reopened", "reopened"),
    createLine("line_done", "done"),
  ]);

  assert.equal(isOperationalActiveDossier(activeDossier), true);
  assert.equal(isArchivedOrErpReadyDossier(activeDossier), false);
  assert.equal(getDossierOperationalBucket(activeDossier), "active");
  assert.deepEqual(
    getVisibleTechnicianTasks(activeDossier, "tech_01").map(line => line.id),
    ["line_pending", "line_running", "line_paused", "line_blocked", "line_reopened"]
  );
  assert.equal(shouldShowDossierForTechnician(activeDossier, "tech_01"), true);

  const doneOnlyDossier = createTaskDossier("NIMR-DONE-VIEW", "tech_01", [createLine("line_done_only", "done")]);
  assert.equal(shouldShowDossierForTechnician(doneOnlyDossier, "tech_01"), false);

  const readyForBilling = { ...activeDossier, statut: DossierStatus.PRET_FACTURATION };
  const delivered = { ...activeDossier, statut: DossierStatus.LIVRE };
  const closed = { ...activeDossier, statut: DossierStatus.CLOTURE };

  assert.equal(isOperationalActiveDossier(readyForBilling), false);
  assert.equal(isOperationalActiveDossier(delivered), false);
  assert.equal(isOperationalActiveDossier(closed), false);
  assert.equal(isArchivedOrErpReadyDossier(readyForBilling), true);
  assert.equal(getDossierOperationalBucket(readyForBilling), "ready_for_billing");
  assert.equal(getDossierOperationalBucket(delivered), "delivered");
  assert.equal(getDossierOperationalBucket(closed), "closed");
  assert.equal(shouldShowDossierForTechnician(readyForBilling, "tech_01"), false);
  assert.equal(getVisibleTechnicianTasks(delivered, "tech_01").length, 0);
}

function testWorkshopSlotSuggestionFirstTechnicianAndBay() {
  const technicians: TechnicienResource[] = [
    { ...MOCK_TECHNICIENS[0], id: "tech_busy", nom: "Tech chargé", disponibilite: "disponible", chargeActuelle: 4 },
    { ...MOCK_TECHNICIENS[1], id: "tech_free", nom: "Tech libre", disponibilite: "disponible", chargeActuelle: 1 },
  ];
  const bays: WorkshopBay[] = [
    { id: "bay_01", name: "Pont 1" },
    { id: "bay_02", name: "Pont 2" },
  ];
  const desiredDate = new Date("2026-06-10T08:00:00");
  const suggestion = suggestWorkshopSlot({
    dossiers: [],
    technicians,
    workshopBays: bays,
    estimatedHours: 1,
    desiredDate,
  }, desiredDate);

  assert.equal(suggestion.technicianId, "tech_free");
  assert.equal(suggestion.bayId, "bay_01");
}

function testWorkshopSlotSuggestionLunchBreak() {
  const technicians: TechnicienResource[] = [
    { ...MOCK_TECHNICIENS[0], id: "tech_lunch", nom: "Tech midi", disponibilite: "disponible", chargeActuelle: 0 },
  ];
  const desiredDate = new Date("2026-06-10T11:30:00");
  const suggestion = suggestWorkshopSlot({
    dossiers: [],
    technicians,
    workshopBays: [{ id: "bay_01", name: "Pont 1" }],
    estimatedHours: 1,
    desiredDate,
  }, desiredDate);
  const start = new Date(suggestion.startTime);
  const end = new Date(suggestion.endTime);

  assert.equal(start.getHours(), 11);
  assert.equal(start.getMinutes(), 30);
  assert.equal(end.getHours(), 13);
  assert.equal(end.getMinutes(), 30);
  assert.equal(suggestion.segments.length, 2);
  assert.equal(new Date(suggestion.segments[0].end).getHours(), 12);
  assert.equal(new Date(suggestion.segments[1].start).getHours(), 13);
}

function testWorkshopSlotSuggestionNextWorkingDayWhenSaturated() {
  const technicians: TechnicienResource[] = [
    { ...MOCK_TECHNICIENS[0], id: "tech_full_1", disponibilite: "disponible", chargeActuelle: 8 },
    { ...MOCK_TECHNICIENS[1], id: "tech_full_2", disponibilite: "disponible", chargeActuelle: 8 },
  ];
  const desiredDate = new Date("2026-06-10T09:00:00");
  const suggestion = suggestWorkshopSlot({
    dossiers: [],
    technicians,
    workshopBays: [{ id: "bay_01", name: "Pont 1" }],
    estimatedHours: 1,
    desiredDate,
  }, desiredDate);
  const start = new Date(suggestion.startTime);

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 5);
  assert.equal(start.getDate(), 11);
  assert.equal(start.getHours(), 8);
}

function testRoleTabsAndPermissions() {
  assert.equal(getDefaultTabForRole(UserRole.DIRECTEUR_SAV), "dashboard");
  assert.equal(getDefaultTabForRole(UserRole.RECEPTIONNAIRE), "reception-rapide");
  assert.equal(getDefaultTabForRole(UserRole.TECHNICIEN), "tech-view");
  assert.equal(getDefaultTabForRole(UserRole.LIVRAISON), "dossiers-liste");

  assert.equal(canAccessTab(UserRole.CHEF_ATELIER, "chef-atelier"), true);
  assert.equal(canAccessTab(UserRole.CHEF_ATELIER, "parametres"), false);
  assert.equal(canAccessTab(UserRole.TECHNICIEN, "dossiers-liste"), false);
  assert.equal(canAccessTab(UserRole.CONTROLE_QUALITE, "atelier-kanban"), true);
  assert.equal(canAccessTab(UserRole.RECEPTIONNAIRE, "reception-rapide"), true);
  assert.equal(canAccessTab(UserRole.DIRECTEUR_SAV, "users"), true);
  assert.equal(canAccessTab(UserRole.RECEPTIONNAIRE, "users"), false);
  assert.equal(canAccessTab(UserRole.LIVRAISON, "dossiers-liste"), true);
  assert.equal(canAccessTab(UserRole.LIVRAISON, "dashboard"), false);

  assert.equal(normalizeTabForRole(UserRole.TECHNICIEN, "dashboard"), "tech-view");
  assert.equal(normalizeTabForRole(UserRole.RECEPTIONNAIRE, "parametres"), "reception-rapide");

  assert.equal(canChangeRole(UserRole.DIRECTEUR_SAV), true);
  assert.equal(canChangeRole(UserRole.CHEF_ATELIER), false);
  assert.equal(canChangeRole(UserRole.TECHNICIEN), false);

  for (const role of Object.values(UserRole)) {
    assert.ok(ROLE_TABS[role].length > 0, `${role} must have at least one tab`);
  }
}

function testStorageKeysUseNewPrefixOnly() {
  assert.equal(LOCAL_STORAGE_PREFIX, "nimr-sav-pro");

  const values = Object.values(STORAGE_KEYS);
  assert.equal(new Set(values).size, values.length);
  assert.equal(STORAGE_KEYS.users, "nimr-sav-pro-users");
  assert.equal(STORAGE_KEYS.session, "nimr-sav-pro-session");
  assert.equal((values as readonly string[]).includes("nimr-sav-pro-user-role-v1"), false);
  const oldUnderscorePrefix = ["nimr", "sav"].join("_");
  const oldHyphenPrefix = ["nimr", "sav"].join("-");

  for (const key of values) {
    assert.match(key, /^nimr-sav-pro-/);
    assert.equal(key.includes(oldUnderscorePrefix), false);
    assert.equal(key.startsWith("nimr-sav-") && !key.startsWith("nimr-sav-pro-"), false);
  }

  const oldKeys = [
    `${oldUnderscorePrefix}_dossiers`,
    `${oldUnderscorePrefix}_reclamations`,
    `${oldUnderscorePrefix}_techs`,
    `${oldUnderscorePrefix}_logs`,
    `${oldHyphenPrefix}-dossiers`,
    `${oldHyphenPrefix}-settings`,
    `${oldHyphenPrefix}-role`,
    `${oldHyphenPrefix}-theme`,
  ];
  assert.equal(values.some(key => oldKeys.some(oldKey => key.startsWith(oldKey))), false);
}

function testApplicationIdentityVersion() {
  assert.equal(APP_NAME, "NIMR SAV PRO");
  assert.equal(APP_VERSION, "1.1.0");
  assert.equal(APP_BASE_URL, "/NIMR-SAV-PRO/");
  assert.equal(LOCAL_STORAGE_PREFIX, "nimr-sav-pro");
  assert.equal(APP_CACHE_NAME, "nimr-sav-pro-v1.1.0");
}

function testAdvancedPlanningHelpers() {
  // 1. isWorkingDay
  const monday = new Date(2026, 5, 15, 10, 0, 0); // Monday
  const saturday = new Date(2026, 5, 20, 10, 0, 0); // Saturday
  const sunday = new Date(2026, 5, 21, 10, 0, 0); // Sunday
  assert.equal(isWorkingDay(monday), true);
  assert.equal(isWorkingDay(saturday), true);
  assert.equal(isWorkingDay(sunday), false);

  // 2. Lunch break scission (Tâche 11:00 + 3h => segments 11:00-12:00 et 13:00-15:00)
  const taskStart = new Date(2026, 5, 15, 11, 0, 0);
  const taskEnd = addWorkingMinutes(taskStart, 3 * 60); // 3 hours
  assert.equal(taskEnd.getHours(), 15);
  assert.equal(taskEnd.getMinutes(), 0);

  const segments = buildPlanningSegments(taskStart, taskEnd);
  assert.equal(segments.length, 2);
  
  const seg0Start = new Date(segments[0].start);
  const seg0End = new Date(segments[0].end);
  assert.equal(seg0Start.getHours(), 11);
  assert.equal(seg0Start.getMinutes(), 0);
  assert.equal(seg0End.getHours(), 12);
  assert.equal(seg0End.getMinutes(), 0);

  const seg1Start = new Date(segments[1].start);
  const seg1End = new Date(segments[1].end);
  assert.equal(seg1Start.getHours(), 13);
  assert.equal(seg1Start.getMinutes(), 0);
  assert.equal(seg1End.getHours(), 15);
  assert.equal(seg1End.getMinutes(), 0);

  // 3. Saturday morning accepted, afternoon shifted
  const satStart = new Date(2026, 5, 20, 9, 0, 0); // Saturday 09:00
  const satEnd1 = addWorkingMinutes(satStart, 2 * 60); // 2 hours
  assert.equal(satEnd1.getHours(), 11);
  assert.equal(satEnd1.getMinutes(), 0);

  const satEnd2 = addWorkingMinutes(satStart, 4 * 60); // 4 hours -> Sat 9:00 to 12:00 (3h) and Mon 8:00 to 9:00 (1h)
  assert.equal(satEnd2.getDay(), 1); // Monday
  assert.equal(satEnd2.getHours(), 9);
  assert.equal(satEnd2.getMinutes(), 0);

  // 4. Sunday closed (shifted to Monday 08:00)
  const sunStart = new Date(2026, 5, 21, 10, 0, 0); // Sunday
  const sunAligned = alignToWorkingTime(sunStart);
  assert.equal(sunAligned.getDay(), 1); // Monday
  assert.equal(sunAligned.getHours(), 8);
  assert.equal(sunAligned.getMinutes(), 0);

  // 5. Collision and daily load tests
  const planStart = new Date(2026, 5, 15, 9, 0, 0);
  const planEnd = new Date(2026, 5, 15, 11, 0, 0);
  const mockDossiers: DossierSAV[] = [
    {
      ...createReceptionFixture([]),
      id: "NIMR-PLAN-001",
      statut: DossierStatus.TRAVAUX_PLANIFIES,
      ordresReparation: [
        {
          id: "ro_1",
          designation: "Tâche 1",
          tempsEstime: 2,
          tempsPasse: 0,
          status: "pending",
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_01",
          planningDate: "2026-06-15",
          planningStart: planStart.toISOString(),
          planningEnd: planEnd.toISOString(),
          planningSegments: buildPlanningSegments(planStart, planEnd)
        }
      ]
    }
  ];

  // Collision tech_01 on Monday 10:00-12:00
  const hasTechCollision = detectTechnicianCollision(
    mockDossiers, 
    "tech_01", 
    new Date(2026, 5, 15, 10, 0, 0), 
    new Date(2026, 5, 15, 12, 0, 0)
  );
  assert.equal(hasTechCollision, true);

  // No collision on Monday 11:00-12:00
  const noTechCollision = detectTechnicianCollision(
    mockDossiers, 
    "tech_01", 
    new Date(2026, 5, 15, 11, 0, 0), 
    new Date(2026, 5, 15, 12, 0, 0)
  );
  assert.equal(noTechCollision, false);

  // Collision bay_01
  const hasBayCollision = detectBayCollision(
    mockDossiers, 
    "bay_01", 
    new Date(2026, 5, 15, 10, 0, 0), 
    new Date(2026, 5, 15, 12, 0, 0)
  );
  assert.equal(hasBayCollision, true);

  // Daily load
  const load = calculateTechnicianDailyLoad("tech_01", "2026-06-15", mockDossiers);
  assert.equal(load, 2);

  const splitLoadStart = new Date(2026, 5, 15, 11, 0, 0);
  const splitLoadEnd = addWorkingMinutes(splitLoadStart, 3 * 60);
  const splitLoadDossier: DossierSAV = {
    ...createReceptionFixture([]),
    id: "NIMR-PLAN-SPLIT",
    statut: DossierStatus.TRAVAUX_PLANIFIES,
    ordresReparation: [
      {
        ...createLine("line_split_load", "pending"),
        tempsEstime: 3,
        plannedTechnicianId: "tech_02",
        planningDate: "2026-06-15",
        planningStart: splitLoadStart.toISOString(),
        planningEnd: splitLoadEnd.toISOString(),
        planningSegments: buildPlanningSegments(splitLoadStart, splitLoadEnd),
      }
    ]
  };
  assert.equal(calculateTechnicianDailyLoad("tech_02", "2026-06-15", [splitLoadDossier]), 3);

  const planningTechCollision = validatePlanningAssignment({
    dossiers: mockDossiers,
    dossierId: "NIMR-PLAN-NEW",
    lineId: "ro_new",
    technicianId: "tech_01",
    bayId: "bay_02",
    start: new Date(2026, 5, 15, 10, 0, 0),
    end: new Date(2026, 5, 15, 11, 0, 0),
  });
  assert.equal(planningTechCollision.allowed, false);
  assert.ok(planningTechCollision.codes.includes("planning-collision-tech"));

  const planningBayCollision = validatePlanningAssignment({
    dossiers: mockDossiers,
    dossierId: "NIMR-PLAN-NEW",
    lineId: "ro_new",
    technicianId: "tech_02",
    bayId: "bay_01",
    start: new Date(2026, 5, 15, 10, 0, 0),
    end: new Date(2026, 5, 15, 11, 0, 0),
  });
  assert.equal(planningBayCollision.allowed, false);
  assert.ok(planningBayCollision.codes.includes("planning-collision-bay"));

  const saturatedDossier: DossierSAV = {
    ...createReceptionFixture([]),
    id: "NIMR-PLAN-SATURATED",
    statut: DossierStatus.TRAVAUX_PLANIFIES,
    ordresReparation: [
      {
        ...createLine("line_saturated", "pending"),
        tempsEstime: 8,
        plannedTechnicianId: "tech_03",
        plannedBayId: "bay_03",
        planningDate: "2026-06-15",
        planningStart: new Date(2026, 5, 15, 8, 0, 0).toISOString(),
        planningEnd: new Date(2026, 5, 15, 17, 0, 0).toISOString(),
        planningSegments: buildPlanningSegments(new Date(2026, 5, 15, 8, 0, 0), new Date(2026, 5, 15, 17, 0, 0)),
      }
    ]
  };
  const planningOverload = validatePlanningAssignment({
    dossiers: [saturatedDossier],
    dossierId: "NIMR-PLAN-NEW",
    lineId: "ro_new",
    technicianId: "tech_03",
    bayId: "bay_04",
    start: new Date(2026, 5, 15, 16, 0, 0),
    end: new Date(2026, 5, 15, 17, 0, 0),
  });
  assert.equal(planningOverload.allowed, false);
  assert.ok(planningOverload.codes.includes("planning-collision-overload"));

  const saturdayAfternoon = validatePlanningAssignment({
    dossiers: [],
    dossierId: "NIMR-PLAN-SATURDAY",
    lineId: "ro_sat",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: new Date(2026, 5, 20, 13, 0, 0),
    end: new Date(2026, 5, 20, 14, 0, 0),
  });
  assert.equal(saturdayAfternoon.allowed, false);
  assert.ok(saturdayAfternoon.codes.includes("planning-collision-saturday-afternoon"));

  const sundayClosed = validatePlanningAssignment({
    dossiers: [],
    dossierId: "NIMR-PLAN-SUNDAY",
    lineId: "ro_sun",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: new Date(2026, 5, 21, 9, 0, 0),
    end: new Date(2026, 5, 21, 10, 0, 0),
  });
  assert.equal(sundayClosed.allowed, false);
  assert.ok(sundayClosed.codes.includes("planning-collision-sunday"));

  const lunchSplit = {
    dossiers: [],
    dossierId: "NIMR-PLAN-LUNCH",
    lineId: "ro_lunch",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: taskStart,
    end: taskEnd,
  };
  assert.equal(canSavePlanningAssignment(lunchSplit), true);

  const invalidLunchBlock = validatePlanningAssignment({
    ...lunchSplit,
    planningSegments: [{ start: taskStart.toISOString(), end: taskEnd.toISOString() }],
  });
  assert.equal(invalidLunchBlock.allowed, false);
  assert.ok(invalidLunchBlock.codes.includes("planning-collision-lunch"));
}

function createDashboardKpiFixtures(): DossierSAV[] {
  const readyLine: RepairOrderLine = {
    id: "kpi_ready_line",
    designation: "Diagnostic et réparation",
    tempsEstime: 2,
    tempsPasse: 2,
    status: "done",
    plannedTechnicianId: "tech_01",
    plannedBayId: "bay_01",
    planningDate: "2026-06-11",
    planningStart: "2026-06-11T08:00:00.000Z",
    planningEnd: "2026-06-11T10:00:00.000Z",
    planningSegments: [
      { start: "2026-06-11T08:00:00.000Z", end: "2026-06-11T10:00:00.000Z" },
    ],
    history: [
      "2026-06-11T10:00:00.000Z - Tâche terminée.",
      "2026-06-11T08:00:00.000Z - Tâche démarrée.",
    ],
  };

  const ready = {
    ...createReadyForDeliveryFixture(),
    id: "NIMR-KPI-READY",
    clientNom: "Client KPI prêt",
    dateReception: "2026-06-11T07:00:00.000Z",
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [readyLine],
    checklistQC: {
      ...createReadyForDeliveryFixture().checklistQC,
      validationGlobale: "valide" as const,
      dateValidation: "2026-06-11T10:30:00.000Z",
    },
  };

  const delivered = {
    ...ready,
    id: "NIMR-KPI-DELIVERED",
    clientNom: "Client KPI livré",
    statut: DossierStatus.LIVRE,
    livraison: {
      ...ready.livraison,
      dateLivraisonReelle: "2026-06-11T11:00:00.000Z",
      clotureInterne: true,
    },
  };

  const readyForErp = {
    ...delivered,
    id: "NIMR-KPI-ERP",
    clientNom: "Client KPI clôture",
    dateReception: "2026-06-10T08:00:00.000Z",
    statut: DossierStatus.PRET_FACTURATION,
  };

  const open = {
    ...createReceptionFixture([]),
    id: "NIMR-KPI-OPEN",
    clientNom: "Client KPI ouvert",
    dateReception: "2026-06-11T08:15:00.000Z",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [createLine("kpi_open_line", "pending")],
  };

  const inProgress = {
    ...createReceptionFixture([]),
    id: "NIMR-KPI-RUNNING",
    clientNom: "Client KPI travaux",
    dateReception: "2026-06-11T08:30:00.000Z",
    statut: DossierStatus.EN_TRAVAUX,
    technicienId: "tech_01",
    ordresReparation: [
      {
        ...createLine("kpi_running_line", "in_progress"),
        tempsEstime: 4,
        tempsPasse: 1,
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_01",
        planningDate: "2026-06-11",
        planningStart: "2026-06-11T08:00:00.000Z",
        planningEnd: "2026-06-11T13:00:00.000Z",
        planningSegments: [
          { start: "2026-06-11T08:00:00.000Z", end: "2026-06-11T12:00:00.000Z" },
          { start: "2026-06-11T12:00:00.000Z", end: "2026-06-11T13:00:00.000Z" },
        ],
        history: ["2026-06-11T08:00:00.000Z - Tâche démarrée."],
      },
    ],
  };

  const blocked = {
    ...createReceptionFixture([]),
    id: "NIMR-KPI-BLOCKED",
    clientNom: "Client KPI bloqué",
    dateReception: "2026-06-11T08:45:00.000Z",
    statut: DossierStatus.BLOQUE,
    bloqueRaison: "Attente pièce validée atelier",
    ordresReparation: [
      {
        ...createLine("kpi_blocked_line", "blocked"),
        plannedTechnicianId: "tech_02",
        plannedBayId: "bay_02",
        planningDate: "2026-06-11",
        planningStart: "2026-06-11T08:00:00.000Z",
        planningEnd: "2026-06-11T09:00:00.000Z",
      },
    ],
  };

  const qcRejected = {
    ...createReceptionFixture([]),
    id: "NIMR-KPI-QC-REFUSED",
    clientNom: "Client KPI QC refusé",
    dateReception: "2026-06-09T09:00:00.000Z",
    statut: DossierStatus.BLOQUE,
    bloqueRaison: "Refus qualité: voyant ABS",
    ordresReparation: [{ ...readyLine, id: "kpi_refused_line" }],
    checklistQC: {
      ...createReadyForDeliveryFixture().checklistQC,
      validationGlobale: "refuse" as const,
      commentaireRefus: "Voyant ABS",
      dateValidation: "2026-06-09T12:00:00.000Z",
    },
    historiqueLogs: ["2026-06-09T12:00:00.000Z - Refus qualité: voyant ABS"],
  };

  const overdue = {
    ...createReceptionFixture([]),
    id: "NIMR-KPI-LATE",
    clientNom: "Client KPI retard",
    dateReception: "2026-06-10T09:00:00.000Z",
    statut: DossierStatus.TRAVAUX_PLANIFIES,
    technicienId: "tech_02",
    ordresReparation: [
      {
        ...createLine("kpi_late_line", "pending"),
        tempsEstime: 3,
        plannedTechnicianId: "tech_02",
        plannedBayId: "bay_02",
        planningDate: "2026-06-10",
        planningStart: "2026-06-10T08:00:00.000Z",
        planningEnd: "2026-06-10T11:00:00.000Z",
      },
    ],
  };

  return [open, inProgress, blocked, ready, delivered, readyForErp, qcRejected, overdue];
}

function testDirectorDashboardKpis() {
  const now = new Date("2026-06-11T10:00:00.000Z");
  const dossiers = createDashboardKpiFixtures();
  const kpis = buildDirectorDashboardKpis({
    dossiers,
    techniciens: MOCK_TECHNICIENS,
    filters: { period: "all", now },
  });

  assert.equal(kpis.activity.openDossiers, 6);
  assert.equal(kpis.activity.inProgressDossiers, 1);
  assert.equal(kpis.activity.blockedDossiers, 2);
  assert.equal(kpis.activity.readyToDeliverDossiers, 1);
  assert.equal(kpis.activity.deliveredDossiers, 1);
  assert.equal(kpis.activity.readyForErpDossiers, 1);
  assert.equal(kpis.activity.pendingErpClosureDossiers, 1);

  assert.equal(kpis.quality.qcAccepted, 3);
  assert.equal(kpis.quality.qcRefused, 1);
  assert.equal(kpis.quality.firstTimeRightCount, 3);
  assert.equal(kpis.quality.firstTimeRightRate, 75);
  assert.equal(kpis.quality.refusalReasons[0].reason, "Voyant ABS");

  assert.ok(kpis.workshop.technicianLoad.some(load => load.id === "tech_01" && load.hours > 0));
  assert.ok(kpis.workshop.bayLoad.some(load => load.id === "bay_01" && load.hours > 0));
  assert.ok(kpis.workshop.lateTasks.some(task => task.dossierId === "NIMR-KPI-LATE"));
  assert.ok(kpis.alerts.some(alert => alert.title === "Dossier bloqué critique"));
  assert.ok(kpis.alerts.some(alert => alert.title === "Dossier en retard planning"));

  const today = buildDirectorDashboardKpis({
    dossiers,
    techniciens: MOCK_TECHNICIENS,
    filters: { period: "today", now },
  });
  const week = buildDirectorDashboardKpis({
    dossiers,
    techniciens: MOCK_TECHNICIENS,
    filters: { period: "week", now },
  });
  const month = buildDirectorDashboardKpis({
    dossiers,
    techniciens: MOCK_TECHNICIENS,
    filters: { period: "month", now },
  });
  assert.equal(today.filteredDossiers.length, 5);
  assert.equal(week.filteredDossiers.length, dossiers.length);
  assert.equal(month.filteredDossiers.length, dossiers.length);

  const techFilter = buildDirectorDashboardKpis({
    dossiers,
    techniciens: MOCK_TECHNICIENS,
    filters: { period: "all", technicianId: "tech_02", now },
  });
  assert.ok(techFilter.filteredDossiers.every(dossier =>
    dossier.technicienId === "tech_02" || dossier.ordresReparation.some(line => line.plannedTechnicianId === "tech_02")
  ));

  assert.ok(kpis.delays.some(delay => delay.label === "Réception → début travaux" && delay.averageMs !== null));
  const missingDelay = buildDirectorDashboardKpis({
    dossiers: [createReceptionFixture([])],
    techniciens: MOCK_TECHNICIENS,
    filters: { period: "all", now },
  });
  assert.equal(missingDelay.delays.find(delay => delay.label === "Cycle complet dossier")?.value, "Non mesurable");

  const serialized = JSON.stringify(kpis);
  const forbidden = [
    /chiffre d’affaires/i,
    /\bCA\b/,
    /paiement/i,
    /caisse/i,
    /stock pièces/i,
    /marge/i,
    /facture payée/i,
    /facturable/i,
    /rentabilité/i,
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(serialized), false, `Forbidden dashboard term found: ${pattern}`);
  }
  assert.match(serialized, /Prêt facturation ERP/);
  assert.match(serialized, /En attente clôture ERP/);
}

async function testLocalUsersAndSessions() {
  const now = new Date("2026-06-11T08:00:00.000Z");
  const users = await createDefaultUsers(now);

  assert.equal(users.length, 7);
  assert.equal(users.some(user => user.username === "directeur" && user.role === UserRole.DIRECTEUR_SAV), true);
  assert.equal(users.some(user => user.username === "livraison" && user.role === UserRole.LIVRAISON), true);
  assert.notEqual(users.find(user => user.username === "directeur")?.pinHash, "0000");
  assert.match(users.find(user => user.username === "directeur")?.pinHash ?? "", /^sha256:/);

  const directorLogin = await loginUser(users, "directeur", "0000", now);
  assert.equal(directorLogin.ok, true);
  if (!directorLogin.ok) throw new Error("Director login should succeed");
  assert.equal(directorLogin.user.displayName, "Directeur Démo SAV");
  assert.equal(directorLogin.session.role, UserRole.DIRECTEUR_SAV);
  assert.equal(isSessionValid(directorLogin.session, directorLogin.users, now), true);

  const wrongPin = await loginUser(users, "directeur", "9999", now);
  assert.equal(wrongPin.ok, false);
  if (!wrongPin.ok) assert.equal(wrongPin.reason, "invalid-credentials");

  const disabledUsers = users.map(user => user.username === "technicien" ? { ...user, active: false } : user);
  const disabledLogin = await loginUser(disabledUsers, "technicien", "3333", now);
  assert.equal(disabledLogin.ok, false);
  if (!disabledLogin.ok) assert.equal(disabledLogin.reason, "disabled-user");

  const session = createSession(directorLogin.user, now);
  assert.equal(isSessionValid(session, directorLogin.users, now), true);
  assert.equal(isSessionValid(null, directorLogin.users, now), false);

  // TTL expiration tests
  assert.equal(isSessionValid(session, directorLogin.users, new Date(now.getTime() + 7 * 60 * 60 * 1000)), true); // 7h
  assert.equal(isSessionValid(session, directorLogin.users, new Date(now.getTime() + 9 * 60 * 60 * 1000)), false); // 9h

  // Rate limiting tests
  // Reset memory storage before tests to ensure isolation
  resetLoginAttempts();
  const cleanUsers = await createDefaultUsers(now);
  // Fail 4 times
  for (let i = 0; i < 4; i++) {
    const res = await loginUser(cleanUsers, "directeur", "wrong_pin", now);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "invalid-credentials");
  }
  // 5th failure -> locked out
  const lockoutRes = await loginUser(cleanUsers, "directeur", "wrong_pin", now);
  assert.equal(lockoutRes.ok, false);
  assert.equal(lockoutRes.reason, "locked-out");

  // Even correct PIN is locked out
  const correctLocked = await loginUser(cleanUsers, "directeur", "0000", now);
  assert.equal(correctLocked.ok, false);
  assert.equal(correctLocked.reason, "locked-out");

  // Lockout expires after 5 minutes
  const afterLockoutNow = new Date(now.getTime() + 6 * 60 * 1000); // 6 mins
  const correctUnlocked = await loginUser(cleanUsers, "directeur", "0000", afterLockoutNow);
  assert.equal(correctUnlocked.ok, true);

  assert.equal(canManageUsers(UserRole.DIRECTEUR_SAV), true);
  assert.equal(canManageUsers(UserRole.RECEPTIONNAIRE), false);

  const created = await createUser({
    username: "controle-test",
    displayName: "Contrôle Test",
    role: UserRole.CONTROLE_QUALITE,
    pin: "2468",
  }, directorLogin.users, now);
  assert.equal(created.username, "controle-test");
  assert.equal(await verifyPin(created, "2468"), true);
  assert.equal(created.pinHash, await hashPin(created.username, "2468"));

  const withNewUser = [...directorLogin.users, created];
  const roleUpdate = updateUserProfile(
    withNewUser,
    created.id,
    { displayName: "Contrôle Modifié", role: UserRole.LIVRAISON },
    directorLogin.user.id,
    now
  );
  assert.equal(roleUpdate.ok, true);
  if (roleUpdate.ok) {
    const updated = roleUpdate.users.find(user => user.id === created.id);
    assert.equal(updated?.displayName, "Contrôle Modifié");
    assert.equal(updated?.role, UserRole.LIVRAISON);
    assert.equal(canAccessTab(updated!.role, "dossiers-liste"), true);
    assert.equal(canAccessTab(updated!.role, "users"), false);
  }

  const selfRoleUpdate = updateUserProfile(
    directorLogin.users,
    directorLogin.user.id,
    { displayName: directorLogin.user.displayName, role: UserRole.LECTURE_SEULE },
    directorLogin.user.id,
    now
  );
  assert.equal(selfRoleUpdate.ok, false);

  const lastDirectorToggle = setUserActive(directorLogin.users, directorLogin.user.id, false, now);
  assert.equal(lastDirectorToggle.ok, false);
  if (!lastDirectorToggle.ok) assert.match(lastDirectorToggle.message, /dernier Directeur/i);

  const reset = await resetUserPin(withNewUser, created.id, "1357", now);
  assert.equal(reset.ok, true);
  if (reset.ok) {
    const updated = reset.users.find(user => user.id === created.id);
    assert.equal(await verifyPin(updated!, "1357"), true);
    assert.equal(await verifyPin(updated!, "2468"), false);
  }
}

function testCentralizedPermissions() {
  // canManageUsers
  assert.equal(perm.canManageUsers(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canManageUsers(UserRole.CHEF_ATELIER), false);
  assert.equal(perm.canManageUsers(UserRole.RECEPTIONNAIRE), false);

  // canCreateDossier
  assert.equal(perm.canCreateDossier(UserRole.RECEPTIONNAIRE), true);
  assert.equal(perm.canCreateDossier(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canCreateDossier(UserRole.CHEF_ATELIER), false);

  // canEditDossier
  assert.equal(perm.canEditDossier(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canEditDossier(UserRole.CHEF_ATELIER), true);
  assert.equal(perm.canEditDossier(UserRole.RECEPTIONNAIRE), true);
  assert.equal(perm.canEditDossier(UserRole.LIVRAISON), true);
  assert.equal(perm.canEditDossier(UserRole.TECHNICIEN), false);

  // canForceStatus
  assert.equal(perm.canForceStatus(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canForceStatus(UserRole.CHEF_ATELIER), false);

  // canPlanWorkshop
  assert.equal(perm.canPlanWorkshop(UserRole.CHEF_ATELIER), true);
  assert.equal(perm.canPlanWorkshop(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canPlanWorkshop(UserRole.TECHNICIEN), false);

  // canStartTask
  assert.equal(perm.canStartTask(UserRole.TECHNICIEN), true);
  assert.equal(perm.canStartTask(UserRole.CHEF_ATELIER), true);
  assert.equal(perm.canStartTask(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canStartTask(UserRole.LECTURE_SEULE), false);

  // canBlockTask
  assert.equal(perm.canBlockTask(UserRole.TECHNICIEN), true);
  assert.equal(perm.canBlockTask(UserRole.CHEF_ATELIER), true);
  assert.equal(perm.canBlockTask(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canBlockTask(UserRole.LECTURE_SEULE), false);

  // canReleaseBlock
  assert.equal(perm.canReleaseBlock(UserRole.CHEF_ATELIER), true);
  assert.equal(perm.canReleaseBlock(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canReleaseBlock(UserRole.TECHNICIEN), false);

  // canReopenTask
  assert.equal(perm.canReopenTask(UserRole.CHEF_ATELIER), true);
  assert.equal(perm.canReopenTask(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canReopenTask(UserRole.TECHNICIEN), false);

  // canValidateQC
  assert.equal(perm.canValidateQC(UserRole.CONTROLE_QUALITE), true);
  assert.equal(perm.canValidateQC(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canValidateQC(UserRole.CHEF_ATELIER), true);

  // canDeliver
  assert.equal(perm.canDeliver(UserRole.LIVRAISON), true);
  assert.equal(perm.canDeliver(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canDeliver(UserRole.RECEPTIONNAIRE), true);

  // canImportData
  assert.equal(perm.canImportData(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canImportData(UserRole.CHEF_ATELIER), false);

  // canExportData
  assert.equal(perm.canExportData(UserRole.DIRECTEUR_SAV), true);
  assert.equal(perm.canExportData(UserRole.CHEF_ATELIER), true);
  assert.equal(perm.canExportData(UserRole.LIVRAISON), false);

  // isReadOnlyRole
  assert.equal(perm.isReadOnlyRole(UserRole.LECTURE_SEULE), true);
  assert.equal(perm.isReadOnlyRole(UserRole.DIRECTEUR_SAV), false);
}

function testLot5DNewPlanningRules() {
  const technicians: TechnicienResource[] = [
    { id: "tech_01", nom: "Salah", specialite: "Diagnostic", disponibilite: "disponible", compétences: [], zoneAffectee: AtelierZone.ELECTRICITE_DIAG, absencesConges: [], capaciteJournaliere: 8, chargeActuelle: 0 },
  ];
  const workshopBays: WorkshopBay[] = [
    { id: "bay_01", name: "Pont 1", zone: AtelierZone.ELECTRICITE_DIAG },
  ];

  // 1. Suggestion rule: now = 09:53, desired date today -> suggestion >= 10:00
  const nowMock = new Date("2026-06-12T09:53:00");
  const suggestion = suggestWorkshopSlot({
    dossiers: [],
    technicians,
    workshopBays,
    estimatedHours: 2.5,
    desiredDate: new Date("2026-06-12T08:00:00"),
  }, nowMock);

  const start = new Date(suggestion.startTime);
  const end = new Date(suggestion.endTime);

  // Suggested starting slot must be exactly 10:00:00 local time
  assert.equal(start.getHours(), 10);
  assert.equal(start.getMinutes(), 0);

  // 10:00 + 2h30 crosses lunch (12:00-13:00) so segments should be:
  // 10:00-12:00 (2h) and 13:00-13:30 (30m)
  assert.equal(suggestion.segments.length, 2);
  
  const s0Start = new Date(suggestion.segments[0].start);
  const s0End = new Date(suggestion.segments[0].end);
  assert.equal(s0Start.getHours(), 10);
  assert.equal(s0Start.getMinutes(), 0);
  assert.equal(s0End.getHours(), 12);
  assert.equal(s0End.getMinutes(), 0);

  const s1Start = new Date(suggestion.segments[1].start);
  const s1End = new Date(suggestion.segments[1].end);
  assert.equal(s1Start.getHours(), 13);
  assert.equal(s1Start.getMinutes(), 0);
  assert.equal(s1End.getHours(), 13);
  assert.equal(s1End.getMinutes(), 30);

  // 2. Refuses suggestion in the past
  assert.throws(() => {
    suggestWorkshopSlot({
      dossiers: [],
      technicians,
      workshopBays,
      estimatedHours: 1,
      desiredDate: new Date("2026-06-11T08:00:00"),
    }, nowMock);
  }, /Impossible de planifier dans le passé/);

  // 3. validatePlanningAssignment rules
  const dossiers: DossierSAV[] = [
    {
      id: "NIMR-001",
      clientNom: "Client 1",
      clientTelephone: "123",
      deposantNom: "Client 1",
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
      livraison: { controleQualiteOk: false, clientInforme: false, dateLivraisonPrevue: "", remarquesLivraison: "", confirmationReceptionClient: false, clotureInterne: false }
    }
  ];

  // Refuse past time validation
  const pastVal = validatePlanningAssignment({
    dossiers,
    dossierId: "NIMR-001",
    lineId: "task_01",
    technicianId: "tech_01",
    bayId: "bay_01",
    start: "2026-06-12T08:00:00",
    end: "2026-06-12T09:00:00",
    technicians,
    workshopBays,
  }, nowMock);
  assert.equal(pastVal.allowed, false);
  assert.ok(pastVal.codes.includes("planning-in-past"));

  // Refuse non-existent resource validation
  const invalidTechVal = validatePlanningAssignment({
    dossiers,
    dossierId: "NIMR-001",
    lineId: "task_01",
    technicianId: "tech_nonexistent",
    bayId: "bay_01",
    start: "2026-06-12T10:00:00",
    end: "2026-06-12T11:00:00",
    technicians,
    workshopBays,
  }, nowMock);
  assert.equal(invalidTechVal.allowed, false);
  assert.ok(invalidTechVal.codes.includes("planning-tech-not-found"));
}

testReceptionCreation();
testTechnicianAssignment();
testQualityControl();
testDeliveryAndBilling();
testDeliveryGuards();
testImportExportValidation();
testPhotoMutationsAndImportExport();
testTaskLockingSameDossier();
testTaskLockingSameTechnician();
testTaskCannotStartWithoutTechnician();
testDoneTaskCannotRestart();
testReopenDoneTaskByWorkshopChief();
testTechnicianCannotReopenDoneTask();
testFinishRequiresInProgress();
testBlockedTaskRequiresUnblockBeforeRestart();
testOperationalVisibilityHelpers();
testWorkshopSlotSuggestionFirstTechnicianAndBay();
testWorkshopSlotSuggestionLunchBreak();
testWorkshopSlotSuggestionNextWorkingDayWhenSaturated();
testRoleTabsAndPermissions();
testStorageKeysUseNewPrefixOnly();
testApplicationIdentityVersion();
testAdvancedPlanningHelpers();
testDirectorDashboardKpis();
await testLocalUsersAndSessions();
testCentralizedPermissions();
testLot5DNewPlanningRules();

// Run vehicle status tests
import "./vehicle-status.test.js";

console.log("sav-core tests passed");
