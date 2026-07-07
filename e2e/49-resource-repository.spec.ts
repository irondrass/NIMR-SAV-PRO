import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";

test.describe("49 - Référentiel Atelier E2E tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      indexedDB.deleteDatabase("nimr-sav-pro-local-db");
    });
    await page.goto("/");
  });

  test("Rôle Directeur SAV: Navigation et accès complet au Référentiel", async ({ page }) => {
    // 1. Log in as Directeur SAV
    await changeUserRole(page, "role-option-directeur");

    // 2. Navigation item is visible and clickable
    const navItem = page.locator('[data-testid="nav-referentiel-atelier"]');
    await expect(navItem).toBeVisible();
    await humanClick(page, navItem);

    // 3. Verify main header text
    await expect(page.getByText("Référentiel Ressources Atelier")).toBeVisible();
  });

  test("Rôle Technicien: Aucun accès au Référentiel", async ({ page }) => {
    // 1. Log in as Technicien
    await changeUserRole(page, "role-option-technicien");

    // 2. Navigation item is NOT visible
    const navItem = page.locator('[data-testid="nav-referentiel-atelier"]');
    await expect(navItem).not.toBeVisible();
  });

  test("Gestion des utilisateurs (Tab A)", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-referentiel-atelier"]'));

    // Select Users Tab
    await humanClick(page, page.locator('[data-testid="tab-users"]'));

    // Check table exists
    await expect(page.locator('[data-testid="table-users"]')).toBeVisible();

    // Click add user
    await humanClick(page, page.locator('[data-testid="btn-add-user"]'));

    // Fill form
    await humanFill(page, page.locator('input[placeholder="ex: j.dupont"]'), "e2euser");
    await humanFill(page, page.locator('input[placeholder="Jean Dupont"]'), "E2E User Test");
    await humanFill(page, page.locator('input[placeholder="Code numérique"]'), "1234");
    
    // Save
    await humanClick(page, page.locator('[data-testid="btn-save-user"]'));

    // Verify user is in list
    await expect(page.locator('[data-testid="table-users"]')).toContainText("e2euser");
    await expect(page.locator('[data-testid="table-users"]')).toContainText("E2E User Test");
  });

  test("Gestion des compagnons (Tab B)", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-referentiel-atelier"]'));

    // Select Companions Tab
    await humanClick(page, page.locator('[data-testid="tab-companions"]'));

    // Check table
    await expect(page.locator('[data-testid="table-companions"]')).toBeVisible();

    // Add companion
    await humanClick(page, page.locator('[data-testid="btn-add-companion"]'));

    // Fill form
    await humanFill(page, page.locator('input[placeholder="ex: M. Ali"]'), "Compagnon E2E");
    await humanFill(page, page.locator('input[placeholder="ex: Mécanicien Moteur"]'), "Tôlier Expert");
    
    // Select trade principal
    await page.locator('select').nth(0).selectOption("TOLERIE");

    // Save
    await humanClick(page, page.locator('[data-testid="btn-save-companion"]'));

    // Verify added
    await expect(page.locator('[data-testid="table-companions"]')).toContainText("Compagnon E2E");

    // Click delete on the first row's "Supprimer" button
    await humanClick(page, page.locator('text=Supprimer').first());

    // Expect confirmation panel to be visible
    const confirmPanel = page.locator('[data-testid="resource-confirmation-panel"]');
    await expect(confirmPanel).toBeVisible();

    // Expect correct warning message
    await expect(page.locator('[data-testid="resource-confirmation-message"]')).toContainText("Confirmer la désactivation de ce compagnon ?");

    // Click cancel
    await humanClick(page, page.locator('[data-testid="resource-confirmation-cancel"]'));

    // Expect confirmation panel to be hidden
    await expect(confirmPanel).not.toBeVisible();

    // Click delete again
    await humanClick(page, page.locator('text=Supprimer').first());
    await expect(confirmPanel).toBeVisible();

    // Click confirm
    await humanClick(page, page.locator('[data-testid="resource-confirmation-confirm"]'));
    await expect(confirmPanel).not.toBeVisible();
  });

  test("Gestion des ressources matérielles (Tab C)", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-referentiel-atelier"]'));

    // Select Materials Tab
    await humanClick(page, page.locator('[data-testid="tab-materials"]'));

    // Check table
    await expect(page.locator('[data-testid="table-materials"]')).toBeVisible();

    // Add material
    await humanClick(page, page.locator('[data-testid="btn-add-material"]'));

    // Fill form
    await humanFill(page, page.locator('input[placeholder="ex: bay_mecanique_01"]'), "bay_e2e_01");
    await humanFill(page, page.locator('input[placeholder="ex: Pont Double Ciseaux 1"]'), "Pont E2E Test");

    // Save
    await humanClick(page, page.locator('[data-testid="btn-save-material"]'));

    // Verify added
    await expect(page.locator('[data-testid="table-materials"]')).toContainText("Pont E2E Test");

    // Click delete on the first row's "Supprimer" button
    await humanClick(page, page.locator('text=Supprimer').first());

    // Expect confirmation panel to be visible
    const confirmPanel = page.locator('[data-testid="resource-confirmation-panel"]');
    await expect(confirmPanel).toBeVisible();

    // Expect correct warning message
    await expect(page.locator('[data-testid="resource-confirmation-message"]')).toContainText("Confirmer la désactivation de cette ressource matérielle ?");

    // Click cancel
    await humanClick(page, page.locator('[data-testid="resource-confirmation-cancel"]'));

    // Expect confirmation panel to be hidden
    await expect(confirmPanel).not.toBeVisible();

    // Click delete again
    await humanClick(page, page.locator('text=Supprimer').first());
    await expect(confirmPanel).toBeVisible();

    // Click confirm
    await humanClick(page, page.locator('[data-testid="resource-confirmation-confirm"]'));
    await expect(confirmPanel).not.toBeVisible();
  });

  test("Diagnostic du Référentiel (Tab D)", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-referentiel-atelier"]'));

    // Select Diagnostic Tab
    await humanClick(page, page.locator('[data-testid="tab-diagnostic"]'));

    // Verify it either shows clean status or list of issues
    const isCleanVisible = await page.getByText("Référentiel 100% Cohérent").isVisible();
    if (!isCleanVisible) {
      await expect(page.locator('[data-testid="diagnostic-issues-list"]')).toBeVisible();
    }
  });
});
