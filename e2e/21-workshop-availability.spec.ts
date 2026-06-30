import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { AtelierZone, DossierStatus } from "../src/types";
import { GLOBAL_ACTION_GUARD_MS } from "../src/action-guard";

const PLANNING_DATE = "2026-06-15"; // Lundi

const tech = createMockTech({
  id: "tech_demo_01",
  nom: "Technicien Demo 01",
  specialite: "Diagnostic",
  zoneAffectee: AtelierZone.ELECTRICITE_DIAG,
  chargeActuelle: 0,
});

const dossier = createMockDossier({
  id: "NIMR-AV-TEST",
  clientNom: "Client Availability",
  vehiculeMarque: "DFSK",
  vehiculeModele: "Glory 500",
  vehiculeImmatriculation: "123 TU 999",
  statut: DossierStatus.NOUVEAU,
  dateSouhaiteeLivraison: "2026-06-15T17:00:00",
  ordresReparation: [
    {
      id: "task_av_1",
      designation: "Travaux Élec",
      tempsEstime: 2.0,
      tempsPasse: 0,
      status: "pending",
      estimateSource: "manual",
      isEstimatedDurationValidated: true
    }
  ]
});

test.describe("Workshop Availability and Absence Management", () => {
  test("Chef Atelier manages workshop availability and constraints", async ({ page }) => {
    // 1. Setup mock database
    await page.addInitScript(() => {
      const mockDate = new Date("2026-06-15T07:00:00");
      const _Date = Date;
      class MockDate extends _Date {
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
    await page.goto("/");
    await page.evaluate(({ keys, data }) => {
      localStorage.clear();
      localStorage.setItem(keys.dossiers, JSON.stringify(data.dossiers));
      localStorage.setItem(keys.techs, JSON.stringify(data.techs));
      localStorage.setItem(keys.reservations, JSON.stringify([]));
    }, {
      keys: STORAGE_KEYS,
      data: {
        dossiers: [dossier],
        techs: [tech]
      }
    });

    // 2. Login as Chef Atelier
    await changeUserRole(page, "role-option-chef-atelier");

    // 3. Navigate to Planning
    const tabSelector = '[data-testid="nav-planning"]';
    await page.waitForSelector(tabSelector, { state: "visible" });
    await humanClick(page, page.locator(tabSelector));

    // 4. Set planning date
    const dateInput = page.locator('[data-testid="planning-date-input"]');
    await expect(dateInput).toBeVisible();
    await dateInput.fill(PLANNING_DATE);
    await page.keyboard.press("Enter");

    // 5. Verify Availability Panel is visible
    const availabilityPanel = page.locator('[data-testid="workshop-availability-panel"]');
    await expect(availabilityPanel).toBeVisible();

    // 6. Add Technician Absence
    const absenceForm = page.locator('[data-testid="technician-absence-form"]');
    await expect(absenceForm).toBeVisible();

    await absenceForm.locator('select[name="techId"]').selectOption("tech_demo_01");
    await absenceForm.locator('input[name="startDate"]').fill(PLANNING_DATE);
    await absenceForm.locator('input[name="endDate"]').fill(PLANNING_DATE);
    await absenceForm.locator('input[name="reason"]').fill("Congé maladie demo");

    const addAbsenceBtn = page.locator('[data-testid="technician-absence-add-btn"]');
    await humanClick(page, addAbsenceBtn);

    // 7. Verify Absent Badge is visible
    const absentBadge = page.locator('[data-testid="technician-absent-badge"]').first();
    await expect(absentBadge).toBeVisible();
    await expect(absentBadge).toContainText("Absent");

    // 8. Tenter suggestion : le technicien étant absent le 15, le créneau doit sauter au 16.
    const card = page.locator('[data-testid="workshop-reservations-panel"] [data-testid="reservation-need-card"]').filter({ hasText: "NIMR-AV-TEST" });
    await expect(card).toBeVisible();

    const suggestBtn = card.locator('[data-testid="reservation-suggest-btn"]');
    await humanClick(page, suggestBtn);

    // Naviguer au 16 juin pour voir le créneau proposé
    await dateInput.fill("2026-06-16");
    await page.keyboard.press("Enter");

    const proposedBlock = page.locator('[data-testid="gantt-reservation-proposed"]').first();
    await expect(proposedBlock).toBeVisible();

    // Revenir au 15 juin pour supprimer l'absence
    await dateInput.fill(PLANNING_DATE);
    await page.keyboard.press("Enter");

    // 9. Supprimer l'absence
    const deleteAbsenceBtn = page.locator('[data-testid="technician-absence-delete-btn"]').first();
    await humanClick(page, deleteAbsenceBtn);

    // 10. Verify Absent badge disappears and technician is available again
    await expect(page.locator('[data-testid="technician-absent-badge"]')).toHaveCount(0);

    // Tenter suggestion à nouveau : doit maintenant proposer sur le 15
    await page.waitForTimeout(GLOBAL_ACTION_GUARD_MS + 100);
    await humanClick(page, suggestBtn);
    const proposedBlockOn15 = page.locator('[data-testid="gantt-reservation-proposed"]').first();
    await expect(proposedBlockOn15).toBeVisible();

    // 11. Ajouter indisponibilité pont
    const unavForm = page.locator('[data-testid="bay-unavailability-form"]');
    await expect(unavForm).toBeVisible();

    await unavForm.locator('select[name="bayId"]').selectOption("bay_diag_01");
    await unavForm.locator('input[name="startDate"]').fill(PLANNING_DATE);
    await unavForm.locator('input[name="endDate"]').fill(PLANNING_DATE);
    await unavForm.locator('input[name="reason"]').fill("Panne électrique pont");

    const addUnavBtn = page.locator('[data-testid="bay-unavailability-add-btn"]');
    await humanClick(page, addUnavBtn);

    // 12. Verify Indisponible badge is visible on the bay
    const bayUnavBadge = page.locator('[data-testid="bay-unavailable-badge"]').first();
    await expect(bayUnavBadge).toBeVisible();
    await expect(bayUnavBadge).toContainText("Indisponible");

    // 13. Tenter suggestion : doit éviter ce pont
    await page.waitForTimeout(GLOBAL_ACTION_GUARD_MS + 100);
    await humanClick(page, suggestBtn);
    const newProposedBlock = page.locator('[data-testid="gantt-reservation-proposed"]').first();
    await expect(newProposedBlock).toBeVisible();
    // Le technicien doit être affecté à un autre pont
    const suggestionInfo = page.locator('[data-testid="workshop-reservations-panel"]');
    await expect(suggestionInfo).not.toContainText("bay_diag_01");

    // 14. Ajouter jour férié / fermeture exceptionnelle
    const holidayForm = page.locator('[data-testid="workshop-holiday-form"]');
    await expect(holidayForm).toBeVisible();

    await holidayForm.locator('select[name="type"]').selectOption("closed");
    await holidayForm.locator('input[name="date"]').fill(PLANNING_DATE);
    await holidayForm.locator('input[name="name"]').fill("Pont exceptionnel");

    const addHolidayBtn = page.locator('[data-testid="workshop-holiday-add-btn"]');
    await humanClick(page, addHolidayBtn);

    // 15. Verify Gantt displays closed banner
    const closedBanner = page.locator('[data-testid="workshop-closed-banner"]');
    await expect(closedBanner).toBeVisible();
    await expect(closedBanner).toContainText("Atelier fermé");
  });
});
