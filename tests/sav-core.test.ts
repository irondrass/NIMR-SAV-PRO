/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import {
  addPhotoToDossier,
  assignTechnicianToDossier,
  confirmDelivery,
  createBackupPayload,
  createReceptionDossier,
  finishRepairOrder,
  isDossierSAV,
  markReadyForBilling,
  parseStoredArray,
  removePhotoFromDossier,
  reopenRepairOrder,
  startRepairOrder,
  submitQualityControl,
  suggestWorkshopSlot,
  validateBackupPayload,
} from "../src/sav-core";
import { APP_BASE_URL, APP_CACHE_NAME, APP_NAME, APP_VERSION } from "../src/app-identity";
import { INITIAL_ACTIVITE_LOGS, INITIAL_DOSSIERS, INITIAL_RECLAMATIONS, MOCK_TECHNICIENS } from "../src/data";
import { canAccessTab, canChangeRole, getDefaultTabForRole, normalizeTabForRole, ROLE_TABS } from "../src/roles";
import { LOCAL_STORAGE_PREFIX, STORAGE_KEYS } from "../src/storage-keys";
import { DossierPriority, DossierSAV, DossierStatus, InterventionType, RepairOrderLine, TechnicienResource, UserRole, WorkshopBay } from "../src/types";

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
  const ready = submitQualityControl(createReceptionFixture(), UserRole.CHEF_ATELIER, "valide", "", fixedNow);
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

function testWorkshopSlotSuggestionFirstTechnicianAndBay() {
  const technicians: TechnicienResource[] = [
    { ...MOCK_TECHNICIENS[0], id: "tech_busy", nom: "Tech chargé", disponibilite: "disponible", chargeActuelle: 4 },
    { ...MOCK_TECHNICIENS[1], id: "tech_free", nom: "Tech libre", disponibilite: "disponible", chargeActuelle: 1 },
  ];
  const bays: WorkshopBay[] = [
    { id: "bay_01", name: "Pont 1" },
    { id: "bay_02", name: "Pont 2" },
  ];
  const suggestion = suggestWorkshopSlot({
    dossiers: [],
    technicians,
    workshopBays: bays,
    estimatedHours: 1,
    desiredDate: new Date("2026-06-10T08:00:00"),
  });

  assert.equal(suggestion.technicianId, "tech_free");
  assert.equal(suggestion.bayId, "bay_01");
}

function testWorkshopSlotSuggestionLunchBreak() {
  const technicians: TechnicienResource[] = [
    { ...MOCK_TECHNICIENS[0], id: "tech_lunch", nom: "Tech midi", disponibilite: "disponible", chargeActuelle: 0 },
  ];
  const suggestion = suggestWorkshopSlot({
    dossiers: [],
    technicians,
    workshopBays: [{ id: "bay_01", name: "Pont 1" }],
    estimatedHours: 1,
    desiredDate: new Date("2026-06-10T11:30:00"),
  });
  const start = new Date(suggestion.startTime);
  const end = new Date(suggestion.endTime);

  assert.equal(start.getHours(), 11);
  assert.equal(start.getMinutes(), 30);
  assert.equal(end.getHours(), 13);
  assert.equal(end.getMinutes(), 30);
}

function testWorkshopSlotSuggestionNextWorkingDayWhenSaturated() {
  const technicians: TechnicienResource[] = [
    { ...MOCK_TECHNICIENS[0], id: "tech_full_1", disponibilite: "disponible", chargeActuelle: 8 },
    { ...MOCK_TECHNICIENS[1], id: "tech_full_2", disponibilite: "disponible", chargeActuelle: 8 },
  ];
  const suggestion = suggestWorkshopSlot({
    dossiers: [],
    technicians,
    workshopBays: [{ id: "bay_01", name: "Pont 1" }],
    estimatedHours: 1,
    desiredDate: new Date("2026-06-10T09:00:00"),
  });
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

  assert.equal(canAccessTab(UserRole.CHEF_ATELIER, "chef-atelier"), true);
  assert.equal(canAccessTab(UserRole.CHEF_ATELIER, "parametres"), false);
  assert.equal(canAccessTab(UserRole.TECHNICIEN, "dossiers-liste"), false);
  assert.equal(canAccessTab(UserRole.CONTROLE_QUALITE, "atelier-kanban"), true);
  assert.equal(canAccessTab(UserRole.RECEPTIONNAIRE, "reception-rapide"), true);

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

testReceptionCreation();
testTechnicianAssignment();
testQualityControl();
testDeliveryAndBilling();
testImportExportValidation();
testPhotoMutationsAndImportExport();
testTaskLockingSameDossier();
testTaskLockingSameTechnician();
testDoneTaskCannotRestart();
testReopenDoneTaskByWorkshopChief();
testTechnicianCannotReopenDoneTask();
testFinishRequiresInProgress();
testWorkshopSlotSuggestionFirstTechnicianAndBay();
testWorkshopSlotSuggestionLunchBreak();
testWorkshopSlotSuggestionNextWorkingDayWhenSaturated();
testRoleTabsAndPermissions();
testStorageKeysUseNewPrefixOnly();
testApplicationIdentityVersion();

console.log("sav-core tests passed");
