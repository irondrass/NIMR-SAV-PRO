import { expect, Page, test } from "@playwright/test";
import { MOCK_TECHNICIENS } from "../src/data";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus, WorkshopReservation } from "../src/types";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";

function localIso(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

async function seedPlanning(page: Page, dossiers: DossierSAV[]) {
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue, techniciansValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.techs, JSON.stringify(techniciansValue));
  }, {
    keys: STORAGE_KEYS,
    dossiersValue: dossiers,
    techniciansValue: MOCK_TECHNICIENS,
  });
  await page.reload();
}

function createSuggestedDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return createMockDossier({
    id: "NIMR-SUGGEST-001",
    clientNom: "Client Suggestion",
    vehiculeImmatriculation: "700 TU 7000",
    vehiculeVIN: "SUGGESTIONVIN001",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [{
      id: "task-suggestion",
      designation: "Diagnostic atelier",
      tempsEstime: 1,
      tempsPasse: 0,
      status: "pending",
      isEstimatedDurationValidated: true,
    }],
    ...overrides,
  });
}

test.describe("Lot 6K-B-B - Suggestion et réservation planning", () => {
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

  test("Chef Atelier suggère, reçoit un feedback puis réserve le créneau", async ({ page }) => {
    const dossier = createSuggestedDossier();
    await seedPlanning(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-suggest-dossier"]').selectOption(`${dossier.id}::task-suggestion`);
    await humanClick(page, page.locator('[data-testid="planning-suggest-submit"]'));
    await expect(page.locator('[data-testid="planning-suggest-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-suggest-feedback"]')).toContainText("Meilleur créneau disponible.");
    await expect(page.locator('[data-testid="planning-suggest-apply"]')).toHaveText("Réserver ce créneau");

    await humanClick(page, page.locator('[data-testid="planning-suggest-submit"]'));
    await expect(page.locator('[data-testid="planning-suggest-feedback"]')).toContainText("Meilleur créneau déjà affiché.");

    await humanClick(page, page.locator('[data-testid="planning-suggest-apply"]'));
    await expect(page.locator('[data-testid="planning-suggest-feedback"]')).toContainText("Créneau réservé avec succès.");

    const reservationCard = page
      .locator('[data-testid="reservation-need-card"]')
      .filter({ hasText: dossier.id });
    await expect(reservationCard.locator('[data-testid="planning-reservation-reserved"]')).toHaveText("Réservé");
    await expect(reservationCard).toContainText("Créneau réservé");
    await expect(reservationCard).toContainText("Technicien");
    await expect(reservationCard).toContainText("Pont");
    await expect(page.locator('[data-testid="gantt-block-task-suggestion"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-eta-value"]')).not.toContainText("Non définie");

    const storedReservation = await page.evaluate((key) => {
      const values = JSON.parse(localStorage.getItem(key) || "[]") as WorkshopReservation[];
      return values.find(value => value.taskIds.includes("task-suggestion"));
    }, STORAGE_KEYS.reservations);
    expect(storedReservation?.status).toBe("TRANSFORMEE_PLANNING");
    expect(storedReservation?.source).toBe("planning-suggestion");
  });

  test("Réception consulte l'ETA sans voir les actions de suggestion", async ({ page }) => {
    await seedPlanning(page, [createSuggestedDossier()]);
    await changeUserRole(page, "role-option-receptionnaire");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await expect(page.locator('[data-testid="planning-eta-vehicle-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-suggest-submit"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="planning-suggest-apply"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="planning-manual-dossier"]')).not.toBeVisible();
  });

  test("Suggestion refusée tant que la durée n'est pas validée", async ({ page }) => {
    const dossier = createSuggestedDossier({
      id: "NIMR-SUGGEST-NOT-VALID",
      ordresReparation: [{
        id: "task-not-valid",
        designation: "Intervention à estimer",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: false,
      }],
    });
    await seedPlanning(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-suggest-dossier"]').selectOption(`${dossier.id}::task-not-valid`);
    await humanClick(page, page.locator('[data-testid="planning-suggest-submit"]'));
    await expect(page.locator('[data-testid="planning-suggest-error"]')).toContainText(
      "Durée à valider par Chef Atelier avant planification."
    );
    await expect(page.locator('[data-testid="planning-suggest-result"]')).not.toBeVisible();
  });

  test("La suggestion évite une occupation existante du même véhicule", async ({ page }) => {
    const occupied = createMockDossier({
      id: "NIMR-SUGGEST-OCCUPIED",
      clientNom: "Client Véhicule Occupé",
      vehiculeImmatriculation: "800 TU 8000",
      vehiculeVIN: "SAMEVEHICLEVIN800",
      statut: DossierStatus.EN_TRAVAUX,
      ordresReparation: [{
        id: "task-occupied",
        designation: "Réparation en cours",
        tempsEstime: 2,
        tempsPasse: 0,
        status: "in_progress",
        isEstimatedDurationValidated: true,
        planningStart: localIso("2026-06-24", 8),
        planningEnd: localIso("2026-06-24", 10),
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_diag_01",
        planningDate: "2026-06-24",
      }],
    });
    const target = createSuggestedDossier({
      id: "NIMR-SUGGEST-NEXT",
      vehiculeImmatriculation: "800tu8000",
      vehiculeVIN: " samevehiclevin800 ",
      ordresReparation: [{
        id: "task-next",
        designation: "Contrôle complémentaire",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: true,
      }],
    });
    await seedPlanning(page, [occupied, target]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-suggest-dossier"]').selectOption(`${target.id}::task-next`);
    await humanClick(page, page.locator('[data-testid="planning-suggest-submit"]'));
    const suggestedStart = await page.locator('[data-testid="planning-suggest-start"]').textContent();
    expect(suggestedStart).toMatch(/10:00|10:30|11:00|11:30|13:00/);
  });
});
