import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "../helpers/human-actions";
import { createMockDossier } from "../helpers/test-data-creator";
import { STORAGE_KEYS } from "../../src/storage-keys";
import { DossierStatus } from "../../src/types";

test.describe("Rôle : Lecture seule", () => {
  const readDossier = createMockDossier({
    id: "NIMR-READ-001",
    clientNom: "Read Only Client",
    statut: DossierStatus.EN_TRAVAUX,
    ordresReparation: [
      { id: "ro_read_1", designation: "Diagnostic général", tempsEstime: 1.0, tempsPasse: 0, status: "pending" }
    ]
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ keyDossiers, valDossiers }) => {
      localStorage.clear();
      localStorage.setItem(keyDossiers, JSON.stringify(valDossiers));
    }, {
      keyDossiers: STORAGE_KEYS.dossiers,
      valDossiers: [readDossier]
    });
    await page.reload();
    await changeUserRole(page, "role-option-lecture-seule");
  });

  test("Consultation autorisée mais toutes actions interdites / cachées", async ({ page }) => {
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Lecture seule");

    // Dashboard and dossiers list are visible for read-only
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-dossiers"]')).toBeVisible();

    // Guided reception, planning, and Chef d'atelier views are not accessible
    await expect(page.locator('[data-testid="nav-planning"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-reception"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-chef-atelier"]')).not.toBeVisible();

    // Go to dossier detail
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${readDossier.id}`));

    // 1. Check quick management dropdowns (e.g. Forcer le statut, etc.) are NOT visible
    await expect(page.locator('text=Forcer le statut (Démo) :')).not.toBeVisible();

    // 2. Check repair orders tab: start button is hidden
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
    await expect(page.locator(`[data-testid="task-start-ro_read_1"]`)).not.toBeVisible();
    await expect(page.locator('[data-testid="new-task-submit"]')).not.toBeVisible();

    // 3. Check quality control tab: checkboxes are disabled, accept/refuse buttons are hidden
    await humanClick(page, page.locator('[data-testid="tab-quality-control"]'));
    const checkbox = page.locator('[data-testid="qc-check-essaiEffectue"]');
    await expect(checkbox).toBeDisabled();
    await expect(page.locator('[data-testid="qc-accept"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="qc-refuse"]')).not.toBeVisible();

    // 4. Check deliveries tab: delivery button is hidden
    await humanClick(page, page.locator('[data-testid="tab-deliveries"]'));
    await expect(page.locator('[data-testid="delivery-submit"]')).not.toBeVisible();
  });
});
