import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill, humanRefresh, expectOnlyNimrSavProStorage } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";

test.describe("Persistance de données locales et isolation cache", () => {
  const testDossier = createMockDossier({
    id: "NIMR-PERSIST-001",
    clientNom: "Persist Client",
    ordresReparation: []
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
      // Artificially inject a legacy key to see if isolation checks detect it
      localStorage.setItem("nimr-sav-legacy-key", "some-garbage");
    }, { key: STORAGE_KEYS.dossiers, value: [testDossier] });
    await page.reload();
  });

  test("Détection de clés localStorage illégitimes et nettoyage", async ({ page }) => {
    // Check if we can detect forbidden key using our helper
    // Wait, the helper checks if any key starts with nimr-sav or nimr_sav but NOT nimr-sav-pro
    // "nimr-sav-legacy-key" starts with "nimr-sav" and not "nimr-sav-pro". It should be flagged!
    let failed = false;
    try {
      await expectOnlyNimrSavProStorage(page);
    } catch {
      failed = true;
    }
    expect(failed, "Legacy key was successfully detected").toBe(true);

    // Clean it up and re-test
    await page.evaluate(() => {
      localStorage.removeItem("nimr-sav-legacy-key");
    });
    await expectOnlyNimrSavProStorage(page); // Should pass now
  });

  test("Conservation des modifications de dossier après rafraîchissement complet", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");

    // Go to dossier details
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    // Add a new task line
    await humanFill(page, page.locator('[data-testid="new-task-desc"]'), "Vidange boîte pont");
    await expect(page.locator('[data-testid="new-task-time"]')).toHaveValue("À estimer");
    await expect(page.locator('[data-testid="new-task-time"]')).toHaveAttribute("readonly", "");
    await humanClick(page, page.locator('[data-testid="new-task-submit"]'));

    // Verify task is created in list
    const taskCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: "Vidange boîte pont" });
    await expect(taskCard).toBeVisible();
    await expect(taskCard).toContainText("À estimer");

    // Perform full page reload/refresh
    await humanRefresh(page);

    // Re-verify that user role and task list changes survived the reload
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Directeur SAV");

    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    const persistedTaskCard = page.locator('[data-testid^="task-card-"]').filter({ hasText: "Vidange boîte pont" });
    await expect(persistedTaskCard).toBeVisible();
    await expect(persistedTaskCard).toContainText("À estimer");
  });
});
