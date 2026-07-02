import { test, expect, Page } from "@playwright/test";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus, UserRole } from "../src/types";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier, createWorkshopTechnicians } from "./helpers/test-data-creator";

async function seedStorage(page: Page, dossiers: unknown[]) {
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue, techniciansValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.techs, JSON.stringify(techniciansValue));
    localStorage.setItem(keys.reservations, JSON.stringify([]));
  }, {
    keys: STORAGE_KEYS,
    dossiersValue: dossiers,
    techniciansValue: createWorkshopTechnicians(),
  });
  await page.reload();
}

async function openDossierAsChef(page: Page, dossierId: string) {
  await changeUserRole(page, "role-option-chef-atelier");
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanClick(page, page.locator(`[data-testid="dossier-card-${dossierId}"]`));
}

test.describe("Old app parity - Étapes à modifier & Technicien Réservation Parité", () => {
  test("Vérifie l'édition des étapes, les presets, la compatibilité technicien, et la synchro en cours", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-07-01T07:00:00"));
    const dossierId = "NIMR-STAGE-EDITOR-PARITY";
    const dossier = createMockDossier({
      id: dossierId,
      statut: DossierStatus.TRAVAUX_PLANIFIES,
      ordresReparation: [
        {
          id: "task-test-1",
          designation: "Recherche de panne",
          tempsEstime: 0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: false,
          workshopStageId: "electrical",
        }
      ],
    });

    await seedStorage(page, [dossier]);
    await openDossierAsChef(page, dossierId);

    // Go to "Étapes à modifier"
    await humanClick(page, page.locator('[data-testid="tab-rdv-planning"]'));
    await expect(page.locator('[data-testid="stage-editor-container"]')).toBeVisible();

    // The electrical stage button should show "À estimer" (since tempsEstime = 0)
    const electricalBtn = page.locator('[data-testid="edit-stage-duration-electrical"]');
    await expect(electricalBtn).toBeVisible();
    await expect(electricalBtn).toContainText(/À estimer|estim/i);

    // Open duration editor modal
    await humanClick(page, electricalBtn);
    await expect(page.locator('[data-testid="stage-duration-modal"]')).toBeVisible();

    // Select a preset duration (e.g. 1.0H)
    await humanClick(page, page.locator('[data-testid="preset-duration-option-1.0"]'));
    await humanClick(page, page.locator('[data-testid="confirm-stage-duration"]'));
    await expect(page.locator('[data-testid="stage-duration-modal"]')).not.toBeVisible();

    // The button should now show "1.0H"
    await expect(electricalBtn).toContainText("1.0H");

    // Go to "Ordres de Travaux & Remplacement Pièces" tab to check the badges
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
    const badgeSource = page.locator('[data-testid="task-source-badge-task-test-1"]');
    await expect(badgeSource).toBeVisible();
    await expect(badgeSource).toContainText("Preset");

    // Now let's try to plan the task. Go to "Planification RDV & Atelier" tab
    await humanClick(page, page.locator('[data-testid="tab-rdv-planning"]'));
    // Open manual reservation dropdown / panel
    const electricalCard = page.locator('[data-testid="planning-step-card-electrical"]');
    await humanClick(page, electricalCard.locator('[data-testid="planning-step-reserve"]'));
    await expect(page.locator('[data-testid="planning-suggest-result"]')).toBeVisible();

    // Click "Réserver ce créneau" to apply suggestion
    await humanClick(page, page.locator('[data-testid="planning-suggest-apply"]'));
    await expect(page.locator('[data-testid="planning-suggest-result"]')).not.toBeVisible();

    // Go back to tasks tab
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
    
    // The technician displayed on the card should be the one assigned
    await expect(page.locator('[data-testid="task-technician-task-test-1"]')).not.toContainText("Aucun technicien");

    // Since the task is scheduled, let's start it
    const startBtn = page.locator('[data-testid="task-start-task-test-1"]');
    await expect(startBtn).toBeVisible();
    await humanClick(page, startBtn);

    // The task should now be "in_progress"
    await expect(page.locator('[data-testid="task-pause-task-test-1"]')).toBeVisible();
  });
});
