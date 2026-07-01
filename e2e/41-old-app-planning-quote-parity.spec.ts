import { test, expect, Page } from "@playwright/test";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus } from "../src/types";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier, createWorkshopTechnicians } from "./helpers/test-data-creator";

async function seedStorage(page: Page, dossiers: unknown[]) {
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue, techniciansValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.techs, JSON.stringify(techniciansValue));
    localStorage.setItem(keys.reservations, JSON.stringify([]));
  }, {
    keys: STORAGE_KEYS,
    dossiersValue: dossiers,
    techniciansValue: createWorkshopTechnicians(),
  });
  await page.reload();
}

async function openDossierAsChef(page: Page, dossierId: string) {
  await changeUserRole(page, "role-option-chef-atelier");
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanClick(page, page.locator(`[data-testid="dossier-card-${dossierId}"]`));
}

test.describe("Old app parity - Planning et Import Devis", () => {
  test("Import devis reprend Durées estimées, mapping, peinture, tâches, réservation et Gantt", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-07-01T07:00:00"));
    const dossierId = "NIMR-OLD-PARITY";
    const dossier = createMockDossier({
      id: dossierId,
      statut: DossierStatus.EN_TRAVAUX,
      ordresReparation: [],
    });
    const quoteText = [
      "MO-TOL D/P ET PREPARATION PARE-CHOCS AV 2 35,000 70,000",
      "MO-TOL PEINTURE ET FINITION PORTE DR 3 35,000 105,000",
      "ART-FILTRE Filtre huile 1 25,000 25,000",
    ].join("\n");

    await seedStorage(page, [dossier]);
    await openDossierAsChef(page, dossierId);
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    await humanClick(page, page.locator('[data-testid="import-quote-pdf-button"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).toBeVisible();
    await humanFill(page, page.locator('[data-testid="quote-text-input"]'), quoteText);
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));

    await expect(page.locator('[data-testid="old-app-duration-review"]')).toBeVisible();
    await expect(page.locator('[data-testid="old-app-labor-row"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="old-app-line-number"]').first()).toHaveText("1");
    await expect(page.locator('[data-testid="old-app-labor-label"]').first()).toContainText(/D\/P|Preparation/i);
    await expect(page.locator('[data-testid="old-app-labor-origin"]').first()).toContainText("MO-TOL");
    await expect(page.locator('[data-testid="old-app-labor-duration"]').first()).toContainText("2");
    await expect(page.locator('[data-testid="old-app-stage-body"]').first()).toBeChecked();
    await expect(page.locator('[data-testid="old-app-stage-reassembly"]').first()).toBeChecked();
    await expect(page.locator('[data-testid="old-app-stage-prep"]').nth(1)).toBeChecked();
    await expect(page.locator('[data-testid="old-app-stage-paint"]').nth(1)).toBeChecked();
    await expect(page.locator('[data-testid="old-app-allocation-badges"]').nth(1)).toContainText("Preparation");
    await expect(page.locator('[data-testid="old-app-piece-kind"]').nth(1)).toHaveValue("new");
    await expect(page.locator('[data-testid="old-app-paint-faces"]').nth(1)).toHaveValue("two_sides");
    await expect(page.locator('[data-testid="old-app-paint-group"]').nth(1)).toHaveValue("right");
    await expect(page.locator('[data-testid="old-app-paint-mutualization"]')).toContainText("Peinture mutualisée");
    await expect(page.locator('[data-testid="old-app-total-atelier"]')).toContainText("Total atelier");

    await expect(page.locator('[data-testid="quote-import-modal"]')).not.toContainText("35,000");
    await expect(page.locator('[data-testid="quote-import-modal"]')).not.toContainText("105,000");
    await expect(page.locator('[data-testid="quote-import-modal"]')).not.toContainText(/paiement|caisse|stock réel/i);

    await humanClick(page, page.locator('[data-testid="quote-import-confirm"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).not.toBeVisible();
    const taskCards = page.locator('[data-testid="workshop-task-card"]');
    await expect(taskCards.filter({ hasText: "D/P et préparation PARE-CHOCS AV" })).toHaveCount(2);
    await expect(taskCards.filter({ hasText: "Peinture et finition PORTE DR" })).toHaveCount(1);
    await expect(taskCards.filter({ hasText: "Peinture mutual" })).toHaveCount(1);
    await expect(taskCards.filter({ hasText: "Finition + lavage" })).toHaveCount(1);
    await expect(taskCards.filter({ hasText: "Controle qualite" })).toHaveCount(1);

    await humanClick(page, page.locator('[data-testid="tab-rdv-planning"]'));
    await humanClick(page, page.locator('[data-testid="reserve-all-workshop-tasks"]'));
    await expect(page.locator('[data-testid="reservation-first-slot-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="reservation-start"]')).toContainText(/\d{2}:\d{2}/);

    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await expect(page.locator('[data-testid="planning-gantt-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid^="gantt-block-"]').first()).toBeVisible();

    const persisted = await page.evaluate(({ dossierKey, dossierId }) => {
      const dossiers = JSON.parse(localStorage.getItem(dossierKey) || "[]");
      return dossiers.find((item: any) => item.id === dossierId);
    }, { dossierKey: STORAGE_KEYS.dossiers, dossierId });

    expect(persisted.ordresReparation.some((line: any) => line.workshopStageId === "body-disassembly")).toBe(true);
    expect(persisted.ordresReparation.some((line: any) => line.workshopStageId === "reassembly")).toBe(true);
    expect(persisted.ordresReparation.some((line: any) => line.workshopStageId === "preparation")).toBe(true);
    expect(persisted.ordresReparation.some((line: any) => line.workshopStageId === "paint")).toBe(true);
    expect(persisted.ordresReparation.some((line: any) => line.workshopStageId === "finish")).toBe(true);
    expect(persisted.ordresReparation.some((line: any) => line.workshopStageId === "quality")).toBe(true);
  });
});
