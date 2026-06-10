import { test, expect } from "@playwright/test";
import { 
  humanWait, 
  expectNoBlockingConsoleErrors, 
  expectNoAsset404, 
  expectOnlyNimrSavProStorage 
} from "./helpers/human-actions";

test.describe("Fumée & Sécurité (Smoke & Safety)", () => {
  let consoleErrors: string[] = [];
  let failedRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    failedRequests = [];

    // Listen for console errors
    page.on("pageerror", (exception) => {
      consoleErrors.push(exception.message);
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for 404 failures in requests
    page.on("response", (response) => {
      if (response.status() === 404) {
        failedRequests.push(response.url());
      }
    });
  });

  test("Chargement de l'application et vérification générale de sécurité", async ({ page }) => {
    // Start with a clean local storage
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Verify Title and Base URL
    await expect(page).toHaveTitle(/NIMR SAV PRO/);
    expect(page.url()).toContain("/NIMR-SAV-PRO/");

    // Allow application to mount and check elements
    await humanWait(page, 300);

    // Assert lack of console errors
    await expectNoBlockingConsoleErrors(page, consoleErrors);

    // Assert no 404 assets
    await expectNoAsset404(failedRequests);

    // Assert only nimr-sav-pro keys in localStorage
    await expectOnlyNimrSavProStorage(page);
  });
});
