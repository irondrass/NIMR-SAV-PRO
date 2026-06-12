import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierPriority, DossierStatus } from "../src/types";

test.describe("Lot 5E - Recherche véhicule, dossier et statuts tâche Gantt", () => {
  const planningDate = "2026-06-09";
  const dossiers = [
    // Vehicle 1: 123 TU 4567 (VIN: VIN1) - Blocked
    createMockDossier({
      id: "NIMR-V-001",
      clientNom: "Alice Dupont",
      vehiculeImmatriculation: "123 TU 4567",
      vehiculeVIN: "VIN123_1",
      vehiculeMarque: "DFSK",
      vehiculeModele: "Glory 500",
      statut: DossierStatus.BLOQUE,
      priorite: DossierPriority.VEHICULE_IMMOBILISE,
      dateReception: `${planningDate}T08:00:00.000Z`,
      ordresReparation: [
        { id: "T1_1", designation: "Mécanique", tempsEstime: 2, tempsPasse: 0, status: "blocked", planningStart: `${planningDate}T09:00:00.000Z`, planningEnd: `${planningDate}T11:00:00.000Z`, planningDate, plannedTechnicianId: "tech_1", plannedBayId: "bay_fast_01" }
      ]
    }),
    // Vehicle 2: 999 TU 8888 (VIN: VIN2) - Two dossiers: one delivered, one in progress
    createMockDossier({
      id: "NIMR-V-002",
      clientNom: "Bob Smith",
      vehiculeImmatriculation: "999 TU 8888",
      vehiculeVIN: "VIN123_2",
      vehiculeMarque: "Forthing",
      vehiculeModele: "T5 EVO",
      statut: DossierStatus.LIVRE,
      priorite: DossierPriority.NORMALE,
      dateReception: "2026-05-15T08:00:00.000Z"
    }),
    createMockDossier({
      id: "NIMR-V-003",
      clientNom: "Bob Smith",
      vehiculeImmatriculation: "999 TU 8888",
      vehiculeVIN: "VIN123_2",
      vehiculeMarque: "Forthing",
      vehiculeModele: "T5 EVO",
      statut: DossierStatus.EN_TRAVAUX,
      priorite: DossierPriority.NORMALE,
      dateReception: `${planningDate}T08:00:00.000Z`,
      ordresReparation: [
        { id: "T3_1", designation: "Electricite", tempsEstime: 1.5, tempsPasse: 0.5, status: "in_progress", planningStart: `${planningDate}T14:00:00.000Z`, planningEnd: `${planningDate}T15:30:00.000Z`, planningDate, plannedTechnicianId: "tech_1", plannedBayId: "bay_fast_01" }
      ]
    }),
  ];

  const techs = [
    createMockTech({ id: "tech_1", nom: "Ali Tech" })
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ keyD, valD, keyT, valT }) => {
      localStorage.clear();
      localStorage.setItem(keyD, JSON.stringify(valD));
      localStorage.setItem(keyT, JSON.stringify(valT));
    }, {
      keyD: STORAGE_KEYS.dossiers, valD: dossiers,
      keyT: STORAGE_KEYS.techs, valT: techs
    });
    // Inject mock now for Gantt
    await page.addInitScript(() => {
      (window as any).__mockNow = "2026-06-09T10:00:00.000Z";
    });
    await page.reload();
  });

  test("Directeur: recherche par immatriculation, carte véhicule, multi-dossier et filtres", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");

    // Open Dossiers Tab
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await expect(page.locator("text=Tous les Dossiers Actifs SAV")).toBeVisible();

    // Toggle to Vehicle Search Mode
    await humanClick(page, page.locator('[data-testid="dossier-mode-vehicles"]'));
    await expect(page.locator('[data-testid="vehicle-search-input"]')).toBeVisible();

    // Search by immatriculation "123 TU 4567"
    await humanFill(page, page.locator('[data-testid="vehicle-search-input"]'), "123 TU 4567");

    // Verify vehicle card content
    const card1 = page.locator('[data-testid="vehicle-card"]').filter({ hasText: "Alice Dupont" });
    await expect(card1.locator('[data-testid="vehicle-vin"]')).toContainText("VIN123_1");
    await expect(card1.locator('[data-testid="vehicle-marque-modele"]')).toContainText("DFSK Glory 500");
    await expect(card1.locator('[data-testid="vehicle-client"]')).toContainText("Alice Dupont");
    await expect(card1.locator('[data-testid="vehicle-dossiers-count"]')).toContainText("1 dossier");
    await expect(card1.locator('[data-testid="vehicle-last-visit"]')).toContainText("09/06/2026");

    // Open dossier from vehicle results
    await humanClick(page, card1.locator('[data-testid="vehicle-linked-dossier-open-btn"]'));
    await expect(page.locator('[data-testid="dossier-detail-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="dossier-id-title"]')).toContainText("NIMR-V-001");

    // Go back to list and search for Bob
    await humanClick(page, page.locator('[data-testid="dossier-back-btn"]'));
    await humanClick(page, page.locator('[data-testid="dossier-mode-vehicles"]'));
    await humanFill(page, page.locator('[data-testid="vehicle-search-input"]'), "Bob");

    // Verify Bob's vehicle shows "2 dossiers" (one delivered, one in progress)
    const cardBob = page.locator('[data-testid="vehicle-card"]').filter({ hasText: "Bob Smith" });
    await expect(cardBob.locator('[data-testid="vehicle-dossiers-count"]')).toContainText("2 dossiers");

    // Verify that the status is "En cours" (in progress) even though there is an old delivered dossier
    await expect(cardBob.locator('[data-testid="vehicle-status"]')).toContainText("En cours");

    // Verify linked dossiers rows
    const dossierRow1 = cardBob.locator("tr").filter({ hasText: "NIMR-V-003" });
    await expect(dossierRow1.locator('[data-testid="vehicle-linked-dossier-status"]')).toContainText("En travaux");
    await expect(dossierRow1.locator('[data-testid="vehicle-linked-dossier-main-task-status"]')).toContainText("in_progress");

    await humanFill(page, page.locator('[data-testid="vehicle-search-input"]'), "");

    // Filter "Véhicules bloqués"
    await humanClick(page, page.locator('[data-testid="filter-vehicle-blocked"]'));
    await expect(page.locator('[data-testid="vehicle-vin"]:has-text("VIN123_1")')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-vin"]:has-text("VIN123_2")')).toHaveCount(0);

    // Filter "Multi-dossiers"
    await humanClick(page, page.locator('[data-testid="filter-vehicle-multiple"]'));
    await expect(page.locator('[data-testid="vehicle-vin"]:has-text("VIN123_2")')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-vin"]:has-text("VIN123_1")')).toHaveCount(0);
  });

  test("Lecture seule: recherche possible, modification désactivée", async ({ page }) => {
    await changeUserRole(page, "role-option-lecture-seule");

    // Open Dossiers Tab
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator('[data-testid="dossier-mode-vehicles"]'));

    // Search is functional
    await humanFill(page, page.locator('[data-testid="vehicle-search-input"]'), "Alice");
    await expect(page.locator('[data-testid="vehicle-client"]:has-text("Alice Dupont")')).toBeVisible();

    // Open dossier detail
    await humanClick(page, page.locator('[data-testid="vehicle-linked-dossier-open-btn"]'));
    await expect(page.locator('[data-testid="dossier-detail-view"]')).toBeVisible();

    // Verify read-only: no save/edit action should be available (e.g. no force-status-select)
    await expect(page.locator('[data-testid="force-status-select"]')).toHaveCount(0);
  });

  test("Chef Atelier: recherche dans Gantt et statuts de tâches", async ({ page }) => {
    await changeUserRole(page, "role-option-chef-atelier");

    // Open Planning Tab
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await expect(page.locator('[data-testid="planning-gantt-chart"]')).toBeVisible();
    await page.locator('[data-testid="planning-date-input"]').fill(planningDate);
    await expect(page.locator('[data-testid="planning-date-input"]')).toHaveValue(planningDate);

    // Verify task status badges inside Gantt blocks
    const blockBlocked = page.locator('[data-testid="gantt-task-status-blocked"]').first();
    await expect(blockBlocked).toBeVisible();
    await expect(blockBlocked).toContainText("Bloquée");

    const blockInProgress = page.locator('[data-testid="gantt-task-status-in-progress"]').first();
    await expect(blockInProgress).toBeVisible();
    await expect(blockInProgress).toContainText("En cours");

    // Verify legend is visible
    await expect(page.locator('[data-testid="gantt-status-legend"]')).toBeVisible();

    // Search by immatriculation in Gantt
    await humanFill(page, page.locator('[data-testid="gantt-search-input"]'), "123 TU 4567");

    // Only the block for DFSK Glory (NIMR-V-001) should remain visible
    await expect(page.locator('[data-testid="gantt-block-T1_1"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="gantt-block-T3_1"]')).toHaveCount(0);
  });
});
