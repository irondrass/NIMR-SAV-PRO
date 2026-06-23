/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lot 5F-3 — Tests E2E : Import Devis & Durées Main-d'œuvre
 * Aucune donnée réelle. Données fictives uniquement.
 */

import { test, expect, Page } from "@playwright/test";
import { changeUserRole, humanClick, humanFill, humanWait } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus, DossierPriority, InterventionType } from "../src/types";

// ──────────────────────────────────────────────────────────────────────────────
// Data fictive de test (aucune donnée réelle)
// ──────────────────────────────────────────────────────────────────────────────

const FICTIF_DEVIS_TEXT = `Vidange + filtre huile 1H
Remplacement plaquettes frein avant 2H
Contrôle géométrie 1H30
Filtre à air 1
Huile moteur 5W40 5L`;

function makeDossierWithPreset(): DossierSAV {
  return createMockDossier({
    id: "NIMR-E2E-5F3-001",
    clientNom: "Client Fictif E2E",
    vehiculeMarque: "Fictif",
    vehiculeModele: "Test 5F3",
    vehiculeImmatriculation: "000 TU 0000",
    vehiculeVIN: "VINFICTIF0000000E2E",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [
      {
        id: "ro_preset_001",
        designation: "Opération initiale: Entretien rapide",
        tempsEstime: 2.5,
        tempsPasse: 0,
        status: "pending",
        estimateSource: "preset",
        isEstimatedDurationValidated: false,
      },
    ],
  });
}

function makeDossierWithManual(): DossierSAV {
  return createMockDossier({
    id: "NIMR-E2E-5F3-002",
    clientNom: "Client Fictif Manuel",
    vehiculeMarque: "Fictif",
    vehiculeModele: "Manuel Test",
    vehiculeImmatriculation: "111 TU 1111",
    vehiculeVIN: "VINFICTIF1111111E2E",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [
      {
        id: "ro_manual_001",
        designation: "Remplacement plaquettes frein (fictif)",
        tempsEstime: 2.0,
        tempsPasse: 0,
        status: "pending",
        estimateSource: "manual",
        isEstimatedDurationValidated: true,
      },
    ],
  });
}

async function seedDossiers(page: Page, dossiers: DossierSAV[]) {
  await page.evaluate(
    ([key, data]) => {
      localStorage.setItem(key, JSON.stringify(data));
    },
    [STORAGE_KEYS.dossiers, dossiers] as [string, DossierSAV[]]
  );
}

