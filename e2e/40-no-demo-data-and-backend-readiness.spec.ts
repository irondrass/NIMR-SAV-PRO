import { test, expect } from "@playwright/test";
import { humanClick } from "./helpers/human-actions";

async function loginReception(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
  await page.locator('[data-testid="login-username"]').fill("reception");
  await page.locator('[data-testid="login-pin"]').fill("1111");
  await page.locator('[data-testid="login-submit"]').click();
  await expect(page.locator('[data-testid="nav-dossiers"]')).toBeVisible();
}

test.describe("Lot 6K-G - runtime vide et préparation backend", () => {
  test("l'application démarre sans données démo et affiche des états vides utiles", async ({ page }) => {
    const forbiddenRequests: string[] = [];
    page.on("request", request => {
      const url = request.url();
      if (!url.includes("localhost") && !url.includes("127.0.0.1") && /(\/api\/|supabase|auth)/i.test(url)) {
        forbiddenRequests.push(url);
      }
    });

    await page.addInitScript(() => localStorage.clear());
    await loginReception(page);

    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await expect(page.locator('[data-testid="empty-state-dossiers"]')).toContainText("Aucune donnée enregistrée");
    await expect(page.locator('[data-testid="empty-state-clients"]')).toHaveCount(1);
    await humanClick(page, page.locator('[data-testid="dossier-mode-vehicles"]'));
    await expect(page.locator('[data-testid="empty-state-vehicles"]').first()).toContainText("Aucune donnée enregistrée");

    await humanClick(page, page.locator('[data-testid="nav-reception"]'));
    await expect(page.locator('[data-testid="empty-state-vehicles"]').first()).toContainText("Aucune base véhicules importée");
    await expect(page.locator('[data-testid="import-vehicles-empty-action"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="preset-client"]')).toHaveCount(0);

    await expect(page.locator("body")).not.toContainText("Client Démo");
    await expect(page.locator("body")).not.toContainText("Société Démo");
    await expect(page.locator("body")).not.toContainText("Technicien Démo");
    expect(forbiddenRequests).toEqual([]);
  });
});
