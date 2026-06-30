import { test, expect } from "@playwright/test";
import { createDefaultUsers } from "../src/auth";
import { STORAGE_KEYS } from "../src/storage-keys";
import { changeUserRole, humanClick, humanFill, humanSelect } from "./helpers/human-actions";

test.describe("Lot 5B - Connexion et gestion utilisateurs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("page Login visible, erreurs lisibles et utilisateur désactivé refusé", async ({ page }) => {
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
    await expect(page.locator("text=Connexion interne SAV")).toBeVisible();
    const loginPage = page.locator('[data-testid="login-page"]');
    await expect(loginPage.locator("h1")).toHaveText("NIMR SAV PRO");
    await expect(loginPage.locator("text=v1.1.1").first()).toBeVisible();

    await humanFill(page, page.locator('[data-testid="login-username"]'), "directeur");
    await humanFill(page, page.locator('[data-testid="login-pin"]'), "9999");
    await humanClick(page, page.locator('[data-testid="login-submit"]'));
    await expect(page.locator('[data-testid="login-error"]')).toHaveText(/incorrect/i);

    const users = await createDefaultUsers();
    const disabledUsers = users.map(user => user.username === "technicien" ? { ...user, active: false } : user);
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.users, value: disabledUsers });
    await page.reload();

    await humanFill(page, page.locator('[data-testid="login-username"]'), "technicien");
    await humanFill(page, page.locator('[data-testid="login-pin"]'), "3333");
    await humanClick(page, page.locator('[data-testid="login-submit"]'));
    await expect(page.locator('[data-testid="login-error"]')).toHaveText(/désactivé/i);
  });

  test("Directeur gère les utilisateurs, le refresh conserve la session et logout protège l'application", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="director-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-user"]')).toHaveText("Directeur SAV");
    await expect(page.locator('[data-testid="nav-users"]')).toBeVisible();

    await page.reload();
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Directeur SAV");
    await expect(page.locator('[data-testid="login-page"]')).toHaveCount(0);

    await humanClick(page, page.locator('[data-testid="nav-users"]'));
    await expect(page.locator('[data-testid="user-management-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-toggle-directeur"]')).toBeDisabled();
    await expect(page.locator('[data-testid="user-role-directeur"]')).toBeDisabled();

    await humanFill(page, page.locator('[data-testid="user-create-username"]'), "lot5buser");
    await humanFill(page, page.locator('[data-testid="user-create-display-name"]'), "Utilisateur Lot 5B");
    await humanSelect(page, page.locator('[data-testid="user-create-role"]'), "Réceptionnaire");
    await humanFill(page, page.locator('[data-testid="user-create-pin"]'), "7777");
    await humanClick(page, page.locator('[data-testid="user-create-submit"]'));
    await expect(page.locator('[data-testid="user-row-lot5buser"]')).toBeVisible();

    await humanSelect(page, page.locator('[data-testid="user-role-lot5buser"]'), "Technicien");
    await humanClick(page, page.locator('[data-testid="user-save-lot5buser"]'));
    await expect(page.locator('[data-testid="user-management-message"]')).toHaveText(/mis à jour/i);

    await humanFill(page, page.locator('[data-testid="user-reset-pin-lot5buser"]'), "8888");
    await humanClick(page, page.locator('[data-testid="user-reset-submit-lot5buser"]'));
    await expect(page.locator('[data-testid="user-management-message"]')).toHaveText(/PIN réinitialisé/i);

    await humanClick(page, page.locator('[data-testid="logout-button"]'));
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="director-dashboard"]')).toHaveCount(0);

    await humanFill(page, page.locator('[data-testid="login-username"]'), "lot5buser");
    await humanFill(page, page.locator('[data-testid="login-pin"]'), "8888");
    await humanClick(page, page.locator('[data-testid="login-submit"]'));
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Technicien");
    await expect(page.locator('[data-testid="nav-technician"]')).toBeVisible();
  });

  test("Réceptionnaire ne voit pas la gestion utilisateurs", async ({ page }) => {
    await changeUserRole(page, "role-option-receptionnaire");
    await expect(page.locator('[data-testid="nav-users"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="nav-reception"]')).toBeVisible();
  });

  test("Technicien ne voit pas la gestion utilisateurs", async ({ page }) => {
    await changeUserRole(page, "role-option-technicien");
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Technicien");
    await expect(page.locator('[data-testid="nav-technician"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-dossiers"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="nav-users"]')).toHaveCount(0);
  });

  test("Lecture seule ne voit pas la gestion utilisateurs ni les actions réservées", async ({ page }) => {
    await changeUserRole(page, "role-option-lecture-seule");
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Lecture seule");
    await expect(page.locator('[data-testid="nav-users"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="nav-reception"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="force-status-select"]')).toHaveCount(0);
  });
});