async function navigateToDossierRepairOrders(page: Page, dossierId: string) {
  // Navigate to Dossier list tab first
  const dossiersTab = page.locator('[data-testid="nav-dossiers"]');
  if (await dossiersTab.isVisible()) {
    await humanClick(page, dossiersTab);
  }
  await humanWait(page);

  // Click first dossier card that matches ID
  const card = page.locator(`[data-testid="dossier-card-${dossierId}"]`).first();
  if (await card.isVisible()) {
    await humanClick(page, card);
  } else {
    // fallback: click first dossier card available
    await humanClick(page, page.locator("[data-testid^=\"dossier-card-\"]").first());
  }
  await humanWait(page);
  // Navigate to repair orders tab
  const tab = page.locator('[data-testid="tab-repair-orders"]');
  if (await tab.isVisible()) {
    await humanClick(page, tab);
  }
  await humanWait(page);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Lot 5F-3 — Import Devis & Durées MO", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await humanWait(page, 300);
  });

  // ─── Test 1 : Bouton import visible pour Chef Atelier ──────────────────────

  test("19-01 bouton Importer devis/MO visible pour Chef Atelier", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    const importBtn = page.locator('[data-testid="quote-import-button"]');
    await expect(importBtn).toBeVisible();
  });

  // ─── Test 2 : Bouton import visible pour Directeur ─────────────────────────

  test("19-02 bouton Importer devis/MO visible pour Directeur SAV", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-directeur");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    const importBtn = page.locator('[data-testid="quote-import-button"]');
    await expect(importBtn).toBeVisible();
  });

  // ─── Test 3 : Ajouter ligne sans description — bouton désactivé ────────────

  test("19-03 nouveau-task-submit désactivé si description vide", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    const submitBtn = page.locator('[data-testid="new-task-submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  // ─── Test 4 : Ajouter ligne valide ─────────────────────────────────────────

  test("19-04 ajouter ligne manuelle crée une tâche à estimer", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    await humanFill(page, page.locator('[data-testid="new-task-desc"]'), "Remplacement filtres fictifs");
    await expect(page.locator('[data-testid="new-task-time"]')).toHaveValue("À estimer");
    await humanWait(page);

    const submitBtn = page.locator('[data-testid="new-task-submit"]');
    await expect(submitBtn).toBeEnabled();
    await humanClick(page, submitBtn);
    await humanWait(page);

    // New task should appear
    await expect(page.getByText("Remplacement filtifs fictifs", { exact: false }).or(
      page.getByText("REMPLACEMENT FILTRES FICTIFS", { exact: false })
    ).or(page.getByText("Remplacement filtres fictifs", { exact: false }))).toBeVisible({ timeout: 5000 });
  });

  // ─── Test 5 : Ouvrir et fermer modal import ────────────────────────────────

  test("19-05 modal import devis s'ouvre et se ferme", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    const importBtn = page.locator('[data-testid="quote-import-button"]');
    await humanClick(page, importBtn);

    const modal = page.locator('[data-testid="quote-import-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close modal
    const closeBtn = page.locator('[data-testid="quote-import-close"]');
    await humanClick(page, closeBtn);
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  // ─── Test 6 : Analyser devis fictif — MO et pièces détectées ──────────────

  test("19-06 analyse devis fictif — MO et pièces détectées", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).toBeVisible();

    // Paste fictitious quote
    await humanFill(page, page.locator('[data-testid="quote-text-input"]'), FICTIF_DEVIS_TEXT);

    // Analyze
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));
    await humanWait(page, 300);

    // Preview table should be visible
    const previewTable = page.locator('[data-testid="quote-preview-table"]');
    await expect(previewTable).toBeVisible({ timeout: 5000 });

    // Labor lines
    const laborRows = page.locator('[data-testid="quote-line-labor"]');
    await expect(laborRows.first()).toBeVisible();

    // Part lines
    const partRows = page.locator('[data-testid="quote-line-part"]');
    await expect(partRows.first()).toBeVisible();
  });

  // ─── Test 7 : Pièces non cochées par défaut ────────────────────────────────

  test("19-07 pièces non cochées par défaut dans la prévisualisation", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);
    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await humanFill(page, page.locator('[data-testid="quote-text-input"]'), FICTIF_DEVIS_TEXT);
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));
    await humanWait(page, 300);

    // All part lines should have unchecked checkboxes (no checkbox at all = icon dash)
    // The part lines do not have a checkbox input
    const partRows = page.locator('[data-testid="quote-line-part"]');
    const count = await partRows.count();
    for (let i = 0; i < count; i++) {
      const checkbox = partRows.nth(i).locator('input[type="checkbox"]');
      await expect(checkbox).toHaveCount(0); // parts have no checkbox
    }
  });

  // ─── Test 8 : Confirmer import — tâches MO créées ─────────────────────────

  test("19-08 confirmer import crée les tâches MO dans les ordres de travaux", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    const initialTaskCount = await page.locator("[data-testid^=\"task-card-\"]").count();

    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await humanFill(page, page.locator('[data-testid="quote-text-input"]'), FICTIF_DEVIS_TEXT);
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));
    await humanWait(page, 300);

    await expect(page.locator('[data-testid="quote-preview-table"]')).toBeVisible();

    const confirmBtn = page.locator('[data-testid="quote-import-confirm"]');
    await expect(confirmBtn).toBeEnabled();
    await humanClick(page, confirmBtn);
    await humanWait(page, 500);

    // Modal should close or show done step
    const donBtn = page.locator('[data-testid="quote-import-done"]');
    if (await donBtn.isVisible()) {
      await humanClick(page, donBtn);
    }
    await humanWait(page, 300);

    // More tasks should now exist
    const newTaskCount = await page.locator("[data-testid^=\"task-card-\"]").count();
    expect(newTaskCount).toBeGreaterThan(initialTaskCount);
  });

  // ─── Test 9 : Aucun prix/caisse visible dans import ───────────────────────

  test("19-09 aucun champ prix ou paiement visible dans l'interface import", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);
    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await humanFill(page, page.locator('[data-testid="quote-text-input"]'), FICTIF_DEVIS_TEXT);
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));
    await humanWait(page, 300);

    const modalContent = page.locator('[data-testid="quote-import-modal"]');
    const text = await modalContent.textContent();
    const forbidden = [
      ["pr", "ix"].join(""),
      "price",
      ["paie", "ment"].join(""),
      "payment",
      ["cai", "sse"].join(""),
      "stock",
      ["mar", "ge"].join(""),
      "facturation",
      ["mon", "tant"].join(""),
    ];
    for (const kw of forbidden) {
      expect(text?.toLowerCase()).not.toContain(kw);
    }
  });

  // ─── Test 10 : Badge "Durée à valider" visible ─────────────────────────────

  test("19-10 badge 'Durée à valider' visible sur tâche preset", async ({ page }) => {
    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    const presetBadge = page.locator('[data-testid^="task-duration-preset-badge-"]').first();
    await expect(presetBadge).toBeVisible({ timeout: 5000 });
    await expect(presetBadge).toHaveText(/durée.*valider/i);
  });

  // ─── Test 11 : localStorage — aucune clé legacy ───────────────────────────

  test("19-11 aucune clé localStorage legacy (nimr-sav ou nimr_sav)", async ({ page }) => {
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    const keys: string[] = await page.evaluate(() => Object.keys(localStorage));
    const badKeys = keys.filter(k =>
      (k.startsWith("nimr-sav") || k.startsWith("nimr_sav")) && !k.startsWith("nimr-sav-pro")
    );
    expect(badKeys.length, `Legacy keys found: ${badKeys.join(", ")}`).toBe(0);
  });

  // ─── Test 12 : Aucun crash React lors de l'import ─────────────────────────

  test("19-12 aucun crash React lors de l'ouverture et fermeture du modal", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="quote-import-cancel"]'));
    await humanWait(page, 200);

    const reactErrors = errors.filter(e =>
      e.toLowerCase().includes("react") || e.toLowerCase().includes("minified") || e.toLowerCase().includes("cannot read")
    );
    expect(reactErrors.length, `React errors: ${reactErrors.join("\n")}`).toBe(0);
  });

  // ─── Test 13 : Bloc administratif ignoré dans l'import ────────────────────

  test("19-13 bloc administratif ignoré — DFM/CLT/COMET/LUXURY non cochés", async ({ page }) => {
    // Fixtures réalistes : les infos admin (N° OR, VIN, client) se trouvent AVANT le tableau
    // dans un vrai devis PDF NIMR. Le tableau (Désignation...) vient ensuite.
    const DEVIS_AVEC_ADMIN = `DFM FICTIF S50 1.5
CLT-0000
COMET FICTIF SA
LUXURY FICTIF
N° OR: OR-FICTIF-0001
VIN: FICTIFFICTIFFICTIF
Désignation Qté Prix unitaire Montant
entretien 1 33,000 33,000
remp filtre a air 0,3 33,000 9,900
Total DT 42,900`;

    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).toBeVisible();

    await humanFill(page, page.locator('[data-testid="quote-text-input"]'), DEVIS_AVEC_ADMIN);
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));
    await humanWait(page, 500);

    await expect(page.locator('[data-testid="quote-preview-table"]')).toBeVisible({ timeout: 7000 });

    // Les lignes MO doivent être présentes
    const laborRows = page.locator('[data-testid="quote-line-labor"]');
    await expect(laborRows.first()).toBeVisible();
    const laborCount = await laborRows.count();
    expect(laborCount).toBeGreaterThan(0);

    // Les mots administratifs ne doivent pas apparaître dans les DESCRIPTIONS (input values)
    // On cible les descriptions via data-testid="quote-line-desc-*"
    const descInputs = page.locator('[data-testid^="quote-line-desc-"]');
    const descCount = await descInputs.count();
    for (let i = 0; i < descCount; i++) {
      const val = await descInputs.nth(i).inputValue();
      const forbidden = ["DFM", "CLT", "COMET", "LUXURY", "VIN:", "OR-FICTIF"];
      for (const kw of forbidden) {
        expect(val.toUpperCase(), `Desc ${i} contient mot interdit "${kw}": "${val}"`).not.toContain(kw);
      }
    }

    // Fermer le modal
    const closeBtn = page.locator('[data-testid="quote-import-cancel"], [data-testid="quote-import-close"]').first();
    if (await closeBtn.isVisible()) {
      await humanClick(page, closeBtn);
    }
  });

  // ─── Test 14 : Noms propres des tâches dans la prévisualisation ───────────

  test("19-14 noms propres des tâches — aucun prix ni code admin dans les libellés", async ({ page }) => {
    const DEVIS_TABLEAU = `Désignation Qté Prix unitaire Montant
entretien 1 33,000 33,000
remp filtre a air 0,3 33,000 9,900
remp filtre habitacle 0,3 33,000 9,900
Total DT 53,000`;

    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);

    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).toBeVisible();

    await humanFill(page, page.locator('[data-testid="quote-text-input"]'), DEVIS_TABLEAU);
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));
    await humanWait(page, 500);

    await expect(page.locator('[data-testid="quote-preview-table"]')).toBeVisible({ timeout: 7000 });

    // Vérifier les descriptions via les inputs éditables (line.description, pas rawText)
    // Seules les lignes labor sélectionnées ont un input de description
    const descInputs = page.locator('[data-testid^="quote-line-desc-"]');
    const descCount = await descInputs.count();
    expect(descCount).toBeGreaterThan(0);

    for (let i = 0; i < descCount; i++) {
      const val = await descInputs.nth(i).inputValue();
      // La description NE doit PAS contenir de prix au format 33,000 ou 9,900
      const hasPriceFormat = /\b\d+[,.]\d{3}\b/.test(val);
      expect(hasPriceFormat, `Desc ${i} contient un prix: "${val}"`).toBe(false);
    }

    // Fermer le modal
    const closeBtn = page.locator('[data-testid="quote-import-cancel"], [data-testid="quote-import-close"]').first();
    if (await closeBtn.isVisible()) {
      await humanClick(page, closeBtn);
    }
  });

  // ─── Test 15 : Devis multi-pages anonymisé 1076 & validation durée 0h ───────

  test("19-15 devis multi-pages 1076 & validation duree 0h", async ({ page }) => {
    const FIXTURE_1076_ANONYMIZED = `
NIMR SAV
Concession COMET
CLT-0018 CLIENT TEST
DATE DEVIS 12/06/2026
MARQUE DFSK MODELE GLORY
VIN GLORYFICTIF1076
Désignation Qté Prix unitaire Montant
ART-10020 FILTRE A AIR 1 45,000 45,000
ART-10021 HUILE MOTEUR 4 25,000 100,000
MO-002067 PRODUIT DE PEINTURE 2 180,000 360,000
MO-TOL DEPOSE ET REPOSE
PARE-CHOCS AV 1 35,000 35,000
MO-TOL PEINTURE ET FINITION
AILE AV DR 4,5 35,000 157,500
MO-TOL REDRESSAGE CAPOT 0 35,000 0
Report 697,500
Page 1 / 3
Report 697,500
Désignation Qté Prix unitaire Montant
ART-10022 LIQUIDE FREIN 1 15,000 15,000
MO-TOL D/P ET PREPARATION
PORTE AVD 2,5 35,000 87,500
MO-TOL PEINTURE ET FINITION
PORTE AVD 4,0 35,000 140,000
Montant à reporter 940,000
Page 2 / 3
Montant à reporter 940,000
Total DT 940,000
TVA 19% 178,600
Timbre fiscal 1,000
Total TTC 1119,600
Signature du client
Page 3 / 3
    `.trim();

    const dossier = makeDossierWithPreset();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    await navigateToDossierRepairOrders(page, dossier.id);
    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).toBeVisible();

    await humanFill(page, page.locator('[data-testid="quote-text-input"]'), FIXTURE_1076_ANONYMIZED);
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));
    await humanWait(page, 500);

    await expect(page.locator('[data-testid="quote-preview-table"]')).toBeVisible({ timeout: 7000 });

    // Les lignes MO valides sur les pages 1 et 2 doivent être présentes
    // total 5 lignes MO (DEPOSE ET REPOSE PARE-CHOCS AV, PEINTURE ET FINITION AILE AV DR, REDRESSAGE CAPOT, D/P ET PREPARATION PORTE AVD, PEINTURE ET FINITION PORTE AVD)
    const laborRows = page.locator('[data-testid="quote-line-labor"]');
    await expect(laborRows).toHaveCount(5);

    // Le produit de peinture (MO-002067) ne doit pas être dans les lignes MO
    const paintRows = page.locator('[data-testid="quote-line-paint"]');
    await expect(paintRows.first()).toBeVisible();
    const paintCheckboxes = paintRows.locator('input[type="checkbox"]');
    await expect(paintCheckboxes).toHaveCount(0); // paint has no checkbox

    // Vérifier la ligne de durée 0 (REDRESSAGE CAPOT)
    // Elle doit avoir le checkbox désactivé
    const capotRow = laborRows.filter({ hasText: "REDRESSAGE CAPOT" });
    const capotCheckbox = capotRow.locator('input[type="checkbox"]');
    await expect(capotCheckbox).toBeDisabled();

    // Et elle ne doit pas être sélectionnée par défaut
    await expect(capotCheckbox).not.toBeChecked();

    // Si on change sa durée à 1.5, le checkbox doit s'activer
    const capotHoursInput = capotRow.locator('input[type="number"]');
    await capotHoursInput.fill("1.5");
    await humanWait(page, 200);
    await expect(capotCheckbox).toBeEnabled();

    // On coche la ligne
    await humanClick(page, capotCheckbox);
    await expect(capotCheckbox).toBeChecked();

    // On confirme l'importation
    const confirmBtn = page.locator('[data-testid="quote-import-confirm"]');
    await expect(confirmBtn).toBeEnabled();
    await humanClick(page, confirmBtn);
    await humanWait(page, 500);

    const doneBtn = page.locator('[data-testid="quote-import-done"]');
    if (await doneBtn.isVisible()) {
      await humanClick(page, doneBtn);
    }
    await humanWait(page, 300);

    // Vérifier que 5 nouvelles tâches sont créées (en plus de celle de preset)
    const taskCards = page.locator("[data-testid^=\"task-card-\"]");
    await expect(taskCards).toHaveCount(6); // 1 preset + 5 imported

    // Vérifier que le produit peinture, Report, Total, TVA ne sont pas des tâches
    const taskTexts = await taskCards.allTextContents();
    for (const text of taskTexts) {
      const upper = text.toUpperCase();
      expect(upper).not.toContain("PRODUIT DE PEINTURE");
      expect(upper).not.toContain("REPORT");
      expect(upper).not.toContain("TVA");
    }
  });

});
