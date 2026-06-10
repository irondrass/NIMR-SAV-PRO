import { test, expect } from "@playwright/test";
import { changeUserRole, humanWait, humanClick, humanFill } from "../helpers/human-actions";
import { STORAGE_KEYS } from "../../src/storage-keys";

test.describe("Rôle : Réceptionnaire", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await changeUserRole(page, "role-option-receptionnaire");
  });

  test("Habilitations restrictives du Réceptionnaire", async ({ page }) => {
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Réceptionnaire");

    // Guided Reception and dossiers list should be visible
    await expect(page.locator('[data-testid="nav-reception"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-dossiers"]')).toBeVisible();

    // Workshop and Technician specific views should be hidden
    await expect(page.locator('[data-testid="nav-chef-atelier"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-technician"]')).not.toBeVisible();
  });

  test("Validation des étapes de création de dossier (cas négatifs & positif)", async ({ page }) => {
    // Navigate to Guided Reception
    await humanClick(page, page.locator('[data-testid="nav-reception"]'));

    // --- STEP 1: Client Info ---
    // Try to click Next without name
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-error-message"]')).toHaveText(/nom/i);

    // Fill client name & phone
    await humanFill(page, page.locator('[data-testid="reception-client-name"]'), "Jean Dupont");
    await humanFill(page, page.locator('[data-testid="reception-client-phone"]'), "+216 99 999 999");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));

    // --- STEP 2: Vehicle Info ---
    // Try to click Next without vehicle data
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-error-message"]')).toHaveText(/modèle/i);

    // Fill model & immatriculation
    await humanFill(page, page.locator('[data-testid="reception-vehicle-model"]'), "Huge Hybrid");
    await humanFill(page, page.locator('[data-testid="reception-plate"]'), "777 TU 7777");
    await humanFill(page, page.locator('[data-testid="reception-vin"]'), "VINNUMBER777777777");
    await humanFill(page, page.locator('[data-testid="reception-mileage"]'), "15000");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));

    // --- STEP 3: Objects left on board & Reason ---
    // Fill plainte/reason in Step 3
    await humanFill(page, page.locator('[data-testid="reception-reason"]'), "Recharge impossible");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));

    // --- STEP 4: Carrosserie & Submit ---
    // Submit form
    await humanClick(page, page.locator('[data-testid="reception-submit"]'));

    // Navigate to dossiers list to find the newly created dossier
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));

    // Should find the newly created dossier in the list
    await expect(page.locator('text=777 TU 7777')).toBeVisible();
  });
});
