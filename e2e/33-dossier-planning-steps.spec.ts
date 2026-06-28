import { expect, Page, test } from "@playwright/test";
import { MOCK_TECHNICIENS } from "../src/data";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus } from "../src/types";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";

function localIso(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

async function mockNow(page: Page, iso: string) {
  await page.addInitScript((value) => {
    const mockDate = new Date(value);
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
  }, iso);
}

async function seedDossiers(page: Page, dossiers: DossierSAV[]) {
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue, techsValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.techs, JSON.stringify(techsValue));
  }, {
    keys: STORAGE_KEYS,
    dossiersValue: dossiers,
    techsValue: MOCK_TECHNICIENS,
  });
  await page.reload();
}

async function openPlanningTab(page: Page, dossierId: string) {
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanClick(page, page.locator(`[data-testid="dossier-card-${dossierId}"]`));
  await humanClick(page, page.locator('[data-testid="tab-rdv-planning"]'));
  await expect(page.locator('[data-testid="dossier-planning-tab"]')).toBeVisible();
}

function baseDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return createMockDossier({
    id: "NIMR-STEP-E2E",
    clientNom: "Client Planning Étapes",
    vehiculeImmatriculation: "610 TU 6610",
    vehiculeVIN: "STEPSE2EVIN00001",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [
      {
        id: "task-step-quick",
        designation: "Vidange filtre entretien",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: true,
      },
      {
        id: "task-step-paint",
        designation: "Peinture + vernis",
        tempsEstime: 2,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: true,
      },
    ],
    ...overrides,
  });
}

