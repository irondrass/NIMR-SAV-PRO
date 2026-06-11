import { test, expect } from "@playwright/test";
import { changeUserRole, humanWait, humanClick } from "../helpers/human-actions";
import { createMockDossier } from "../helpers/test-data-creator";
import { STORAGE_KEYS } from "../../src/storage-keys";
import { DossierStatus, DossierPriority } from "../../src/types";

test.describe("Rôle : Directeur SAV", () => {
  const testDossier = createMockDossier({
    id: "NIMR-DIR-001",
    clientNom: "Directeur Client Test",
    statut: DossierStatus.EN_TRAVAUX,
    ordresReparation: [
      { id: "ro_dir_1", designation: "Contrôle moteur", tempsEstime: 2.0, tempsPasse: 2.0, status: "done" }
    ]
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [testDossier] });
    await page.reload();
    await changeUserRole(page, "role-option-directeur");
  });

  test("Accès global et tableau de bord 360", async ({ page }) => {
    // Assert current role displayed
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Directeur SAV");

    // All sidebar options should be accessible
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-dossiers"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-planning"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-settings"]')).toBeVisible();
  });

  test("Forçage arbitraire du statut et de la priorité d'un dossier", async ({ page }) => {
    // Navigate to dossiers list and click our test dossier
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));

    // Check selectors for forcing status and priority exist for Director
    const statusSelect = page.locator('[data-testid="force-status-select"]');
    const prioritySelect = page.locator('[data-testid="force-priority-select"]');

    await expect(statusSelect).toBeVisible();
    await expect(prioritySelect).toBeVisible();

    // Force status to PRET_A_LIVRER
    await statusSelect.selectOption(DossierStatus.PRET_A_LIVRER);
    await humanWait(page, 200);

    // Force priority to URGENTE
    await prioritySelect.selectOption(DossierPriority.URGENTE);
    await humanWait(page, 200);

    // Refresh and check persistence
    await page.reload();
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));

    // Assert forced values are saved
    await expect(page.locator('[data-testid="status-badge"]').filter({ hasText: DossierStatus.PRET_A_LIVRER })).toBeVisible();
  });

  test("Réouverture d'une tâche terminée avec motif obligatoire", async ({ page }) => {
    // Go to dossier details
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));
 
    // Switch to Ordres de travaux tab
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
 
    // Check that reopen button is visible for the done task
    const reopenBtn = page.locator(`[data-testid="task-reopen-ro_dir_1"]`);
    await expect(reopenBtn).toBeVisible();
 
    // Click reopen to show modal
    await humanClick(page, reopenBtn);

    // Modal should be visible
    const modal = page.locator('[data-testid="modal-task-reopen"]');
    await expect(modal).toBeVisible();

    // Confirm button should be disabled initially
    const confirmBtn = page.locator('[data-testid="modal-task-reopen-confirm"]');
    await expect(confirmBtn).toBeDisabled();

    // Select "Autre (saisie libre)"
    const select = page.locator('[data-testid="modal-task-reopen-select"]');
    await select.selectOption("Autre (saisie libre)");

    // Confirm button should still be disabled because details are empty
    await expect(confirmBtn).toBeDisabled();

    // Fill details
    const input = page.locator('[data-testid="modal-task-reopen-input"]');
    await page.locator('[data-testid="modal-task-reopen-input"]').fill("Refus client suite essai");

    // Confirm button should now be enabled
    await expect(confirmBtn).toBeEnabled();

    // Click confirm
    await humanClick(page, confirmBtn);

    // Modal should be gone
    await expect(modal).toHaveCount(0);
 
    // Expect task to change back to reopened status
    await expect(page.locator('[data-testid="task-status-ro_dir_1"]')).toHaveText(/Réouvert/i);
  });
});
