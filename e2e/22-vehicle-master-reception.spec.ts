/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { STORAGE_KEYS } from "../src/storage-keys";

test.describe("Vehicle Master and Guided Reception Assistance", () => {
  test("Réceptionnaire imports, searches, pre-fills, creates dossier, and clears local database", async ({ page }) => {
    // 1. Clear storage and load blank page
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    // 2. Login as Réceptionnaire
    await changeUserRole(page, "role-option-receptionnaire");

    // 3. Open Reception tab
    const tabSelector = '[data-testid="nav-reception"]';
    await page.waitForSelector(tabSelector, { state: "visible" });
    await humanClick(page, page.locator(tabSelector));

    // 4. Toggle the Vehicle Master panel to open it
    const togglePanelBtn = page.locator('[data-testid="vehicle-master-panel-toggle"]');
    await expect(togglePanelBtn).toBeVisible();
    await expect(togglePanelBtn).toContainText("0 véhicule(s) en local");
    await humanClick(page, togglePanelBtn);

    // 5. Upload fictitious CSV records using setInputFiles
    const csvContent = 
      `Châssis;Immatriculation;Client;Téléphone;Marque;Modèle;Version;Date livraison;Date mise en circulation;Date fin garantie pièces;Date fin garantie MO;Dernier entretien;Kilométrage dernier entretien\n` +
      `VINFICTIF123;999 TU 999;Bob;+216 99 999 999;Dongfeng;Shine Max;;15/06/2026;15/06/2026;15/06/2029;15/06/2029;15/06/2027;15000`;

    const fileInput = page.locator('[data-testid="vehicle-master-import-input"]');
    await expect(fileInput).toBeVisible();
    await fileInput.setInputFiles({
      name: "vehicles.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent, "utf-8"),
    });

    // Verify import statistics are visible
    const resultBlock = page.locator('[data-testid="vehicle-master-import-result"]');
    await expect(resultBlock).toBeVisible();
    await expect(resultBlock).toContainText("Véhicules importés : 1");
    await expect(togglePanelBtn).toContainText("1 véhicule(s) en local");

    // 6. Search for the imported vehicle
    const searchInput = page.locator('[data-testid="vehicle-master-search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("VINFICTIF123");

    // Verify search result is displayed with correct attributes
    const resultRow = page.locator('[data-testid^="vehicle-result-row-"]');
    await expect(resultRow).toBeVisible();
    await expect(page.locator('[data-testid^="vehicle-result-vin-"]')).toContainText("VINFICTIF123");
    await expect(page.locator('[data-testid^="vehicle-result-phone-"]')).toContainText("+216 99 999 999");
    await expect(resultRow).toContainText("Garantie active");
    await expect(resultRow).toContainText("Dernier entretien le 2027-06-15 à 15000 km");

    // 7. Click Use this vehicle and verify pre-filled data
    const useBtn = page.locator('[data-testid^="vehicle-use-btn-"]');
    await humanClick(page, useBtn);

    const clientNameInput = page.locator('[data-testid="reception-client-name"]');
    const clientPhoneInput = page.locator('[data-testid="reception-client-phone"]');
    await expect(clientNameInput).toHaveValue("Bob");
    await expect(clientPhoneInput).toHaveValue("+216 99 999 999");

    // Navigate to step 2 (Vehicle info)
    const nextBtn = page.locator('[data-testid="reception-next"]');
    await humanClick(page, nextBtn);

    // Verify vehicle specifications are pre-filled
    const brandSelect = page.locator('[data-testid="reception-vehicle-brand"]');
    const modelInput = page.locator('[data-testid="reception-vehicle-model"]');
    const plateInput = page.locator('[data-testid="reception-plate"]');
    const vinInput = page.locator('[data-testid="reception-vin"]');

    await expect(brandSelect).toHaveValue("Dongfeng");
    await expect(modelInput).toHaveValue("Shine Max");
    await expect(plateInput).toHaveValue("999 TU 999");
    await expect(vinInput).toHaveValue("VINFICTIF123");

    // 8. Complete the Guided Reception flow to create the Repair Order
    await humanClick(page, nextBtn); // Step 2 -> Step 3
    const presetComplaint = page.locator('[data-testid="preset-complaint-voyant-moteur"]');
    await humanClick(page, presetComplaint);

    await humanClick(page, nextBtn); // Step 3 -> Step 4
    const submitBtn = page.locator('[data-testid="reception-submit"]');
    await humanClick(page, submitBtn); // Step 4 -> Success Screen

    // 9. Go to folders list and verify the record is added
    const foldersTabSelector = '[data-testid="nav-dossiers"]';
    await page.waitForSelector(foldersTabSelector, { state: "visible" });
    await humanClick(page, page.locator(foldersTabSelector));
    
    // Check that our created dossier with Client name is visible
    const bobRow = page.locator('text=Bob');
    await expect(bobRow).toBeVisible();

    // Click on Bob to open detailed view
    await humanClick(page, bobRow);

    // Verify that the VIN is visible in the detailed view
    await expect(page.locator('text=VINFICTIF123')).toBeVisible();

    // 10. Search non-existent vehicle and verify warning
    await humanClick(page, page.locator(tabSelector)); // Return to reception
    await searchInput.fill("INEXISTANT999");
    const notFoundAlert = page.locator('[data-testid="vehicle-master-not-found-alert"]');
    await expect(notFoundAlert).toBeVisible();

    // 11. Clear local database and verify statistics
    // Make sure panel is open
    const panelOpenState = await togglePanelBtn.locator("span").nth(1).textContent();
    if (panelOpenState?.includes("Gérer")) {
      await humanClick(page, togglePanelBtn);
    }
    const clearBtn = page.locator('[data-testid="vehicle-master-clear-btn"]');
    await humanClick(page, clearBtn);

    // Confirmation modal should be visible
    const clearConfirmBtn = page.locator('[data-testid="vehicle-clear-confirm"]');
    await expect(clearConfirmBtn).toBeVisible();
    await humanClick(page, clearConfirmBtn);

    // Panel should indicate 0 records
    await expect(togglePanelBtn).toContainText("0 véhicule(s) en local");
  });
});
