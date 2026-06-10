import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "../helpers/human-actions";
import { createMockDossier } from "../helpers/test-data-creator";
import { STORAGE_KEYS } from "../../src/storage-keys";
import { DossierStatus } from "../../src/types";

test.describe("Rôle : Technicien", () => {
  const dossierAssigned = createMockDossier({
    id: "NIMR-TECH-001",
    clientNom: "Assigned Client",
    statut: DossierStatus.EN_TRAVAUX,
    technicienId: "tech_01",
    ordresReparation: [
      { id: "ro_tech_1", designation: "Tâche en attente", tempsEstime: 2.0, tempsPasse: 0, status: "pending" },
      { id: "ro_tech_done", designation: "Tâche finie", tempsEstime: 1.0, tempsPasse: 1.0, status: "done" }
    ]
  });

  const dossierUnassigned = createMockDossier({
    id: "NIMR-TECH-002",
    clientNom: "Unassigned Client",
    statut: DossierStatus.VEHICULE_RECU,
    technicienId: "tech_02",
    ordresReparation: []
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ keyDossiers, valDossiers }) => {
      localStorage.clear();
      localStorage.setItem(keyDossiers, JSON.stringify(valDossiers));
    }, {
      keyDossiers: STORAGE_KEYS.dossiers,
      valDossiers: [dossierAssigned, dossierUnassigned]
    });
    await page.reload();
    await changeUserRole(page, "role-option-technicien");
  });

  test("Accès restrictif aux dossiers assignés", async ({ page }) => {
    // Technicians should only see their own assigned dossiers
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));
    await expect(page.locator(`text=${dossierAssigned.id}`)).toBeVisible();
    await expect(page.locator(`text=${dossierUnassigned.id}`)).not.toBeVisible();
  });

  test("Cycle de tâche : démarrer, suspendre et impossibilité de redémarrer une tâche terminée", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // 1. Start pending task
    const startBtn = page.locator('[data-testid="task-start-ro_tech_1"]');
    await expect(startBtn).toBeVisible();
    await humanClick(page, startBtn);
    await expect(page.locator('[data-testid="task-status-ro_tech_1"]')).toHaveText(/En cours/i);

    // 2. Pause task
    const pauseBtn = page.locator('[data-testid="task-pause-ro_tech_1"]');
    await expect(pauseBtn).toBeVisible();
    await humanClick(page, pauseBtn);
    await expect(page.locator('[data-testid="task-status-ro_tech_1"]')).toHaveText(/Suspendu/i);

    // 3. Try to reopen/restart a finished task
    // Finish should not be visible. Start/reopen should not be visible on done task
    await expect(page.locator('[data-testid="task-start-ro_tech_done"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="task-reopen-ro_tech_done"]')).not.toBeVisible();
  });

  test("Verrouillage de tâche : technicien avec deux tâches en cours", async ({ page }) => {
    // Seed another dossier assigned to tech_01 that is already in progress
    const activeDossier = createMockDossier({
      id: "NIMR-ACTIVE-001",
      clientNom: "Active Client",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        { id: "ro_active_1", designation: "Tâche active", tempsEstime: 2.0, tempsPasse: 1.0, status: "in_progress" }
      ]
    });

    await page.evaluate(({ keyDossiers, valDossiers }) => {
      localStorage.setItem(keyDossiers, JSON.stringify(valDossiers));
    }, {
      keyDossiers: STORAGE_KEYS.dossiers,
      valDossiers: [dossierAssigned, activeDossier]
    });
    await page.reload();
    await changeUserRole(page, "role-option-technicien");

    // Go to dossierAssigned detail (which has a pending task)
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // Start button of the pending task should be disabled because the technician has an active task in another dossier
    const startBtn = page.locator('[data-testid="task-start-ro_tech_1"]');
    await expect(startBtn).toBeDisabled();

    // Verify warning text is displayed
    await expect(page.locator('text=Ce technicien a déjà une tâche en cours.')).toBeVisible();
  });
});
