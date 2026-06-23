import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus } from "../src/types";

test.describe("Lot 4A - Kanban Board visual", () => {
  const dossiers = [
    createMockDossier({ id: "NIMR-K-001", clientNom: "Client K1", statut: DossierStatus.VEHICULE_RECU }),
    createMockDossier({ id: "NIMR-K-002", clientNom: "Client K2", statut: DossierStatus.EN_TRAVAUX }),
    createMockDossier({ id: "NIMR-K-003", clientNom: "Client K3", statut: DossierStatus.BLOQUE, bloqueRaison: "Panne d'outillage" }),
    createMockDossier({ id: "NIMR-K-004", clientNom: "Client K4", statut: DossierStatus.PRET_A_LIVRER }),
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: dossiers });
    await page.reload();
  });

  test("Accès au Kanban et affichage des colonnes et dossiers", async ({ page }) => {
    await changeUserRole(page, "role-option-chef-atelier");
    await expect(page.locator('[data-testid="nav-kanban"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="nav-kanban"]'));

    // Check header
    await expect(page.locator("text=Tableau Kanban d'Avancement de l'Atelier")).toBeVisible();

    // Check columns are visible
    await expect(page.locator("text=1. Réceptionnés (1)")).toBeVisible();
    await expect(page.locator("text=2. En travaux (1)")).toBeVisible();
    await expect(page.locator("text=3. Bloqués (1)")).toBeVisible();
    await expect(page.locator("text=4. Contrôle Qualité (0)")).toBeVisible();
    await expect(page.locator("text=5. Prêt à livrer (1)")).toBeVisible();

    // Check dossier IDs and client names are shown inside columns
    await expect(page.locator("text=Client K1")).toBeVisible();
    await expect(page.locator("text=Client K2")).toBeVisible();
    await expect(page.locator("text=Client K3")).toBeVisible();
    await expect(page.locator("text=Panne d'outillage")).toBeVisible();
    await expect(page.locator("text=Client K4")).toBeVisible();
  });

  test("Clic sur un dossier ouvre le détail du dossier", async ({ page }) => {
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-kanban"]'));

    // Click client card K2
    await humanClick(page, page.locator("text=Client K2"));

    // Should open detail view of the dossier
    await expect(page.locator('[data-testid="dossier-detail-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="dossier-back-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="dossier-detail-view"]').getByText("NIMR-K-002").first()).toBeVisible();
    await expect(page.locator('[data-testid="dossier-detail-view"]').getByText("Client K2").first()).toBeVisible();
  });
});
