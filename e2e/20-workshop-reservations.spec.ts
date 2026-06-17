import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { AtelierZone, DossierStatus, InterventionType } from "../src/types";

const PLANNING_DATE = "2026-06-15";

// local Date generator
function localIso(dateStr: string, hour: number, minute = 0): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

const tech = createMockTech({
  id: "tech_ali",
  nom: "Ali",
  specialite: "Tôlier",
  zoneAffectee: AtelierZone.CARROSSERIE,
  chargeActuelle: 0,
});

const dossierReservable = createMockDossier({
  id: "NIMR-RES-YES",
  clientNom: "Client Reservable",
  vehiculeMarque: "DFSK",
  vehiculeModele: "Glory",
  vehiculeImmatriculation: "123 TU 456",
  statut: DossierStatus.NOUVEAU,
  dateSouhaiteeLivraison: "2026-06-15T17:00:00",
  ordresReparation: [
    {
      id: "task_yes",
      designation: "Tâche Réservable",
      tempsEstime: 2.0,
      tempsPasse: 0,
      status: "pending",
      estimateSource: "manual",
      isEstimatedDurationValidated: true
    }
  ]
});

const dossierNonReservable = createMockDossier({
  id: "NIMR-RES-NO",
  clientNom: "Client Non Reservable",
  vehiculeMarque: "Forthing",
  vehiculeModele: "T5",
  vehiculeImmatriculation: "987 TU 654",
  statut: DossierStatus.NOUVEAU,
  dateSouhaiteeLivraison: "2026-06-15T17:00:00",
  ordresReparation: [
    {
      id: "task_no",
      designation: "Tâche Non Validée",
      tempsEstime: 2.0,
      tempsPasse: 0,
      status: "pending",
      estimateSource: "preset",
      isEstimatedDurationValidated: false
    }
  ]
});

