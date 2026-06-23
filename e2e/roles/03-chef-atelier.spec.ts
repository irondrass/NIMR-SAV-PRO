import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "../helpers/human-actions";
import { createMockDossier, createMockTech } from "../helpers/test-data-creator";
import { STORAGE_KEYS } from "../../src/storage-keys";
import { DossierStatus } from "../../src/types";

test.describe("Rôle : Chef d'Atelier", () => {
  const testDossier = createMockDossier({
    id: "NIMR-CHEF-001",
    clientNom: "Chef Client Test",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [
      {
        id: "ro_chef_1",
        designation: "Mécanique standard",
        tempsEstime: 3.0,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: true,
        durationValidationReason: "Fixture E2E planning validée Chef Atelier",
        durationValidatedBy: "chefatelier",
        durationValidatedAt: "2026-06-15T08:00:00.000Z",
      }
    ]
  });

  const testTech = createMockTech({
    id: "tech_chef_01",
    nom: "Tech Chef Standard",
    disponibilite: "disponible"
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ keyDossiers, keyTechs, valDossiers, valTechs }) => {
      localStorage.clear();
      localStorage.setItem(keyDossiers, JSON.stringify(valDossiers));
      localStorage.setItem(keyTechs, JSON.stringify(valTechs));
    }, {
      keyDossiers: STORAGE_KEYS.dossiers,
      valDossiers: [testDossier],
      keyTechs: STORAGE_KEYS.techs,
      valTechs: [testTech]
    });
    await page.reload();
    await changeUserRole(page, "role-option-chef-atelier");
  });

  test("Habilitations restrictives du Chef d'Atelier", async ({ page }) => {
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Chef d’atelier");

    // Planning, Kanban, Chef Atelier tabs should be visible
    await expect(page.locator('[data-testid="nav-planning"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-chef-atelier"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-dossiers"]')).toBeVisible();

    // Guided reception should be hidden
    await expect(page.locator('[data-testid="nav-reception"]')).not.toBeVisible();
  });

  test("Calcul de suggestion de planification et application", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    // Select dossier from selector
    const suggestDossierSelect = page.locator('[data-testid="planning-suggest-dossier"]');
    await expect(suggestDossierSelect).toBeVisible();
    await suggestDossierSelect.selectOption(testDossier.id);

    // Request auto-suggestion slot
    const suggestSubmit = page.locator('[data-testid="planning-suggest-submit"]');
    await humanClick(page, suggestSubmit);

    // Expect suggested tech, bay, and apply button to be displayed
    await expect(page.locator('[data-testid="planning-suggest-tech"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-suggest-bay"]')).toBeVisible();

    const applyBtn = page.locator('[data-testid="planning-suggest-apply"]');
    await expect(applyBtn).toBeVisible();

    // Apply slot suggestion
    await humanClick(page, applyBtn);

    // Navigate to dossiers list and verify status of planned dossier
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));

    // Assert that dossier is now in "Travaux Planifiés"
    await expect(page.locator('[data-testid="status-badge"]').filter({ hasText: "Travaux planifiés" })).toBeVisible();
  });
});
