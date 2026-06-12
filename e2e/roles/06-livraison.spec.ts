import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "../helpers/human-actions";
import { createMockDossier } from "../helpers/test-data-creator";
import { STORAGE_KEYS } from "../../src/storage-keys";
import { DossierStatus } from "../../src/types";

test.describe("Rôle : Livraison", () => {
  const dossierNoQc = createMockDossier({
    id: "NIMR-LIV-001",
    clientNom: "No QC Client",
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
      validationGlobale: "en_attente" // Inconsistent status for testing validation block
    }
  });

  const dossierReady = createMockDossier({
    id: "NIMR-LIV-002",
    clientNom: "Ready Client",
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
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ keyDossiers, valDossiers }) => {
      localStorage.clear();
      localStorage.setItem(keyDossiers, JSON.stringify(valDossiers));
    }, {
      keyDossiers: STORAGE_KEYS.dossiers,
      valDossiers: [dossierNoQc, dossierReady]
    });
    await page.reload();
    await changeUserRole(page, "role-option-livraison");
  });

  test("Refus de livraison si le contrôle qualité n'est pas validé", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${dossierNoQc.id}`));
    await humanClick(page, page.locator('[data-testid="tab-deliveries"]'));

    const submit = page.locator('[data-testid="delivery-submit"]');
    await expect(submit).toBeDisabled();

    const reasons = page.locator('[data-testid="delivery-blocking-reasons"]');
    await expect(reasons).toBeVisible();
    await expect(reasons).toHaveText(/qualité/i);
  });

  test("Livraison réussie après signature client et clôture facturation", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${dossierReady.id}`));
    await humanClick(page, page.locator('[data-testid="tab-deliveries"]'));

    // Click signature pad mock
    await humanClick(page, page.locator('[data-testid="delivery-signature"]'));
    await expect(page.locator('[data-testid="delivery-signature"]')).toContainText("Signature client capturée");

    // Click deliver
    await humanClick(page, page.locator('[data-testid="delivery-submit"]'));

    // Verify dossier status transitioned to Livré
    await expect(page.locator('[data-testid="status-badge"]').filter({ hasText: "Livré" })).toBeVisible();

    // Click mark ready for billing
    await humanClick(page, page.locator('[data-testid="delivery-billing"]'));

    // Verify dossier status transitioned to Prêt pour facturation ERP
    await expect(page.locator('[data-testid="status-badge"]').filter({ hasText: "Prêt pour facturation ERP" })).toBeVisible();
  });
});
