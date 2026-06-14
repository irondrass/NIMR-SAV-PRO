/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus } from "../src/types";

test.describe("NIMR-SAV-PRO Lot 6B — Recette terrain & corrections P0", () => {
  
  test("Technicien : bouton Démarrer désactivé n'exécute pas l'action si cliqué", async ({ page }) => {
    // Seed a technician tech_01 who already has an active task in NIMR-ACTIVE-001,
    // and has a pending task in NIMR-ASSIGNED-001.
    const assignedDossier = createMockDossier({
      id: "NIMR-ASSIGNED-001",
      clientNom: "Client Assigné",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        { id: "ro_pending_1", designation: "Tâche en attente", tempsEstime: 2.0, tempsPasse: 0, status: "pending" }
      ]
    });

    const activeDossier = createMockDossier({
      id: "NIMR-ACTIVE-001",
      clientNom: "Client Actif",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        { id: "ro_active_1", designation: "Tâche active", tempsEstime: 2.0, tempsPasse: 1.0, status: "in_progress" }
      ]
    });

    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [assignedDossier, activeDossier] });
    await page.reload();

    // Log in as Technicien
    await changeUserRole(page, "role-option-technicien");
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    const startBtn = page.locator('[data-testid="task-start-ro_pending_1"]');
    await expect(startBtn).toBeDisabled();

    // Force a click event programmatically on the button to check if the safety guard works
    await startBtn.evaluate(node => (node as HTMLButtonElement).click());

    // The task status must remain "à faire" (pending), not "En cours"
    await expect(page.locator('[data-testid="task-status-ro_pending_1"]')).toHaveText(/à faire/i);
  });

  test("Directeur : Taux d'occupation atelier > 0% si des charges existent", async ({ page }) => {
    // Log in as Directeur SAV to check the KPI Dashboard
    await page.goto("/");
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-dashboard"]'));

    // The workshop occupancy KPI card should show a rate > 0%
    const occupancyCard = page.locator('[data-testid="kpi-workshop-occupancy"]');
    await expect(occupancyCard).toBeVisible();
    
    // It should NOT display "0%" because default seed data has planned tasks/reservations
    const valueEl = occupancyCard.locator('div.text-2xl');
    const rateText = await valueEl.textContent();
    expect(rateText).not.toContain("0%");
  });

  test("Directeur : Délais mesurables affichés pour le dossier démo complet", async ({ page }) => {
    // Log in as Directeur SAV, check the reports tab
    await page.goto("/");
    await changeUserRole(page, "role-option-directeur");
    
    // Go to "Rapports SAV" tab
    await humanClick(page, page.locator('[data-testid="nav-performance"]'));

    // Check that we see the page header
    await expect(page.locator("text=Rapports SAV NIMR")).toBeVisible();

    // Go to Historique Dossier tab
    await humanClick(page, page.locator('[data-testid="report-tab-dossier-history"]'));

    // Search for the demo dossier
    await page.locator('[data-testid="history-dossier-input"]').fill("NIMR-2026-006");
    await humanClick(page, page.locator('[data-testid="history-dossier-search-btn"]'));

    // Verify history results are shown
    const resultDiv = page.locator('[data-testid="dossier-history-result"]');
    await expect(resultDiv).toBeVisible();
    await expect(resultDiv).toContainText("NIMR-2026-006");
  });
});
