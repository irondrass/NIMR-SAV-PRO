import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanSelect } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { ChecklistQualite, DossierPriority, DossierStatus } from "../src/types";

const qcConforme: ChecklistQualite = {
  essaiEffectue: true,
  defautRepare: true,
  aucunVoyantAllume: true,
  niveauxVerifies: true,
  serrageSecurite: true,
  propreteVehicule: true,
  documentsPrets: true,
  photosApresOk: true,
  validationGlobale: "valide",
  dateValidation: "2026-06-15T10:00:00.000Z",
  validePar: "Contrôle Qualité",
};

test.describe("Lot 5 - Dashboard Directeur SAV avec filtres", () => {
  const dossiers = [
    createMockDossier({
      id: "NIMR-D-001",
      clientNom: "Client Crit1",
      statut: DossierStatus.EN_TRAVAUX,
      priorite: DossierPriority.VEHICULE_IMMOBILISE,
    }),
    createMockDossier({
      id: "NIMR-D-002",
      clientNom: "Client Norm1",
      statut: DossierStatus.VEHICULE_RECU,
      priorite: DossierPriority.NORMALE,
    }),
    createMockDossier({
      id: "NIMR-D-003",
      clientNom: "Client Crit2",
      statut: DossierStatus.PRET_A_LIVRER,
      priorite: DossierPriority.VEHICULE_IMMOBILISE,
      checklistQC: qcConforme,
    }),
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: dossiers });
    await page.reload();
  });

  test("Affichage global et application des filtres de priorité et de statut", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="director-dashboard"]')).toBeVisible();

    // Verify all dossiers are counted globally
    // kpi-open-dossiers should show 3 (since there are 3 open dossiers in total)
    const openKpi = page.locator('[data-testid="kpi-open-dossiers"]');
    await expect(openKpi).toContainText("3");

    // Filter by Priority: VEHICULE_IMMOBILISE
    await humanSelect(page, page.locator('[data-testid="dashboard-filter-priority"]'), DossierPriority.VEHICULE_IMMOBILISE);

    // Now only 2 dossiers (Client Crit1 and Client Crit2) are VEHICULE_IMMOBILISE
    await expect(openKpi).toContainText("2");

    // Filter by Status: pret_a_livrer (Prêt à livrer)
    await humanSelect(page, page.locator('[data-testid="dashboard-filter-status"]'), DossierStatus.PRET_A_LIVRER);

    // Now only 1 dossier fits both (Client Crit2 is VEHICULE_IMMOBILISE and PRET_A_LIVRER)
    await expect(openKpi).toContainText("1");

    // Filter by Priority: NORMALE
    await humanSelect(page, page.locator('[data-testid="dashboard-filter-priority"]'), DossierPriority.NORMALE);

    // 0 dossiers fits both (Client Norm1 is NORMALE but VEHICULE_RECU, not PRET_A_LIVRER)
    await expect(openKpi).toContainText("0");

    // Reset filters to "all"
    await humanSelect(page, page.locator('[data-testid="dashboard-filter-priority"]'), "all");
    await humanSelect(page, page.locator('[data-testid="dashboard-filter-status"]'), "all");

    // Count goes back to 3
    await expect(openKpi).toContainText("3");
  });

  test("Filtre par période de temps", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="director-dashboard"]')).toBeVisible();

    // Click on today filter
    await humanClick(page, page.locator('[data-testid="dashboard-period-today"]'));
    // Make sure today button is active (pressed)
    await expect(page.locator('[data-testid="dashboard-period-today"]')).toHaveAttribute("aria-pressed", "true");

    // Click on week filter
    await humanClick(page, page.locator('[data-testid="dashboard-period-week"]'));
    await expect(page.locator('[data-testid="dashboard-period-week"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-testid="dashboard-period-today"]')).toHaveAttribute("aria-pressed", "false");
  });
});