test.describe("Workshop Reservations Flow", () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test("Chef Atelier workshop reservations workflow", async ({ page }) => {
    // 1. Setup localStorage and go to homepage
    await page.goto("/");
    await page.evaluate(({ keys, data }) => {
      localStorage.clear();
      localStorage.setItem(keys.dossiers, JSON.stringify(data.dossiers));
      localStorage.setItem(keys.techs, JSON.stringify(data.techs));
      localStorage.setItem(keys.reservations, JSON.stringify([]));
    }, {
      keys: STORAGE_KEYS,
      data: {
        dossiers: [dossierReservable, dossierNonReservable],
        techs: [tech]
      }
    });

    // 2. Login as Chef Atelier
    await changeUserRole(page, "role-option-chef-atelier");

    // 3. Open Planning tab
    const tabSelector = '[data-testid="nav-planning"]';
    await page.waitForSelector(tabSelector, { state: "visible" });
    await humanClick(page, page.locator(tabSelector));

    // 4. Navigate to selected planning date (2026-06-15)
    const dateInput = page.locator('[data-testid="planning-date-input"]');
    await expect(dateInput).toBeVisible();
    await dateInput.fill(PLANNING_DATE);
    await page.keyboard.press("Enter");

    // 5. Verify Reservations Panel is visible
    const reservationsPanel = page.locator('[data-testid="workshop-reservations-panel"]');
    await expect(reservationsPanel).toBeVisible();

    // 6. Verify dossier with validated duration appears "À réserver"
    const cardYes = reservationsPanel.locator('[data-testid="reservation-need-card"]').filter({ hasText: "NIMR-RES-YES" });
    await expect(cardYes).toBeVisible();
    await expect(cardYes).toContainText("À réserver");

    // 7. Verify dossier without validated duration does not appear
    const cardNo = reservationsPanel.locator('[data-testid="reservation-need-card"]').filter({ hasText: "NIMR-RES-NO" });
    await expect(cardNo).toHaveCount(0);

    // 8. Suggest reservation
    const suggestBtn = cardYes.locator('[data-testid="reservation-suggest-btn"]');
    await expect(suggestBtn).toBeVisible();
    await humanClick(page, suggestBtn);

    // 9. See ghost proposed block in Gantt
    const proposedBlock = page.locator('[data-testid="gantt-reservation-proposed"]').first();
    await expect(proposedBlock).toBeVisible();

    // 10. Confirm reservation
    const confirmBtn = cardYes.locator('[data-testid="reservation-confirm-btn"]');
    await expect(confirmBtn).toBeVisible();
    await humanClick(page, confirmBtn);

    // 11. See confirmed block in Gantt
    const confirmedBlock = page.locator('[data-testid="gantt-reservation-confirmed"]').first();
    await expect(confirmedBlock).toBeVisible();

    // 12. Convert to planning
    const convertBtn = cardYes.locator('[data-testid="reservation-convert-btn"]');
    await expect(convertBtn).toBeVisible();
    await humanClick(page, convertBtn);

    // 13. See standard Gantt block
    const ganttBlock = page.locator('[data-testid="gantt-block-task_yes"]').first();
    await expect(ganttBlock).toBeVisible();

    // 14. Verify reservation is converted and need is no longer listed in active needs
    await expect(cardYes).toHaveCount(0);

    // 15. Verify cancellation flow
    // Modify localStorage to have a confirmed reservation for cardYes again
    await page.evaluate(({ keys, resData }) => {
      localStorage.setItem(keys.reservations, JSON.stringify([resData]));
    }, {
      keys: STORAGE_KEYS,
      resData: {
        reservationId: "res_cancel_test",
        dossierId: "NIMR-RES-YES",
        taskIds: ["task_yes"],
        totalHours: 2.0,
        desiredDate: "2026-06-15T17:00:00",
        startTime: "2026-06-15T08:00:00",
        endTime: "2026-06-15T10:00:00",
        technicianId: "tech_ali",
        bayId: "bay_fast_01",
        status: "RESERVATION_CONFIRMEE",
        source: "manual",
        history: []
      }
    });
    await page.reload();

    // Go to Planning and date again
    await humanClick(page, page.locator(tabSelector));
    await page.locator('[data-testid="planning-date-input"]').fill(PLANNING_DATE);
    await page.keyboard.press("Enter");

    // Verify card is back and confirmed block is visible
    const newCardYes = page.locator('[data-testid="workshop-reservations-panel"] [data-testid="reservation-need-card"]').filter({ hasText: "NIMR-RES-YES" });
    await expect(newCardYes).toBeVisible();
    await expect(page.locator('[data-testid="gantt-reservation-confirmed"]').first()).toBeVisible();

    // Click Cancel
    const cancelBtn = newCardYes.locator('[data-testid="reservation-cancel-btn"]');
    await expect(cancelBtn).toBeVisible();
    await humanClick(page, cancelBtn);

    // Verify it disappears from Gantt (not blocking anymore)
    await expect(page.locator('[data-testid="gantt-reservation-confirmed"]')).toHaveCount(0);
  });

  test("Chef Atelier multi-day 52h reservation workflow", async ({ page }) => {
    const dossier52 = createMockDossier({
      id: "NIMR-RES-52H",
      clientNom: "Client 52H",
      vehiculeMarque: "DFSK",
      vehiculeModele: "Glory",
      vehiculeImmatriculation: "123 TU 520",
      statut: DossierStatus.NOUVEAU,
      dateSouhaiteeLivraison: "2026-06-15T17:00:00",
      ordresReparation: [
        {
          id: "task_52h",
          designation: "Tâche 52H",
          tempsEstime: 52.0,
          tempsPasse: 0,
          status: "pending",
          estimateSource: "manual",
          isEstimatedDurationValidated: true
        }
      ]
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
        dossiers: [dossier52],
        techs: [tech]
      }
    });

    await changeUserRole(page, "role-option-chef-atelier");

    const tabSelector = '[data-testid="nav-planning"]';
    await page.waitForSelector(tabSelector, { state: "visible" });
    await humanClick(page, page.locator(tabSelector));

    const dateInput = page.locator('[data-testid="planning-date-input"]');
    await dateInput.fill("2026-06-15");
    await page.keyboard.press("Enter");

    const card52 = page.locator('[data-testid="workshop-reservations-panel"] [data-testid="reservation-need-card"]').filter({ hasText: "NIMR-RES-52H" });
    await expect(card52).toBeVisible();
    await expect(card52).toContainText("À réserver");

    // Click suggest
    const suggestBtn = card52.locator('[data-testid="reservation-suggest-btn"]');
    await humanClick(page, suggestBtn);

    // Verify fields
    await expect(card52.locator('[data-testid="res-start"]')).toContainText("15/06/2026 à 08:00");
    await expect(card52.locator('[data-testid="res-end"]')).toContainText("22/06/2026 à 17:00");
    await expect(card52.locator('[data-testid="res-days"]')).toContainText("7 jours");
    await expect(card52.locator('[data-testid="res-segments-count"]')).toContainText("13 segments");

    // Toggle segments list
    const toggleSegmentsBtn = card52.locator('[data-testid="res-toggle-segments-btn"]');
    await expect(toggleSegmentsBtn).toBeVisible();
    await humanClick(page, toggleSegmentsBtn);

    const segmentsList = card52.locator('[data-testid="reservation-segments-list"]');
    await expect(segmentsList).toBeVisible();
    await expect(segmentsList.locator('[data-testid^="res-segment-item-"]')).toHaveCount(13);

    // See proposed block on day 1 (Monday 15 June)
    await expect(page.locator('[data-testid="gantt-reservation-proposed"]').first()).toBeVisible();

    // Navigate to day 2 (Tuesday 16 June)
    await dateInput.fill("2026-06-16");
    await page.keyboard.press("Enter");

    // See proposed block on day 2 too
    await expect(page.locator('[data-testid="gantt-reservation-proposed"]').first()).toBeVisible();

    // Click confirm
    const confirmBtn = card52.locator('[data-testid="reservation-confirm-btn"]');
    await humanClick(page, confirmBtn);

    // See confirmed block on day 2
    await expect(page.locator('[data-testid="gantt-reservation-confirmed"]').first()).toBeVisible();

    // Convert to planning
    const convertBtn = card52.locator('[data-testid="reservation-convert-btn"]');
    await humanClick(page, convertBtn);

    // Card should disappear
    await expect(card52).toHaveCount(0);

    // Gantt block for task_52h should be visible on day 2
    await expect(page.locator('[data-testid="gantt-block-task_52h"]').first()).toBeVisible();
  });
});
