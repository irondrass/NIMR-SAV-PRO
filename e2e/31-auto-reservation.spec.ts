import { test, expect, Page } from "@playwright/test";
import { changeUserRole, humanClick, humanFill, humanSelect } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus, TechnicienResource, WorkshopReservation } from "../src/types";
import { MOCK_TECHNICIENS } from "../src/data";

function localIso(dateStr: string, hour: number, minute = 0): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

async function seedDossiers(
  page: Page,
  dossiers: DossierSAV[],
  technicians: TechnicienResource[] = MOCK_TECHNICIENS
) {
  await page.goto("/");
  await page.evaluate(({ dossierKey, dossierVal, techKey, techVal, resKey }) => {
    localStorage.setItem(dossierKey, JSON.stringify(dossierVal));
    localStorage.setItem(techKey, JSON.stringify(techVal));
    localStorage.removeItem(resKey);
  }, {
    dossierKey: STORAGE_KEYS.dossiers,
    dossierVal: dossiers,
    techKey: STORAGE_KEYS.techs,
    techVal: technicians,
    resKey: STORAGE_KEYS.reservations
  });
  await page.reload();
}

test.describe("Lot 6K-B-A — Vehicle-Level Auto Reservation and Delivery ETA", () => {

  test.beforeEach(async ({ page }) => {
    page.on("console", msg => {
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });

    await page.addInitScript(() => {
      const mockDate = new Date("2026-06-23T07:00:00");
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

  test("1. Rôles permissions for planning and auto-reservation", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-AUTO-ROLE",
      clientNom: "Role Tester",
      vehiculeImmatriculation: "111 TU 111",
      vehiculeVIN: "ROLEVIN111",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-role",
          designation: "Vidange",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true
        }
      ]
    });

    await seedDossiers(page, [dossier]);

    // Chef Atelier can see manual form and auto-reserve
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await expect(page.locator('[data-testid="planning-manual-dossier"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-auto-reserve-btn"]')).toBeVisible();

    // Réceptionnaire can see ETA select but not manual form/btn
    await changeUserRole(page, "role-option-receptionnaire");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await expect(page.locator('[data-testid="planning-eta-vehicle-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-manual-dossier"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="planning-auto-reserve-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="reservation-suggest-btn"]')).not.toBeVisible();

    // Technicien has consultation only
    await changeUserRole(page, "role-option-technicien");
    await expect(page.locator('[data-testid="nav-planning"]')).not.toBeVisible();

    // Directeur has planning rights in Hotfix 6K-H-C
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await expect(page.locator('[data-testid="planning-eta-vehicle-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-manual-dossier"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-auto-reserve-btn"]')).toBeVisible();
  });

  test("2. Vehicle collision manually planned on same vehicle", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-VEHICLE-COLLISION",
      clientNom: "Collision Vehicle",
      vehiculeImmatriculation: "222 TU 222",
      vehiculeVIN: "COLLISIONVIN222",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-p1",
          designation: "Tâche 1",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "in_progress",
          isEstimatedDurationValidated: true,
          planningStart: localIso("2026-06-23", 10),
          planningEnd: localIso("2026-06-23", 11),
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_fast_01",
          planningDate: "2026-06-23"
        },
        {
          id: "task-p2",
          designation: "Tâche 2",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true
        }
      ]
    });

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-date-input"]').fill("2026-06-23");
    await expect(page.locator('[data-testid="planning-date-input"]')).toHaveValue("2026-06-23");

    await humanSelect(page, page.locator('[data-testid="planning-manual-dossier"]'), "NIMR-VEHICLE-COLLISION");
    await humanSelect(page, page.locator('[data-testid="planning-manual-task"]'), "task-p2");
    await humanSelect(page, page.locator('[data-testid="planning-manual-tech"]'), "tech_02");
    await humanSelect(page, page.locator('[data-testid="planning-manual-bay"]'), "bay_fast_01");

    await humanSelect(page, page.locator('[data-testid="planning-manual-hour"]'), "10");
    await humanSelect(page, page.locator('[data-testid="planning-manual-minute"]'), "30");

    await expect(page.locator('[data-testid="planning-collision-vehicle"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-manual-submit"]')).toBeDisabled();
  });

  test("3. Vehicle collision multi-dossiers with same plate/VIN", async ({ page }) => {
    const dossierA = createMockDossier({
      id: "NIMR-DOSSIER-A",
      clientNom: "Client A",
      vehiculeImmatriculation: "333 TU 333",
      vehiculeVIN: "SAMEVIN333",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-a",
          designation: "Tâche A",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "in_progress",
          isEstimatedDurationValidated: true,
          planningStart: localIso("2026-06-23", 9),
          planningEnd: localIso("2026-06-23", 10),
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_fast_01",
          planningDate: "2026-06-23"
        }
      ]
    });

    const dossierB = createMockDossier({
      id: "NIMR-DOSSIER-B",
      clientNom: "Client B",
      vehiculeImmatriculation: "333tu333",
      vehiculeVIN: "  samevin333  ",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-b",
          designation: "Tâche B",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true
        }
      ]
    });

    await seedDossiers(page, [dossierA, dossierB]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-date-input"]').fill("2026-06-23");
    await expect(page.locator('[data-testid="planning-date-input"]')).toHaveValue("2026-06-23");

    await humanSelect(page, page.locator('[data-testid="planning-manual-dossier"]'), "NIMR-DOSSIER-B");
    await humanSelect(page, page.locator('[data-testid="planning-manual-task"]'), "task-b");

    await humanSelect(page, page.locator('[data-testid="planning-manual-hour"]'), "09");
    await humanSelect(page, page.locator('[data-testid="planning-manual-minute"]'), "30");

    await expect(page.locator('[data-testid="planning-collision-vehicle"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-manual-submit"]')).toBeDisabled();
  });

  test("4. Auto-reservation sequential scheduling and order", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-AUTO-SEQ",
      clientNom: "Auto Seq Tester",
      vehiculeImmatriculation: "444 TU 444",
      vehiculeVIN: "SEQVIN444",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-diag",
          designation: "Diagnostic Freins",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true
        },
        {
          id: "task-repar",
          designation: "Remplacement Plaquettes",
          tempsEstime: 2.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true
        }
      ]
    });

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-date-input"]').fill("2026-06-23");
    await expect(page.locator('[data-testid="planning-date-input"]')).toHaveValue("2026-06-23");

    await humanSelect(page, page.locator('[data-testid="planning-eta-vehicle-select"]'), "NIMR-AUTO-SEQ");
    await humanClick(page, page.locator('[data-testid="planning-auto-reserve-btn"]'));

    await expect(page.locator('[data-testid="auto-planning-success"]')).toBeVisible();
    const reservations = await page.evaluate((key) => {
      return JSON.parse(localStorage.getItem(key) || "[]") as WorkshopReservation[];
    }, STORAGE_KEYS.reservations);
    expect(reservations).toHaveLength(2);
    const diagnostic = reservations.find(reservation => reservation.taskIds.includes("task-diag"));
    const repair = reservations.find(reservation => reservation.taskIds.includes("task-repar"));
    expect(diagnostic?.endTime).toBeTruthy();
    expect(repair?.startTime).toBeTruthy();
    expect(new Date(diagnostic!.endTime!).getTime()).toBeLessThanOrEqual(new Date(repair!.startTime!).getTime());
  });

  test("5. Delivery ETA calculation and role views", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-AUTO-ETA",
      clientNom: "ETA Tester",
      vehiculeImmatriculation: "555 TU 555",
      vehiculeVIN: "ETAVIN555",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-eta",
          designation: "Vidange",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true,
          planningStart: localIso("2026-06-23", 8),
          planningEnd: localIso("2026-06-23", 9),
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_fast_01",
          planningDate: "2026-06-23"
        }
      ]
    });

    await seedDossiers(page, [dossier]);

    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`[data-testid="dossier-card-NIMR-AUTO-ETA"]`));

    await expect(page.locator('[data-testid="vehicle-eta-block"]')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-eta-block"]')).toContainText("Livraison estimée : 23/06/2026 09:15");

    await changeUserRole(page, "role-option-receptionnaire");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`[data-testid="dossier-card-NIMR-AUTO-ETA"]`));
    await expect(page.locator('[data-testid="vehicle-eta-block"]')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-eta-block"]')).toContainText("Livraison estimée sous réserve de validation atelier.");
  });

  test("6. Auto-reservation blocked if duration not validated", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-AUTO-NOTVAL",
      clientNom: "Not Validated Tester",
      vehiculeImmatriculation: "666 TU 666",
      vehiculeVIN: "NOTVALVIN666",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-notval",
          designation: "Vidange",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: false
        }
      ]
    });

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-date-input"]').fill("2026-06-23");
    await expect(page.locator('[data-testid="planning-date-input"]')).toHaveValue("2026-06-23");

    await humanSelect(page, page.locator('[data-testid="planning-eta-vehicle-select"]'), "NIMR-AUTO-NOTVAL");
    await humanClick(page, page.locator('[data-testid="planning-auto-reserve-btn"]'));

    await expect(page.locator('[data-testid="auto-planning-error"]')).toContainText("Durée à valider avant réservation automatique.");
  });

  test("7. Planning modification recalculates ETA correctly", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-AUTO-MODIF",
      clientNom: "Modif Tester",
      vehiculeImmatriculation: "777 TU 777",
      vehiculeVIN: "MODIFVIN777",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-modif",
          designation: "Vidange",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true,
          planningStart: localIso("2026-06-23", 8),
          planningEnd: localIso("2026-06-23", 9),
          plannedTechnicianId: "tech_03",
          plannedBayId: "bay_fast_01",
          planningDate: "2026-06-23"
        }
      ]
    });

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-date-input"]').fill("2026-06-23");
    await expect(page.locator('[data-testid="planning-date-input"]')).toHaveValue("2026-06-23");

    await humanSelect(page, page.locator('[data-testid="planning-eta-vehicle-select"]'), "NIMR-AUTO-MODIF");
    await expect(page.locator('[data-testid="vehicle-eta-value"]')).toContainText("23/06/2026 09:15");

    await humanSelect(page, page.locator('[data-testid="planning-manual-dossier"]'), "NIMR-AUTO-MODIF");
    await humanSelect(page, page.locator('[data-testid="planning-manual-task"]'), "task-modif");
    await humanSelect(page, page.locator('[data-testid="planning-manual-tech"]'), "tech_03");
    await humanSelect(page, page.locator('[data-testid="planning-manual-hour"]'), "11");
    await humanSelect(page, page.locator('[data-testid="planning-manual-minute"]'), "00");
    await humanClick(page, page.locator('[data-testid="planning-manual-submit"]'));

    await expect(page.locator('[data-testid="vehicle-eta-value"]')).toContainText("23/06/2026 12:15");
  });

  test("8. Existing collisions remain blockings", async ({ page }) => {
    const techDossier = createMockDossier({
      id: "NIMR-TECH-COLL",
      clientNom: "Tech Collide",
      vehiculeImmatriculation: "888 TU 888",
      vehiculeVIN: "TECHVIN888",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-tech-fixed",
          designation: "Tâche tech",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "in_progress",
          isEstimatedDurationValidated: true,
          planningStart: localIso("2026-06-23", 8),
          planningEnd: localIso("2026-06-23", 9),
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_fast_01",
          planningDate: "2026-06-23"
        }
      ]
    });

    const candidateDossier = createMockDossier({
      id: "NIMR-CANDIDATE",
      clientNom: "Candidate",
      vehiculeImmatriculation: "999 TU 999",
      vehiculeVIN: "CANDIDATE999",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-candidate",
          designation: "Vidange",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true
        }
      ]
    });

    await seedDossiers(page, [techDossier, candidateDossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-date-input"]').fill("2026-06-23");
    await expect(page.locator('[data-testid="planning-date-input"]')).toHaveValue("2026-06-23");

    await humanSelect(page, page.locator('[data-testid="planning-manual-dossier"]'), "NIMR-CANDIDATE");
    await humanSelect(page, page.locator('[data-testid="planning-manual-task"]'), "task-candidate");
    await humanSelect(page, page.locator('[data-testid="planning-manual-tech"]'), "tech_01");

    await humanSelect(page, page.locator('[data-testid="planning-manual-hour"]'), "08");
    await humanSelect(page, page.locator('[data-testid="planning-manual-minute"]'), "00");

    await expect(page.locator('[data-testid="planning-collision-tech"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-manual-submit"]')).toBeDisabled();
  });

  test("9. Atomic auto-reservation: all-or-nothing rollback", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-AUTO-ATOMIC",
      clientNom: "Atomic Tester",
      vehiculeImmatriculation: "000 TU 000",
      vehiculeVIN: "ATOMICVIN000",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [
        {
          id: "task-atomic-ok",
          designation: "Vidange",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true
        },
        {
          id: "task-atomic-huge",
          designation: "Gros travaux",
          tempsEstime: 1.0,
          tempsPasse: 0,
          status: "pending",
          isEstimatedDurationValidated: true
        }
      ]
    });

    const unavailableTechnicians = MOCK_TECHNICIENS.map(technician => ({
      ...technician,
      disponibilite: "absent" as const,
    }));
    await seedDossiers(page, [dossier], unavailableTechnicians);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    await page.locator('[data-testid="planning-date-input"]').fill("2026-06-23");
    await expect(page.locator('[data-testid="planning-date-input"]')).toHaveValue("2026-06-23");

    await humanSelect(page, page.locator('[data-testid="planning-eta-vehicle-select"]'), "NIMR-AUTO-ATOMIC");
    await humanClick(page, page.locator('[data-testid="planning-auto-reserve-btn"]'));

    await expect(page.locator('[data-testid="auto-planning-error"]')).toContainText("Aucun créneau disponible dans la période sélectionnée.");
    const reservations = await page.evaluate((key) => {
      return JSON.parse(localStorage.getItem(key) || "[]") as WorkshopReservation[];
    }, STORAGE_KEYS.reservations);
    expect(reservations).toEqual([]);
  });

});
