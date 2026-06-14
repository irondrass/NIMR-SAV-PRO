/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus } from "../src/types";

test.describe("BUG-005 — Module Livraison dédié", () => {
  const dossiers = [
    createMockDossier({ 
      id: "NIMR-DEL-001", 
      clientNom: "Client Del1", 
      vehiculeKilometrage: 15000,
      statut: DossierStatus.PRET_A_LIVRER,
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
      }
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

  test("Accès au module Livraison, validations de checklist et de kilométrage, confirmation de livraison", async ({ page }) => {
    await changeUserRole(page, "role-option-livraison");
    await expect(page.locator('[data-testid="nav-livraison"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="nav-livraison"]'));

    // Select dossier NIMR-DEL-001
    await expect(page.locator('[data-testid="delivery-dossier-list"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="delivery-dossier-row-NIMR-DEL-001"]'));

    // Try to confirm without checking checklist boxes -> should fail
    await humanClick(page, page.locator('[data-testid="btn-delivery-confirm"]'));
    await expect(page.locator("text=Toutes les étapes de la checklist de restitution doivent être cochées")).toBeVisible();

    // Check checklist items
    await page.locator('[data-testid="delivery-check-qc"] input[type="checkbox"]').check();
    await page.locator('[data-testid="delivery-check-informed"] input[type="checkbox"]').check();
    await page.locator('[data-testid="delivery-check-reception"] input[type="checkbox"]').check();

    // Enter invalid mileage (smaller than entry km of 15000)
    await humanFill(page, page.locator('[data-testid="delivery-km-sortie"]'), "14990");
    await humanClick(page, page.locator('[data-testid="btn-delivery-confirm"]'));
    await expect(page.locator("text=ne peut pas être inférieur au kilométrage d'entrée")).toBeVisible();

    // Enter valid exit km
    await humanFill(page, page.locator('[data-testid="delivery-km-sortie"]'), "15015");
    await humanFill(page, page.locator('[data-testid="delivery-comment"]'), "Livré en main propre, client très satisfait.");

    // Confirm delivery
    await humanClick(page, page.locator('[data-testid="btn-delivery-confirm"]'));

    // Success notice and removal
    await expect(page.locator("text=Livraison confirmée pour le dossier NIMR-DEL-001")).toBeVisible();
    await expect(page.locator('[data-testid="delivery-dossier-row-NIMR-DEL-001"]')).not.toBeVisible();

    // Should be in history table
    await expect(page.locator('[data-testid="delivery-history-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="delivery-history-list"] >> text=NIMR-DEL-001')).toBeVisible();
    await expect(page.locator('[data-testid="delivery-history-list"] >> text=15015 km')).toBeVisible();
  });
});
