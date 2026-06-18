import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";

test.describe("Import / Export de base de données strict", () => {
  const originalDossier = createMockDossier({
    id: "NIMR-ORIG-001",
    clientNom: "Original Client"
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [originalDossier] });
    await page.reload();
    await changeUserRole(page, "role-option-directeur");
  });

  test("Exportation de la base en JSON", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-settings"]'));

    // We can intercept the download event in Playwright
    await humanClick(page, page.locator('[data-testid="export-json"]'));
    await expect(page.locator('[data-testid="export-json-confirm-modal"]')).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await humanClick(page, page.locator('[data-testid="export-json-confirm"]'));
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain("NIMR_SAV_PRO_BASE_BACKUP.json");
  });

  test("Importation d'un JSON invalide : rejet et préservation de la base active", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-settings"]'));

    // 1. Invalid JSON structure (non-object)
    const badPayload1 = ["dossier1", "dossier2"];
    await page.setInputFiles('[data-testid="import-json-input"]', {
      name: "bad_backup_1.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(badPayload1))
    });

    // Check error banner is visible and reports correct message
    const errorBanner = page.locator('[data-testid="import-error-message"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText(/objet JSON/i);

    // 2. Empty JSON object
    const badPayload2 = {};
    await page.setInputFiles('[data-testid="import-json-input"]', {
      name: "bad_backup_2.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(badPayload2))
    });
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText(/Aucune section/i);

    // 3. Section dossiers present but invalid structure
    const badPayload3 = { dossiers: [{ id: 123, clientNom: "Should be string" }] };
    await page.setInputFiles('[data-testid="import-json-input"]', {
      name: "bad_backup_3.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(badPayload3))
    });
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText(/dossiers.*invalide/i);

    // Verify the original database is preserved
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await expect(page.locator(`text=${originalDossier.id}`)).toBeVisible();
  });

  test("Importation d'un JSON valide : succès et écrasement propre", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-settings"]'));

    // Create a valid payload
    const importedDossier = createMockDossier({
      id: "NIMR-IMPORTED-007",
      clientNom: "Imported Bond Client"
    });
    const validPayload = {
      dossiers: [importedDossier]
    };

    await page.setInputFiles('[data-testid="import-json-input"]', {
      name: "valid_backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(validPayload))
    });

    await expect(page.locator('[data-testid="import-json-confirm-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-json-summary"]')).toContainText(/1 dossier/i);
    await expect(page.locator('[data-testid="import-json-confirm"]')).toBeDisabled();
    await page.locator('[data-testid="import-json-confirmation-input"]').fill("Je comprends que l’import remplace les données locales");
    await expect(page.locator('[data-testid="import-json-confirm"]')).toBeEnabled();
    await humanClick(page, page.locator('[data-testid="import-json-confirm"]'));

    // Verify success banner is displayed
    const successBanner = page.locator('[data-testid="import-success-message"]');
    await expect(successBanner).toBeVisible();
    await expect(successBanner).toHaveText(/restaurée avec succès/i);

    // Verify the imported dossier is loaded
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await expect(page.locator(`text=${importedDossier.id}`)).toBeVisible();
    await expect(page.locator(`text=${originalDossier.id}`)).not.toBeVisible();
  });
});
