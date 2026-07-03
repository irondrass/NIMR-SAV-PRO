import { test, expect, Page } from "@playwright/test";
import { STORAGE_KEYS } from "../src/storage-keys";
import { AtelierZone, DossierSAV, DossierStatus, TechnicienResource, WorkshopReservation } from "../src/types";
import { changeUserRole, humanClick, humanSelect, humanWait } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";

const techs: TechnicienResource[] = [
  createMockTech({
    id: "tech_44_meca",
    nom: "Mecanicien 44",
    specialite: "Mécanicien",
    zoneAffectee: AtelierZone.GRANDS_TRAVAUX,
  }),
  createMockTech({
    id: "tech_44_elec",
    nom: "Electricien 44",
    specialite: "Électricien",
    zoneAffectee: AtelierZone.ELECTRICITE_DIAG,
  }),
  createMockTech({
    id: "tech_44_body",
    nom: "Tolier 44",
    specialite: "Tôlier",
    zoneAffectee: AtelierZone.CARROSSERIE,
  }),
  createMockTech({
    id: "tech_44_paint",
    nom: "Peintre 44",
    specialite: "Peintre",
    zoneAffectee: AtelierZone.PEINTURE,
  }),
];

function makeMultiTradeDossier(): DossierSAV {
  return createMockDossier({
    id: "NIMR-44-MULTI",
    clientNom: "Client Multi 44",
    vehiculeImmatriculation: "944 TU 0044",
    vehiculeVIN: "NIMR44MULTI000001",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [
      {
        id: "task_44_mechanical",
        designation: "Contrôle géométrie",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        workshopStageId: "mechanical",
        isEstimatedDurationValidated: true,
        estimateSource: "quote-import",
      },
      {
        id: "task_44_electrical",
        designation: "Diagnostic valise faisceau",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        workshopStageId: "electrical",
        isEstimatedDurationValidated: true,
        estimateSource: "quote-import",
      },
      {
        id: "task_44_body",
        designation: "Démontage aile avant",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        workshopStageId: "body-disassembly",
        isEstimatedDurationValidated: true,
        estimateSource: "quote-import",
      },
      {
        id: "task_44_paint",
        designation: "Peinture aile avant",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        workshopStageId: "paint",
        isEstimatedDurationValidated: true,
        estimateSource: "quote-import",
      },
    ],
  });
}

async function seed(page: Page, dossiers: DossierSAV[] = [makeMultiTradeDossier()]) {
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue, techsValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.techs, JSON.stringify(techsValue));
    localStorage.setItem(keys.reservations, JSON.stringify([]));
  }, { keys: STORAGE_KEYS, dossiersValue: dossiers, techsValue: techs });
  await page.reload();
}

async function openMultiDossier(page: Page) {
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanClick(page, page.locator('[data-testid="dossier-card-NIMR-44-MULTI"]'));
  await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
}

async function optionTexts(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"] option`).evaluateAll(options =>
    options.map(option => (option.textContent || "").trim())
  );
}

