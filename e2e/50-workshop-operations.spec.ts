import { expect, test } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";

test.describe("50 - Pilotage atelier multi-ressources", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      indexedDB.deleteDatabase("nimr-sav-pro-local-db");
    });
    await page.goto("/");
  });

  test("le Directeur recherche un creneau et le mode local reste non confirme", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.getByTestId("nav-pilotage-atelier"));
    await expect(page.getByTestId("workshop-operations-view")).toBeVisible();
    await expect(page.getByText("Propositions locales uniquement")).toBeVisible();

    const selector = page.getByTestId("workshop-task-selector");
    const options = selector.locator("option");
    if (await options.count() > 1) {
      await selector.selectOption({ index: 1 });
      await humanClick(page, page.getByTestId("find-workshop-slot"));
      await expect(page.getByTestId("workshop-scheduling-feedback")).toBeVisible();
    }
  });

  test("le role Lecture seule peut consulter sans enregistrer", async ({ page }) => {
    await changeUserRole(page, "role-option-lecture-seule");
    await humanClick(page, page.getByTestId("nav-pilotage-atelier"));
    await expect(page.getByTestId("workshop-operations-view")).toBeVisible();
    await expect(page.getByText("Enregistrer", { exact: true })).not.toBeVisible();
  });

  test("le Technicien n'accede pas au pilotage global", async ({ page }) => {
    await changeUserRole(page, "role-option-technicien");
    await expect(page.getByTestId("nav-pilotage-atelier")).not.toBeVisible();
  });
});
