import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "../helpers/human-actions";
import { createMockDossier } from "../helpers/test-data-creator";
import { STORAGE_KEYS } from "../../src/storage-keys";
import { DossierStatus } from "../../src/types";

test.describe("Rôle : Contrôle Qualité", () => {
  const qcDossier = createMockDossier({
    id: "NIMR-QC-001",
    clientNom: "QC Client Test",
    statut: DossierStatus.CONTROLE_QUALITE,
    checklistQC: {
      essaiEffectue: false,
      defautRepare: false,
      aucunVoyantAllume: false,
      niveauxVerifies: false,
      serrageSecurite: false,
      propreteVehicule: false,
      documentsPrets: false,
      photosApresOk: false,
      validationGlobale: "en_attente"
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ keyDossiers, valDossiers }) => {
      localStorage.clear();
      localStorage.setItem(keyDossiers, JSON.stringify(valDossiers));
    }, {
      keyDossiers: STORAGE_KEYS.dossiers,
      valDossiers: [qcDossier]
    });
    await page.reload();
    await changeUserRole(page, "role-option-controle-qualite");
  });

  test("Refus de validation QC si la checklist est incomplète", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${qcDossier.id}`));
    await humanClick(page, page.locator('[data-testid="tab-quality-control"]'));

    // Try to accept validation immediately
    await humanClick(page, page.locator('[data-testid="qc-accept"]'));

    // Assert DOM error message
    const errorBanner = page.locator('[data-testid="qc-error-message"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText(/checklist/i);
  });

  test("Validation complète de la checklist et acceptation QC", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${qcDossier.id}`));
    await humanClick(page, page.locator('[data-testid="tab-quality-control"]'));

    // Click all checkboxes
    const keys = [
      "essaiEffectue",
      "defautRepare",
      "aucunVoyantAllume",
      "niveauxVerifies",
      "serrageSecurite",
      "propreteVehicule",
      "documentsPrets",
      "photosApresOk"
    ];

    for (const key of keys) {
      const checkbox = page.locator(`[data-testid="qc-check-${key}"]`);
      await checkbox.check();
    }

    // Now click accept
    await humanClick(page, page.locator('[data-testid="qc-accept"]'));

    // Should display validation success status message
    await expect(page.locator('[data-testid="qc-status-message"]')).toBeVisible();

    // Verify dossier state transitioned to Prêt à livrer in header
    await expect(page.locator('[data-testid="status-badge"]').filter({ hasText: "Prêt à livrer" })).toBeVisible();
  });

  test("Refus de QC exige un motif obligatoire", async ({ page }) => {
    // Setup dialog behavior to return empty string (motive omitted)
    page.on("dialog", async (dialog) => {
      await dialog.accept("");
    });

    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${qcDossier.id}`));
    await humanClick(page, page.locator('[data-testid="tab-quality-control"]'));

    // Click refuse
    await humanClick(page, page.locator('[data-testid="qc-refuse"]'));

    // Verify DOM error banner shows up for missing motif
    const errorBanner = page.locator('[data-testid="qc-error-message"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText(/motif/i);
  });

  test("Refus de QC avec motif valide bloque le dossier", async ({ page }) => {
    // Setup dialog behavior to return a valid motive
    page.on("dialog", async (dialog) => {
      await dialog.accept("Bruit suspect moteur en charge");
    });

    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${qcDossier.id}`));
    await humanClick(page, page.locator('[data-testid="tab-quality-control"]'));

    // Click refuse
    await humanClick(page, page.locator('[data-testid="qc-refuse"]'));

    // Verify status has updated to Bloqué
    await expect(page.locator('[data-testid="status-badge"]').filter({ hasText: "Bloqué" })).toBeVisible();
  });
});