test.describe("Lot 6K-B-C - RDV & Planning dossier par étapes", () => {
  test("Chef Atelier voit l'onglet, les cartes actives/non utilisées et les totaux", async ({ page }) => {
    await mockNow(page, "2026-06-24T07:00:00");
    const dossier = baseDossier();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openPlanningTab(page, dossier.id);

    await expect(page.locator('[data-testid="planning-step-card-quick-service"]')).toContainText("Vidange / entretien rapide");
    await expect(page.locator('[data-testid="planning-step-card-paint"]')).toContainText("Peinture + vernis");
    await expect(page.locator('[data-testid="planning-step-card-quality"] [data-testid="planning-step-unused"]')).toHaveText("Non utilisée");
    await expect(page.locator('[data-testid="planning-total-estimated"]')).toContainText(/3\s*h|3 h/);
    await expect(page.locator('[data-testid="planning-total-reserved"]')).toContainText(/0\s*h|0 h/);
    await expect(page.locator('[data-testid="planning-workshop-margin"]')).toContainText(/3\s*h|3 h/);
    await expect(page.locator('[data-testid="planning-incomplete-warning"]')).toBeVisible();
  });

  test("Une étape active peut être réservée puis visible dans le tableau, le Gantt et l'ETA", async ({ page }) => {
    await mockNow(page, "2026-06-24T07:00:00");
    const dossier = baseDossier({
      ordresReparation: [
        {
          id: "task-step-quick",
          designation: "Vidange filtre entretien",
          tempsEstime: 1,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true,
        },
      ],
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openPlanningTab(page, dossier.id);

    const quickCard = page.locator('[data-testid="planning-step-card-quick-service"]');
    await humanClick(page, quickCard.locator('[data-testid="planning-step-reserve"]'));
    await expect(quickCard.locator('[data-testid="planning-suggest-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-suggest-feedback"]')).toContainText("Meilleur créneau disponible");
    await humanClick(page, quickCard.locator('[data-testid="planning-suggest-apply"]'));
    await expect(page.locator('[data-testid="planning-suggest-feedback"]')).toContainText("Créneau réservé avec succès");
    await expect(quickCard.locator('[data-testid="planning-step-reserved-status"]')).toHaveText("Réservé");
    await expect(page.locator('[data-testid="planning-validated-table"]')).toContainText("Vidange / entretien rapide");
    await expect(page.locator('[data-testid="vehicle-eta-block"]')).toContainText("24/06/2026");
    await expect(page.locator('[data-testid="planning-complete-badge"]')).toBeVisible();

    await humanClick(page, page.locator('[data-testid="dossier-back-btn"]'));
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await expect(page.locator('[data-testid="gantt-block-task-step-quick"]').first()).toBeVisible();
  });

  test("Réception consulte le planning et l'ETA sans actions de modification", async ({ page }) => {
    await mockNow(page, "2026-06-24T07:00:00");
    const dossier = baseDossier({
      id: "NIMR-STEP-READ",
      ordresReparation: [
        {
          id: "task-step-read",
          designation: "Réparation mécanique freinage",
          tempsEstime: 1,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true,
          planningStart: localIso("2026-06-24", 8),
          planningEnd: localIso("2026-06-24", 9),
          planningSegments: [{ start: localIso("2026-06-24", 8), end: localIso("2026-06-24", 9) }],
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_fast_01",
        },
      ],
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-receptionnaire");
    await openPlanningTab(page, dossier.id);

    await expect(page.locator('[data-testid="vehicle-eta-block"]')).toContainText("Livraison estimée sous réserve de validation atelier.");
    await expect(page.locator('[data-testid="planning-validated-table"]')).toContainText("Réparation mécanique");
    await expect(page.locator('[data-testid="planning-step-reserve"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="planning-step-reschedule"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="planning-step-release"]')).not.toBeVisible();
  });

  test("Libérer une étape retire la réservation et recalcule les totaux", async ({ page }) => {
    await mockNow(page, "2026-06-24T07:00:00");
    const dossier = baseDossier({
      id: "NIMR-STEP-RELEASE",
      ordresReparation: [
        {
          id: "task-step-release",
          designation: "Réparation mécanique freinage",
          tempsEstime: 1,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true,
          planningStart: localIso("2026-06-24", 8),
          planningEnd: localIso("2026-06-24", 9),
          planningSegments: [{ start: localIso("2026-06-24", 8), end: localIso("2026-06-24", 9) }],
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_fast_01",
        },
      ],
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openPlanningTab(page, dossier.id);

    const mechanicalCard = page.locator('[data-testid="planning-step-card-mechanical"]');
    await expect(mechanicalCard.locator('[data-testid="planning-step-reserved-status"]')).toHaveText("Réservé");
    await humanClick(page, mechanicalCard.locator('[data-testid="planning-step-release"]').first());
    await expect(page.locator('[data-testid="planning-suggest-feedback"]')).toContainText("Étape libérée");
    await expect(page.locator('[data-testid="planning-total-reserved"]')).toContainText(/0\s*h|0 h/);
    await expect(page.locator('[data-testid="planning-incomplete-warning"]')).toBeVisible();
  });

  test("Collision véhicule évitée lors de la réservation par étape", async ({ page }) => {
    await mockNow(page, "2026-06-24T07:00:00");
    const occupied = createMockDossier({
      id: "NIMR-STEP-OCCUPIED",
      clientNom: "Client Déjà Planifié",
      vehiculeImmatriculation: "700 TU 6700",
      vehiculeVIN: "STEPVEHICLEVIN700",
      statut: DossierStatus.EN_TRAVAUX,
      ordresReparation: [{
        id: "task-step-occupied",
        designation: "Diagnostic mécanique",
        tempsEstime: 2,
        tempsPasse: 0,
        status: "in_progress",
        isEstimatedDurationValidated: true,
        planningStart: localIso("2026-06-24", 8),
        planningEnd: localIso("2026-06-24", 10),
        planningSegments: [{ start: localIso("2026-06-24", 8), end: localIso("2026-06-24", 10) }],
        plannedTechnicianId: "tech_01",
        plannedBayId: "bay_fast_01",
      }],
    });
    const target = baseDossier({
      id: "NIMR-STEP-COLLISION",
      vehiculeImmatriculation: "700tu6700",
      vehiculeVIN: " stepvehiclevin700 ",
      ordresReparation: [{
        id: "task-step-collision",
        designation: "Vidange filtre",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: true,
      }],
    });
    await seedDossiers(page, [occupied, target]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openPlanningTab(page, target.id);

    const quickCard = page.locator('[data-testid="planning-step-card-quick-service"]');
    await humanClick(page, quickCard.locator('[data-testid="planning-step-reserve"]'));
    await expect(quickCard.locator('[data-testid="planning-suggest-result"]')).toBeVisible();
    await expect(quickCard.locator('[data-testid="planning-suggest-result"]')).not.toContainText("08:00 - 09:00");
  });

  test("Planning multi-jours segmenté reste visible depuis l'onglet dossier", async ({ page }) => {
    await mockNow(page, "2026-06-27T07:00:00");
    const dossier = baseDossier({
      id: "NIMR-STEP-MULTI",
      ordresReparation: [{
        id: "task-step-multi",
        designation: "Réparation mécanique suspension longue",
        tempsEstime: 5,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: true,
      }],
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openPlanningTab(page, dossier.id);

    const mechanicalCard = page.locator('[data-testid="planning-step-card-mechanical"]');
    await humanClick(page, mechanicalCard.locator('[data-testid="planning-step-reserve"]'));
    await expect(mechanicalCard.locator('[data-testid="planning-suggest-result"]')).toContainText("27/06/2026");
    await humanClick(page, mechanicalCard.locator('[data-testid="planning-suggest-apply"]'));

    const storedDossier = await page.evaluate((key) => {
      const values = JSON.parse(localStorage.getItem(key) || "[]") as DossierSAV[];
      return values.find(item => item.id === "NIMR-STEP-MULTI");
    }, STORAGE_KEYS.dossiers);
    expect(storedDossier?.ordresReparation[0].planningSegments?.length).toBeGreaterThan(1);
    await expect(page.locator('[data-testid="planning-validated-table"]')).toContainText("Réparation mécanique");
  });

  test("Aucun clic suggérer/réserver ne reste sans feedback", async ({ page }) => {
    await mockNow(page, "2026-06-24T07:00:00");
    const dossier = baseDossier({
      id: "NIMR-STEP-FEEDBACK",
      ordresReparation: [{
        id: "task-step-invalid",
        designation: "Vidange filtre",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        isEstimatedDurationValidated: false,
      }],
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openPlanningTab(page, dossier.id);

    await humanClick(page, page.locator('[data-testid="planning-step-card-quick-service"] [data-testid="planning-step-reserve"]'));
    await expect(page.locator('[data-testid="planning-suggest-feedback"]')).toContainText("Durée à valider par Chef Atelier avant planification.");
  });
});
