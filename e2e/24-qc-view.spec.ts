/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus } from "../src/types";

test.describe("BUG-004 — Module Contrôle Qualité dédié", () => {
  const dossiers = [
    createMockDossier({ 
      id: "NIMR-QC-001", 
      clientNom: "Client QC1", 
      statut: DossierStatus.CONTROLE_QUALITE 
    }),
    createMockDossier({ 
      id: "NIMR-QC-002", 
      clientNom: "Client QC2", 
      statut: DossierStatus.CONTROLE_QUALITE 
    }),
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: dossiers });
    await page.reload();
  });

  test("Accès au module QC et validation d'un dossier avec checklist complète", async ({ page }) => {
    await changeUserRole(page, "role-option-controle-qualite");
    await expect(page.locator('[data-testid="nav-controle-qualite"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="nav-controle-qualite"]'));

    // Verify FTR KPI exists
    await expect(page.locator('[data-testid="qc-kpi-ftr"]')).toBeVisible();

    // Select dossier NIMR-QC-001
    await expect(page.locator('[data-testid="qc-dossier-list"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="qc-dossier-row-NIMR-QC-001"]'));

    // Try to validate without checking boxes -> should fail
    await humanClick(page, page.locator('[data-testid="btn-qc-validate"]'));
    await expect(page.locator("text=Toutes les étapes du contrôle qualité doivent être cochées")).toBeVisible();

    // Check all 8 boxes
    const checkboxIds = [
      "qc-check-essai",
      "qc-check-defaut",
      "qc-check-voyants",
      "qc-check-niveaux",
      "qc-check-serrage",
      "qc-check-proprete",
      "qc-check-docs",
      "qc-check-photos"
    ];

    for (const id of checkboxIds) {
      const checkbox = page.locator(`[data-testid="${id}"] input[type="checkbox"]`);
      await checkbox.check();
    }

    // Validate QC
    await humanClick(page, page.locator('[data-testid="btn-qc-validate"]'));
    await expect(page.locator('[data-testid="modal-qc-validate"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="modal-qc-validate-confirm"]'));

    // Success notification should be visible
    await expect(page.locator("text=Contrôle qualité validé pour le dossier NIMR-QC-001")).toBeVisible();

    // NIMR-QC-001 should not be in the pending list anymore
    await expect(page.locator('[data-testid="qc-dossier-row-NIMR-QC-001"]')).not.toBeVisible();

    // NIMR-QC-001 should be in the history table
    await expect(page.locator('[data-testid="qc-history-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="qc-history-list"] >> text=NIMR-QC-001')).toBeVisible();
  });

  test("Refus de QC exige un motif de refus obligatoire", async ({ page }) => {
    await changeUserRole(page, "role-option-controle-qualite");
    await humanClick(page, page.locator('[data-testid="nav-controle-qualite"]'));

    // Select dossier NIMR-QC-002
    await humanClick(page, page.locator('[data-testid="qc-dossier-row-NIMR-QC-002"]'));

    // Try to refuse without motif -> should open a guarded modal
    await humanClick(page, page.locator('[data-testid="btn-qc-refuse"]'));
    await expect(page.locator('[data-testid="modal-qc-refuse"]')).toBeVisible();
    await expect(page.locator('[data-testid="modal-qc-refuse-confirm"]')).toBeDisabled();

    // Add motif and refuse
    await page.locator('[data-testid="modal-qc-refuse-select"]').selectOption("Autre");
    await humanFill(page, page.locator('[data-testid="modal-qc-refuse-input"]'), "Anomalie frein arrière");
    await humanClick(page, page.locator('[data-testid="modal-qc-refuse-confirm"]'));

    // Success message and dossier removed
    await expect(page.locator("text=Contrôle qualité refusé pour le dossier NIMR-QC-002")).toBeVisible();
    await expect(page.locator('[data-testid="qc-dossier-row-NIMR-QC-002"]')).not.toBeVisible();

    // Should be in history as Refusé
    await expect(page.locator('[data-testid="qc-history-list"] >> text=NIMR-QC-002')).toBeVisible();
    await expect(page.locator('[data-testid="qc-history-list"] >> text=Refusé')).toBeVisible();
  });
});