test.describe("44 - Dispatch, planning actionnable et logout live", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockDate = new Date("2026-07-03T07:00:00");
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

  test("login directeur, logout, reload puis login réception", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="current-user-role"]')).toHaveText("Directeur SAV");

    await humanClick(page, page.locator('[data-testid="logout-button"]'));
    await expect(page.locator('[data-testid="login-screen"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-user-role"]')).toHaveCount(0);

    await page.reload();
    await expect(page.locator('[data-testid="login-screen"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-user-role"]')).toHaveCount(0);

    await changeUserRole(page, "role-option-receptionnaire");
    await expect(page.locator('[data-testid="current-user-role"]')).toHaveText("Réceptionnaire");
  });

  test("dispatch par tâche conserve les affectations existantes et filtre les métiers", async ({ page }) => {
    await seed(page);
    await changeUserRole(page, "role-option-chef-atelier");
    await openMultiDossier(page);

    const paintOptions = await optionTexts(page, "task-assign-select-task_44_paint");
    const bodyOptions = await optionTexts(page, "task-assign-select-task_44_body");
    const electricalOptions = await optionTexts(page, "task-assign-select-task_44_electrical");
    expect(paintOptions).not.toContain("Mecanicien 44");
    expect(bodyOptions).not.toContain("Mecanicien 44");
    expect(electricalOptions).not.toContain("Peintre 44");
    expect(electricalOptions).not.toContain("Tolier 44");

    await humanSelect(page, page.locator('[data-testid="task-assign-select-task_44_mechanical"]'), "tech_44_meca");
    await expect(page.locator('[data-testid="task-assignment-status-task_44_mechanical"]')).toContainText("Mecanicien 44");

    await humanSelect(page, page.locator('[data-testid="task-assign-select-task_44_electrical"]'), "tech_44_elec");
    await expect(page.locator('[data-testid="task-assignment-status-task_44_mechanical"]')).toContainText("Mecanicien 44");
    await expect(page.locator('[data-testid="task-assignment-status-task_44_electrical"]')).toContainText("Electricien 44");

    await humanSelect(page, page.locator('[data-testid="task-assign-select-task_44_body"]'), "tech_44_body");
    await humanSelect(page, page.locator('[data-testid="task-assign-select-task_44_paint"]'), "tech_44_paint");

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]") as DossierSAV[], STORAGE_KEYS.dossiers);
    const dossier = stored.find(current => current.id === "NIMR-44-MULTI");
    expect(dossier?.ordresReparation.find(task => task.id === "task_44_mechanical")?.plannedTechnicianId).toBe("tech_44_meca");
    expect(dossier?.ordresReparation.find(task => task.id === "task_44_electrical")?.plannedTechnicianId).toBe("tech_44_elec");
    expect(dossier?.ordresReparation.find(task => task.id === "task_44_body")?.plannedTechnicianId).toBe("tech_44_body");
    expect(dossier?.ordresReparation.find(task => task.id === "task_44_paint")?.plannedTechnicianId).toBe("tech_44_paint");
  });

  test("carte à réserver affiche les actions et la réservation crée ETA et blocs Gantt", async ({ page }) => {
    await seed(page);
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    const card = page.locator('[data-testid="reservation-need-card"]').filter({ hasText: "NIMR-44-MULTI" });
    await expect(card.locator('[data-testid="planning-reserve-button"]')).toBeVisible();
    await expect(card.locator('[data-testid="planning-suggest-btn"]')).toBeVisible();

    await humanClick(page, card.locator('[data-testid="planning-suggest-btn"]'));
    await expect(card.locator('[data-testid="planning-reservation-success"]')).toContainText("Suggestion de créneau affichée");

    await seed(page);
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await humanSelect(page, page.locator('[data-testid="planning-eta-vehicle-select"]'), "NIMR-44-MULTI");
    await humanClick(page, page.locator('[data-testid="planning-auto-reserve-btn"]'));
    await expect(page.locator('[data-testid="auto-planning-success"]')).toContainText("réservée");
    await expect(page.locator('[data-testid="auto-reserve-confirmation"]')).toBeVisible();

    const result = await page.evaluate(({ dossierKey, reservationKey }) => {
      const dossiers = JSON.parse(localStorage.getItem(dossierKey) || "[]") as DossierSAV[];
      const reservations = JSON.parse(localStorage.getItem(reservationKey) || "[]") as WorkshopReservation[];
      const dossier = dossiers.find(current => current.id === "NIMR-44-MULTI");
      return {
        reservations: reservations.length,
        planned: dossier?.ordresReparation.every(task => Boolean(task.planningStart && task.plannedTechnicianId && task.plannedBayId)),
        etaDefined: Boolean(dossier?.datePlanningFin),
      };
    }, { dossierKey: STORAGE_KEYS.dossiers, reservationKey: STORAGE_KEYS.reservations });

    expect(result.reservations).toBeGreaterThan(0);
    expect(result.planned).toBe(true);
    expect(result.etaDefined).toBe(true);
    await expect(page.locator('[data-testid="planning-gantt-chart"]')).toContainText("NIMR-44-MULTI");
  });

  test("mobile 390px : menu accessible, drawer ouvrable, sans overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page);
    await changeUserRole(page, "role-option-directeur");

    const menu = page.locator('[data-testid="mobile-menu-button"]');
    await expect(menu).toHaveAttribute("aria-label", "Ouvrir le menu");
    await expect(menu).toHaveAttribute("aria-expanded", "false");

    const overflowBefore = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowBefore).toBe(false);

    await humanClick(page, menu);
    await expect(page.locator('[data-testid="mobile-menu-overlay"]')).toBeVisible();
    await expect(menu).toHaveAttribute("aria-label", "Fermer le menu");
    await expect(menu).toHaveAttribute("aria-expanded", "true");

    const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowAfter).toBe(false);
    await humanWait(page);
  });
});
