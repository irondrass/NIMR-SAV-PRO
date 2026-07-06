import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";

test.describe("48 - Terrain P1 pilot readiness checks", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
  });

  test("AT-010 et warning badges: Lecture seule et badges pilote/recette visibles", async ({ page }) => {
    // Log in as Directeur first to see the Directeur SAV dashboard
    await changeUserRole(page, "role-option-directeur");

    // 1. Verify warning badges
    await expect(page.locator('[data-testid="pilot-warning-badge-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="pilot-warning-badge-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="pilot-warning-badge-sidebar"]')).toHaveText("Données pilote / recette");
    await expect(page.locator('[data-testid="pilot-warning-badge-dashboard"]')).toHaveText("Données pilote / recette");

    // 2. Log out and switch to Lecture seule
    await humanClick(page, page.locator('[data-testid="logout-button"]'));
    await changeUserRole(page, "role-option-lecture-seule");

    // Verify dynamic header title is "Lecture seule" instead of "Directeur SAV"
    await expect(page.locator('[data-testid="director-dashboard"]').getByText("Lecture seule")).toBeVisible();
    await expect(page.getByText("Directeur SAV")).toHaveCount(0);
  });

  test("AT-002: Mobile top navigation bar fixed/sticky and menu accessible", async ({ page }) => {
    // Switch to a mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await changeUserRole(page, "role-option-directeur");

    // Verify mobile warning badge
    await expect(page.locator('[data-testid="pilot-warning-badge-mobile"]')).toBeVisible();

    // Verify mobile top navigation bar is fixed
    const topBar = page.locator('.md\\:hidden.flex.items-center.justify-between');
    await expect(topBar).toHaveCSS("position", "fixed");

    // Click mobile menu button
    await humanClick(page, page.locator('[data-testid="mobile-menu-button"]'));

    // Verify sidebar drawer is visible and covers height
    const aside = page.locator('aside');
    await expect(aside).toBeVisible();
    await expect(aside).toHaveCSS("position", "fixed");
  });
});
