/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import {
  assignTechnicianToDossier,
  confirmDelivery,
  createBackupPayload,
  createReceptionDossier,
  isDossierSAV,
  markReadyForBilling,
  parseStoredArray,
  submitQualityControl,
  validateBackupPayload,
} from "../src/sav-core";
import { APP_BASE_URL, APP_CACHE_NAME, APP_NAME, APP_VERSION } from "../src/app-identity";
import { INITIAL_ACTIVITE_LOGS, INITIAL_DOSSIERS, INITIAL_RECLAMATIONS, MOCK_TECHNICIENS } from "../src/data";
import { canAccessTab, canChangeRole, getDefaultTabForRole, normalizeTabForRole, ROLE_TABS } from "../src/roles";
import { LOCAL_STORAGE_PREFIX, STORAGE_KEYS } from "../src/storage-keys";
import { DossierPriority, DossierStatus, InterventionType, UserRole } from "../src/types";

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
  assert.equal(dossier.ordresReparation.length, 2);
  assert.ok(dossier.ordresReparation.every(line => line.id.startsWith("ro_auto_")));
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
  assert.equal(APP_VERSION, "1.0.0");
  assert.equal(APP_BASE_URL, "/NIMR-SAV-PRO/");
  assert.equal(LOCAL_STORAGE_PREFIX, "nimr-sav-pro");
  assert.equal(APP_CACHE_NAME, "nimr-sav-pro-v1.0.0");
}

testReceptionCreation();
testTechnicianAssignment();
testQualityControl();
testDeliveryAndBilling();
testImportExportValidation();
testRoleTabsAndPermissions();
testStorageKeysUseNewPrefixOnly();
testApplicationIdentityVersion();

console.log("sav-core tests passed");
