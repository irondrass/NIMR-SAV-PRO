import { Page, Locator, expect } from "@playwright/test";
import { STORAGE_KEYS } from "../../src/storage-keys";

// Deterministic small wait to simulate user pacing without causing flakiness
export async function humanWait(page: Page, ms = 150) {
  await page.waitForTimeout(ms);
}

export async function humanClick(page: Page, locator: Locator) {
  await locator.waitFor({ state: "visible", timeout: 5000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
  await humanWait(page);
}

export async function humanFill(page: Page, locator: Locator, value: string) {
  await locator.waitFor({ state: "visible", timeout: 5000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.fill(value);
  await humanWait(page);
}

export async function humanSelect(page: Page, locator: Locator, value: string) {
  await locator.waitFor({ state: "visible", timeout: 5000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.selectOption(value);
  await humanWait(page);
}

export async function humanBack(page: Page) {
  await page.goBack();
  await humanWait(page);
}

export async function humanRefresh(page: Page) {
  await page.reload();
  await humanWait(page, 300); // Give a bit more time after refresh
}

export async function expectNoBlockingConsoleErrors(page: Page, consoleErrors: string[]) {
  // Check if there are any recorded severe console errors or page errors
  expect(consoleErrors.length, `Severe console errors detected: ${consoleErrors.join("\n")}`).toBe(0);
}

export async function expectNoAsset404(failedRequests: string[]) {
  expect(failedRequests.length, `Asset 404 requests detected: ${failedRequests.join("\n")}`).toBe(0);
}

export async function expectOnlyNimrSavProStorage(page: Page) {
  const keys: string[] = await page.evaluate(() => Object.keys(localStorage));
  const badKeys = keys.filter(key => {
    // Should start with nimr-sav-pro
    // If it starts with nimr-sav or nimr_sav but NOT nimr-sav-pro, it is a bad key
    if ((key.startsWith("nimr-sav") || key.startsWith("nimr_sav")) && !key.startsWith("nimr-sav-pro")) {
      return true;
    }
    return false;
  });
  expect(badKeys.length, `LocalStorage contains legacy or prohibited keys: ${badKeys.join(", ")}`).toBe(0);
}

export async function changeUserRole(page: Page, roleTestIdOrValue: string) {
  const TESTID_TO_LOGIN: Record<string, { username: string; pin: string; role: string }> = {
    "role-option-directeur": { username: "directeur", pin: "0000", role: "Directeur SAV" },
    "role-option-receptionnaire": { username: "reception", pin: "1111", role: "Réceptionnaire" },
    "role-option-chef-atelier": { username: "chefatelier", pin: "2222", role: "Chef d’atelier" },
    "role-option-technicien": { username: "technicien", pin: "3333", role: "Technicien" },
    "role-option-controle-qualite": { username: "qc", pin: "4444", role: "Contrôle Qualité" },
    "role-option-livraison": { username: "livraison", pin: "5555", role: "Livraison" },
    "role-option-lecture-seule": { username: "lecture", pin: "9999", role: "Lecture seule" }
  };

  const login = TESTID_TO_LOGIN[roleTestIdOrValue] ?? TESTID_TO_LOGIN["role-option-directeur"];
  await page.evaluate((sessionKey) => {
    localStorage.removeItem(sessionKey);
  }, STORAGE_KEYS.session);
  await page.reload();

  await page.locator('[data-testid="login-page"]').waitFor({ state: "visible", timeout: 7000 });
  await humanFill(page, page.locator('[data-testid="login-username"]'), login.username);
  await humanFill(page, page.locator('[data-testid="login-pin"]'), login.pin);
  await humanClick(page, page.locator('[data-testid="login-submit"]'));
  await expect(page.locator('[data-testid="current-role"]')).toHaveText(login.role, { timeout: 7000 });
}
