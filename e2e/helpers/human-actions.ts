import { Page, Locator, expect } from "@playwright/test";

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
  const TESTID_TO_ROLE: Record<string, string> = {
    "role-option-directeur": "Directeur SAV",
    "role-option-receptionnaire": "Réceptionnaire",
    "role-option-chef-atelier": "Chef d’atelier",
    "role-option-technicien": "Technicien",
    "role-option-controle-qualite": "Contrôle Qualité",
    "role-option-lecture-seule": "Lecture seule"
  };

  const roleValue = TESTID_TO_ROLE[roleTestIdOrValue] || roleTestIdOrValue;
  await page.evaluate(({ key, val }) => {
    localStorage.setItem(key, val);
  }, { key: "nimr-sav-pro-user-role-v1", val: roleValue });
  await page.reload();
  await page.waitForTimeout(150);
}


