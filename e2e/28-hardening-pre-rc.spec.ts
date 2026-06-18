import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus } from "../src/types";

test.describe("Lot 6E — Hardening métier pré-RC", () => {
  test("Réception bloque téléphone, VIN, kilométrage et plainte invalides", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await changeUserRole(page, "role-option-receptionnaire");
    await humanClick(page, page.locator('[data-testid="nav-reception"]'));

    await humanFill(page, page.locator('[data-testid="reception-client-name"]'), "Ali");
    await humanFill(page, page.locator('[data-testid="reception-client-phone"]'), "+216 XX 000 001");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-error-message"]')).toContainText(/téléphone tunisien invalide/i);

    await humanFill(page, page.locator('[data-testid="reception-client-phone"]'), "+216 20 000 001");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));

    await humanFill(page, page.locator('[data-testid="reception-vehicle-model"]'), "Shine Max");
    await humanFill(page, page.locator('[data-testid="reception-plate"]'), "123 TU 456");
    await humanFill(page, page.locator('[data-testid="reception-vin"]'), "VIN-COURT");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-warning-message"]')).toContainText(/VIN invalide/i);
    await humanClick(page, page.locator('[data-testid="reception-previous"]'));

    await humanFill(page, page.locator('[data-testid="reception-vin"]'), "");
    await humanFill(page, page.locator('[data-testid="reception-mileage"]'), "-5");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-error-message"]')).toContainText(/kilométrage/i);

    await humanFill(page, page.locator('[data-testid="reception-mileage"]'), "15000");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await humanFill(page, page.locator('[data-testid="reception-reason"]'), "ok");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-error-message"]')).toContainText(/motif/i);
  });

  test("Technicien ne peut pas clôturer une tâche avec un diagnostic court", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-6E-TECH",
      clientNom: "Client Diagnostic",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        { id: "ro_6e_diag", designation: "Diagnostic frein", tempsEstime: 1, tempsPasse: 0.2, status: "in_progress" },
      ],
    });

    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [dossier] });
    await changeUserRole(page, "role-option-technicien");
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    await humanClick(page, page.locator('[data-testid="task-finish-ro_6e_diag"]'));
    await expect(page.locator('[data-testid="modal-task-finish"]')).toBeVisible();
    await humanFill(page, page.locator('[data-testid="modal-task-finish-cause"]'), "ok");
    await expect(page.locator('[data-testid="modal-task-finish-confirm"]')).toBeDisabled();

    await humanFill(page, page.locator('[data-testid="modal-task-finish-cause"]'), "Usure anormale confirmée après contrôle visuel complet.");
    await humanFill(page, page.locator('[data-testid="modal-task-finish-action"]'), "Remplacement des plaquettes et contrôle du serrage effectué.");
    await humanFill(page, page.locator('[data-testid="modal-task-finish-validation"]'), "Essai statique conforme sans bruit résiduel détecté.");
    await expect(page.locator('[data-testid="modal-task-finish-confirm"]')).toBeEnabled();
  });

  test("Documents internes imprimables disponibles depuis le détail dossier", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-6E-PRINT",
      clientNom: "Client Documents",
      statut: DossierStatus.CONTROLE_QUALITE,
    });

    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [dossier] });
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${dossier.id}`));
    await humanClick(page, page.locator('[data-testid="tab-documents"]'));

    await expect(page.locator('[data-testid="print-reception"]')).toBeVisible();
    await expect(page.locator('[data-testid="print-or"]')).toBeVisible();
    await expect(page.locator('[data-testid="print-qc"]')).toBeVisible();
    await expect(page.locator('[data-testid="print-delivery"]')).toBeVisible();
  });

  test("Session expirée revient à l'écran de connexion avec message clair", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __TEST_SESSION_TIMEOUT__: number }).__TEST_SESSION_TIMEOUT__ = 300;
    });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await changeUserRole(page, "role-option-receptionnaire");
    await page.waitForTimeout(450);
    await page.keyboard.press("Tab");

    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
  });
});
