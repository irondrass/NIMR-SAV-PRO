import { expect, type Locator, type Page, test } from "@playwright/test";
import { MOCK_TECHNICIENS } from "../src/data";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus, TechnicienResource, WorkshopReservation } from "../src/types";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";

async function seedPlanning(
  page: Page,
  dossiers: DossierSAV[],
  options: {
    technicians?: TechnicienResource[];
    reservations?: WorkshopReservation[];
  } = {}
) {
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue, techniciansValue, reservationsValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.techs, JSON.stringify(techniciansValue));
    localStorage.setItem(keys.reservations, JSON.stringify(reservationsValue));
  }, {
    keys: STORAGE_KEYS,
    dossiersValue: dossiers,
    techniciansValue: options.technicians ?? MOCK_TECHNICIENS,
    reservationsValue: options.reservations ?? [],
  });
  await page.reload();
}

const RESERVE_FEEDBACK_SELECTORS = [
  '[data-testid="planning-suggestion-panel"]',
  '[data-testid="planning-reservation-success"]',
  '[data-testid="planning-reservation-error"]',
  '[data-testid="planning-reservation-feedback"]',
];

async function expectReserveClickFeedback(card: Locator) {
  await expect.poll(async () => {
    for (const selector of RESERVE_FEEDBACK_SELECTORS) {
      if (await card.locator(selector).first().isVisible().catch(() => false)) {
        return selector;
      }
    }

    return "";
  }, {
    message: "Le clic À réserver doit afficher un feedback visible.",
  }).not.toBe("");
}

function createReservableDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return createMockDossier({
    id: "NIMR-RESERVE-FB",
    clientNom: "Client Reserve Feedback",
    vehiculeImmatriculation: "910 TU 9100",
    vehiculeVIN: "RESERVEFEEDBACK001",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [{
      id: "task-reserve-feedback",
      designation: "Diagnostic bouton reservation",
      tempsEstime: 1,
      tempsPasse: 0,
      status: "pending",
      isEstimatedDurationValidated: true,
    }],
    ...overrides,
  });
}

function createPendingReservation(dossier: DossierSAV): WorkshopReservation {
  return {
    reservationId: `res-${dossier.id}`,
    dossierId: dossier.id,
    taskIds: [dossier.ordresReparation[0].id],
    totalHours: 1,
    desiredDate: "2026-06-24T08:00:00.000Z",
    status: "A_RESERVER",
    source: "manual",
    history: [],
  };
}

test.describe("Hotfix Planning - bouton À réserver avec feedback visible", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockDate = new Date("2026-06-24T07:00:00");
      const NativeDate = Date;
      class MockDate extends NativeDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockDate.getTime());
          } else {
            // @ts-ignore
            super(...args);
          }
        }
        static now() {
          return mockDate.getTime();
        }
      }
      // @ts-ignore
      window.Date = MockDate;
    });
  });

  test("Chef Atelier clique À réserver : une suggestion visible est créée", async ({ page }) => {
    const dossier = createReservableDossier();
    await seedPlanning(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    const card = page.locator('[data-testid="reservation-need-card"]').filter({ hasText: dossier.id });
    await humanClick(page, card.locator('[data-testid="planning-reserve-button"]'));

    await expectReserveClickFeedback(card);
    await expect(card.locator('[data-testid="planning-reservation-success"]')).toContainText("Suggestion de créneau affichée");
    const suggestionPanel = card.locator('[data-testid="planning-suggestion-panel"]').first();
    await expect(suggestionPanel).toBeVisible();
    await expect(suggestionPanel.locator('[data-testid="planning-suggestion-start"]')).not.toBeEmpty();
    await expect(suggestionPanel.locator('[data-testid="planning-suggestion-end"]')).not.toBeEmpty();
    await expect(suggestionPanel.locator('[data-testid="planning-suggestion-duration"]')).toContainText(/1h|1\.5h|90|60/i);
    await expect(card.locator('[data-testid="planning-confirm-slot"]').first()).toBeVisible();
    await expect(card.locator('[data-testid="planning-confirm-slot"]').first()).toHaveText("Réserver ce créneau");

    const ganttPreview = page.locator('[data-testid="gantt-reservation-proposed"]').first();
    if (await ganttPreview.count()) {
      await expect(ganttPreview).toBeVisible();
    }
  });

  test("Si aucun créneau disponible : un message d'erreur est visible", async ({ page }) => {
    const dossier = createReservableDossier({ id: "NIMR-RESERVE-NOSLOT" });
    await seedPlanning(page, [dossier], { technicians: [{ ...MOCK_TECHNICIENS[0], id: "tech_noslot_inactive", actif: false }] });
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    const card = page.locator('[data-testid="reservation-need-card"]').filter({ hasText: dossier.id });
    await humanClick(page, card.locator('[data-testid="planning-reserve-button"]'));

    await expect(card.locator('[data-testid="planning-reservation-error"]')).toContainText(
      "Réservation impossible : aucun créneau disponible."
    );
    await expect(card.locator('[data-testid="planning-suggestion-panel"]')).toHaveCount(0);
  });

  test("Si la durée n'est pas validée : un message d'erreur est visible", async ({ page }) => {
    const dossier = createReservableDossier({
      id: "NIMR-RESERVE-DURATION",
      ordresReparation: [{
        id: "task-reserve-duration",
        designation: "Diagnostic non valide",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: false,
      }],
    });
    await seedPlanning(page, [dossier], { reservations: [createPendingReservation(dossier)] });
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    const card = page.locator('[data-testid="reservation-need-card"]').filter({ hasText: dossier.id });
    await humanClick(page, card.locator('[data-testid="planning-reserve-button"]'));

    await expect(card.locator('[data-testid="planning-reservation-error"]')).toContainText(
      "Réservation impossible : durée non validée."
    );
  });

  test("Si le rôle n'est pas autorisé : le bouton est absent", async ({ page }) => {
    const dossier = createReservableDossier({ id: "NIMR-RESERVE-ROLE" });
    await seedPlanning(page, [dossier]);
    await changeUserRole(page, "role-option-receptionnaire");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    const card = page.locator('[data-testid="reservation-need-card"]').filter({ hasText: dossier.id });
    await expect(card).toBeVisible();
    await expect(card.locator('[data-testid="planning-reserve-button"]')).toHaveCount(0);
  });

  test("Le clic ne reste jamais sans feedback", async ({ page }) => {
    const dossier = createReservableDossier({ id: "NIMR-RESERVE-VISIBLE" });
    await seedPlanning(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    const card = page.locator('[data-testid="reservation-need-card"]').filter({ hasText: dossier.id });
    await humanClick(page, card.locator('[data-testid="planning-reserve-button"]'));

    await expectReserveClickFeedback(card);
  });

  test("Double clic ne crée pas deux réservations", async ({ page }) => {
    const dossier = createReservableDossier({ id: "NIMR-RESERVE-DOUBLE" });
    await seedPlanning(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    const card = page.locator('[data-testid="reservation-need-card"]').filter({ hasText: dossier.id });
    await card.locator('[data-testid="planning-reserve-button"]').dblclick();
    await expect(card.locator('[data-testid="planning-reservation-feedback"]')).toBeVisible();

    const reservationCount = await page.evaluate(({ key, dossierId }) => {
      const values = JSON.parse(localStorage.getItem(key) || "[]") as WorkshopReservation[];
      return values.filter(value => value.dossierId === dossierId && value.status !== "ANNULEE").length;
    }, { key: STORAGE_KEYS.reservations, dossierId: dossier.id });

    expect(reservationCount).toBe(1);
  });
});
