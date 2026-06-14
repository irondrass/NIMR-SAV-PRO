/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus, UserRole } from "../src/types";

test.describe("NIMR-SAV-PRO Lot 6C — Corrections terrain persistantes post-ré-audit", () => {

  test("Chef Atelier : voit la charge technicien non 0h/0h si tâche active et charge pont mesurable", async ({ page }) => {
    const testDossier = createMockDossier({
      id: "NIMR-LOT6C-001",
      clientNom: "Client Test 6C",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        {
          id: "ro_active_6c",
          designation: "Vidange et Filtration 6C",
          tempsEstime: 3.5,
          tempsPasse: 1.0,
          status: "in_progress",
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_mech_01", // "bay_mech_01" is the actual ID for "Pont mécanique 1"
          planningDate: "2026-06-15",
          planningStart: "2026-06-15T08:00:00",
          planningEnd: "2026-06-15T11:30:00"
        }
      ]
    });

    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [testDossier] });

    await page.reload();

    // Log in as Chef Atelier
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));

    // Select date 2026-06-15 using date input with specific test ID
    const dateInput = page.locator('[data-testid="planning-date-input"]');
    if (await dateInput.isVisible()) {
      await dateInput.fill("2026-06-15");
      await dateInput.dispatchEvent("change");
    }

    // Verify technician charge is visible and not 0h / 0h
    const loadHoursEl = page.locator('[data-testid="technician-load-hours-tech_01"]');
    await expect(loadHoursEl).toBeVisible();
    const loadText = await loadHoursEl.textContent();
    expect(loadText).not.toContain("0h / 0h");
    expect(loadText).toContain("3.5h / 8h");

    const chargeEl = page.locator('[data-testid="technician-charge-tech_01"]');
    await expect(chargeEl).toBeVisible();
    const chargeText = await chargeEl.textContent();
    expect(chargeText).toContain("44%");

    // Verify bay load is visible and measurable
    const bayLoadHoursEl = page.locator('[data-testid="bay-load-hours-bay_mech_01"]');
    await expect(bayLoadHoursEl).toBeVisible();
    const bayLoadText = await bayLoadHoursEl.textContent();
    expect(bayLoadText).not.toContain("Non mesurable");
    expect(bayLoadText).toContain("3.5h / 8h");

    const bayChargeEl = page.locator('[data-testid="bay-charge-bay_mech_01"]');
    await expect(bayChargeEl).toBeVisible();
    const bayChargeText = await bayChargeEl.textContent();
    expect(bayChargeText).toContain("44%");
  });

  test("Directeur : voit une occupation atelier cohérente et horaires d'ouverture 08:00-17:00", async ({ page }) => {
    const testDossier = createMockDossier({
      id: "NIMR-LOT6C-002",
      clientNom: "Client Test Occupancy",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        {
          id: "ro_occ_1",
          designation: "Travail Occupancy",
          tempsEstime: 4.0,
          tempsPasse: 0,
          status: "pending",
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_mech_01",
          planningDate: "2026-06-15",
          planningStart: "2026-06-15T09:00:00",
          planningEnd: "2026-06-15T13:00:00"
        }
      ]
    });

    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [testDossier] });

    await page.reload();

    // Log in as Directeur SAV
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-dashboard"]'));

    // Check that we see the workshop occupancy
    const occupancyCard = page.locator('[data-testid="kpi-workshop-occupancy"]');
    await expect(occupancyCard).toBeVisible();
    const rateText = await occupancyCard.textContent();
    expect(rateText).not.toContain("NaN");

    // Go to planning and check schedule hours displayed
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    const dateInput = page.locator('[data-testid="planning-date-input"]');
    if (await dateInput.isVisible()) {
      await dateInput.fill("2026-06-15");
      await dateInput.dispatchEvent("change");
    }

    // Verify Gantt columns show hours from 08:00 to 17:00
    await expect(page.locator('[data-testid="gantt-hour-08"]')).toBeVisible();
    await expect(page.locator('[data-testid="gantt-hour-16"]')).toBeVisible();
    await expect(page.locator('[data-testid="gantt-hour-17"]')).toBeVisible();
    
    // There should be no 18:00 column by default
    await expect(page.locator('[data-testid="gantt-hour-18"]')).not.toBeVisible();
  });

  test("Technicien : ne voit pas le sélecteur compagnon et avertissement si profil non associé", async ({ page }) => {
    const mockUser = {
      id: "user_technicien_unknown",
      username: "tech_unknown",
      displayName: "Unknown Tech Name",
      role: UserRole.TECHNICIEN,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockSession = {
      userId: "user_technicien_unknown",
      displayName: "Unknown Tech Name",
      role: UserRole.TECHNICIEN,
      loginAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    await page.goto("/");
    await page.evaluate(({ usersKey, usersVal, sessionKey, sessionVal }) => {
      localStorage.clear();
      localStorage.setItem(usersKey, JSON.stringify(usersVal));
      localStorage.setItem(sessionKey, JSON.stringify(sessionVal));
    }, {
      usersKey: STORAGE_KEYS.users,
      usersVal: [mockUser],
      sessionKey: STORAGE_KEYS.session,
      sessionVal: mockSession
    });
    await page.reload();

    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // 1. Companion selector must NOT be visible
    const companionSelector = page.locator('[data-testid="companion-simulator-select"]');
    await expect(companionSelector).not.toBeVisible();

    // 2. Unmatched profile message must be visible
    const unmatchedMsg = page.locator('[data-testid="no-technician-profile-message"]');
    await expect(unmatchedMsg).toBeVisible();
    await expect(unmatchedMsg).toContainText("Aucun profil technicien associé à ce compte.");
  });

  test("Technicien : bouton Démarrer désactivé ne déclenche rien", async ({ page }) => {
    const testDossier = createMockDossier({
      id: "NIMR-LOT6C-003",
      clientNom: "Client Bloqué",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        { id: "task_active", designation: "Tâche en cours", tempsEstime: 2.0, tempsPasse: 1.0, status: "in_progress" },
        { id: "task_pending", designation: "Tâche en attente", tempsEstime: 1.5, tempsPasse: 0, status: "pending" }
      ]
    });

    const mockUser = {
      id: "user_technicien_01",
      username: "tech_01_user",
      displayName: "Technicien Démo 001", // Matches the mock technician name in data.ts
      role: UserRole.TECHNICIEN,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockSession = {
      userId: "user_technicien_01",
      displayName: "Technicien Démo 001",
      role: UserRole.TECHNICIEN,
      loginAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    await page.goto("/");
    await page.evaluate(({ dossiersKey, dossiersVal, usersKey, usersVal, sessionKey, sessionVal }) => {
      localStorage.clear();
      localStorage.setItem(dossiersKey, JSON.stringify(dossiersVal));
      localStorage.setItem(usersKey, JSON.stringify(usersVal));
      localStorage.setItem(sessionKey, JSON.stringify(sessionVal));
    }, {
      dossiersKey: STORAGE_KEYS.dossiers,
      dossiersVal: [testDossier],
      usersKey: STORAGE_KEYS.users,
      usersVal: [mockUser],
      sessionKey: STORAGE_KEYS.session,
      sessionVal: mockSession
    });

    await page.reload();

    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    const startBtn = page.locator('[data-testid="task-start-task_pending"]');
    await expect(startBtn).toBeDisabled();

    // Programmatic click should do nothing
    await startBtn.evaluate(node => (node as HTMLButtonElement).click());
    await expect(page.locator('[data-testid="task-status-task_pending"]')).toHaveText(/à faire/i);
  });

  test("Technicien : message de blocage non dupliqué", async ({ page }) => {
    const testDossier = createMockDossier({
      id: "NIMR-LOT6C-004",
      clientNom: "Client Bloqué Message",
      statut: DossierStatus.BLOQUE,
      technicienId: "tech_01",
      ordresReparation: [
        { id: "task_blocked", designation: "Tâche bloquée", tempsEstime: 2.0, tempsPasse: 0.5, status: "blocked" }
      ]
    });

    const mockUser = {
      id: "user_technicien_01",
      username: "tech_01_user",
      displayName: "Technicien Démo 001", // Matches the mock technician name in data.ts
      role: UserRole.TECHNICIEN,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockSession = {
      userId: "user_technicien_01",
      displayName: "Technicien Démo 001",
      role: UserRole.TECHNICIEN,
      loginAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    await page.goto("/");
    await page.evaluate(({ dossiersKey, dossiersVal, usersKey, usersVal, sessionKey, sessionVal }) => {
      localStorage.clear();
      localStorage.setItem(dossiersKey, JSON.stringify(dossiersVal));
      localStorage.setItem(usersKey, JSON.stringify(usersVal));
      localStorage.setItem(sessionKey, JSON.stringify(sessionVal));
    }, {
      dossiersKey: STORAGE_KEYS.dossiers,
      dossiersVal: [testDossier],
      usersKey: STORAGE_KEYS.users,
      usersVal: [mockUser],
      sessionKey: STORAGE_KEYS.session,
      sessionVal: mockSession
    });

    await page.reload();

    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // Count of locked messages must be exactly 1
    const lockedMessages = page.locator('[data-testid="technician-task-locked-message"]');
    await expect(lockedMessages).toHaveCount(1);
  });
});
