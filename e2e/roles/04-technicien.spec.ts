import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "../helpers/human-actions";
import { createMockDossier } from "../helpers/test-data-creator";
import { STORAGE_KEYS } from "../../src/storage-keys";
import { DossierStatus } from "../../src/types";

test.describe("Rôle : Technicien", () => {
  const mockPhoto = {
    id: "photo_test_1",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='blue'/></svg>",
    title: "Vérification pare-chocs",
    category: "défaut carrosserie" as const,
    takenBy: "Réceptionnaire",
    date: new Date().toISOString()
  };

  const mockLog = `${new Date().toISOString()} - [Technicien] - Initialisation de la tâche`;

  const dossierAssigned = createMockDossier({
    id: "NIMR-TECH-001",
    clientNom: "Assigned Client",
    statut: DossierStatus.EN_TRAVAUX,
    technicienId: "tech_01",
    ordresReparation: [
      { id: "ro_tech_1", designation: "Tâche en attente", tempsEstime: 2.0, tempsPasse: 0, status: "pending" },
      { id: "ro_tech_done", designation: "Tâche finie", tempsEstime: 1.0, tempsPasse: 1.0, status: "done" }
    ],
    photosAvant: [mockPhoto],
    historiqueLogs: [mockLog]
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

  test("Boutons XL et Cycle de tâche : démarrage, bandeau active visible, pause puis reprise", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // 1. Verify Start button is visible and has large tactile styling (check classes containing 'py-3.5')
    const startBtn = page.locator('[data-testid="task-start-ro_tech_1"]');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toHaveClass(/py-3\.5/);

    // 2. Start the pending task
    await humanClick(page, startBtn);
    
    // Check custom success message
    await expect(page.locator('[data-testid="technician-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="technician-success-message"]')).toContainText(/démarrée/i);
    
    // Status is now "En cours"
    await expect(page.locator('[data-testid="task-status-ro_tech_1"]')).toHaveText(/En cours/i);

    // 3. Verify active task banner is visible
    const activeBanner = page.locator('[data-testid="technician-active-task-banner"]');
    await expect(activeBanner).toBeVisible();
    await expect(activeBanner).toContainText(/TRAVAIL EN COURS SUR CE VÉHICULE/i);

    // 4. Pause the task
    const pauseBtn = page.locator('[data-testid="task-pause-ro_tech_1"]');
    await expect(pauseBtn).toBeVisible();
    await expect(pauseBtn).toHaveClass(/py-3\.5/); // XL tactile classes
    await humanClick(page, pauseBtn);

    // Check status is now "Suspendu" and active banner disappeared
    await expect(page.locator('[data-testid="task-status-ro_tech_1"]')).toHaveText(/Suspendu/i);
    await expect(activeBanner).toHaveCount(0);

    // 5. Resume task (start button should say "Reprendre" or start, but it's the start testid)
    await humanClick(page, startBtn);
    await expect(page.locator('[data-testid="task-status-ro_tech_1"]')).toHaveText(/En cours/i);
    await expect(activeBanner).toBeVisible();

    // 6. Finished task cannot be restarted/reopened by tech
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

    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // Start button of the pending task should be disabled because the technician has an active task in another dossier
    const startBtn = page.locator('[data-testid="task-start-ro_tech_1"]');
    await expect(startBtn).toBeDisabled();

    // Verify the locked task banner explains the active technician conflict.
    const lockedMsg = page.locator('[data-testid="technician-task-locked-message"]');
    await expect(lockedMsg).toBeVisible();
    await expect(lockedMsg).toContainText(/Ce technicien a déjà une tâche en cours./i);
  });

  test("Technicien peut bloquer une tâche en cours avec motif obligatoire via le modal", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // 1. Start pending task to make it in_progress
    const startBtn = page.locator('[data-testid="task-start-ro_tech_1"]');
    await humanClick(page, startBtn);

    // 2. Click block button
    const blockBtn = page.locator('[data-testid="task-block-ro_tech_1"]');
    await expect(blockBtn).toBeVisible();
    await humanClick(page, blockBtn);

    // 3. Modal task-block should be visible
    const modal = page.locator('[data-testid="modal-task-block"]');
    await expect(modal).toBeVisible();

    // 4. Confirm button should be disabled initially
    const confirmBtn = page.locator('[data-testid="modal-task-block-confirm"]');
    await expect(confirmBtn).toBeDisabled();

    // 5. Select "Autre (saisie libre)"
    const select = page.locator('[data-testid="modal-task-block-select"]');
    await select.selectOption("Autre (saisie libre)");

    // 6. Confirm button should still be disabled because details are empty
    await expect(confirmBtn).toBeDisabled();

    // 7. Fill details
    const input = page.locator('[data-testid="modal-task-block-input"]');
    await input.fill("Attente pièce de rechange critique");

    // 8. Confirm button should now be enabled
    await expect(confirmBtn).toBeEnabled();

    // 9. Click confirm
    await humanClick(page, confirmBtn);

    // 10. Modal should close
    await expect(modal).toHaveCount(0);

    // 11. Verify task status has updated to bloquée
    await expect(page.locator('[data-testid="task-status-ro_tech_1"]')).toHaveText(/bloquée/i);
  });

  test("Observations rapides et libres avec presets", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    const textarea = page.locator('[data-testid="technician-observation-textarea"]');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue("");

    // Click Preset 0
    await humanClick(page, page.locator('[data-testid="technician-observation-preset-0"]'));
    await expect(textarea).toHaveValue("Vis/Écrou grippé débloqué");

    // Click Preset 2 (should append with comma)
    await humanClick(page, page.locator('[data-testid="technician-observation-preset-2"]'));
    await expect(textarea).toHaveValue("Vis/Écrou grippé débloqué, Faisceau électrique vérifié");

    // Free text input
    await textarea.type(" - complété manuellement");
    await expect(textarea).toHaveValue("Vis/Écrou grippé débloqué, Faisceau électrique vérifié - complété manuellement");

    // Save note
    await humanClick(page, page.locator('text=Sauvegarder la note'));
    await expect(page.locator('[data-testid="technician-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="technician-success-message"]')).toContainText(/Note technique ajoutée/i);
    await expect(textarea).toHaveValue("");
  });

  test("Galerie photos visible, vignette et zoom viewer", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // Photo gallery should be visible
    const gallery = page.locator('[data-testid="technician-photo-gallery"]');
    await expect(gallery).toBeVisible();

    // Thumbnail should be visible
    const thumbnail = page.locator('[data-testid="technician-photo-thumbnail"]');
    await expect(thumbnail).toBeVisible();

    // Zoom on thumbnail
    await humanClick(page, thumbnail);
    const viewer = page.locator('[data-testid="technician-photo-viewer"]');
    await expect(viewer).toBeVisible();

    // Close zoom viewer
    await humanClick(page, viewer.locator('text=✕'));
    await expect(viewer).toHaveCount(0);
  });

  test("Historique simplifié visible", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // History log container should be visible
    const history = page.locator('[data-testid="technician-task-history"]');
    await expect(history).toBeVisible();
    await expect(history).toContainText(/Initialisation de la tâche/i);
  });

  test("Persistance après refresh", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // Start task
    const startBtn = page.locator('[data-testid="task-start-ro_tech_1"]');
    await humanClick(page, startBtn);
    await expect(page.locator('[data-testid="task-status-ro_tech_1"]')).toHaveText(/En cours/i);

    // Refresh page
    await page.reload();
    await changeUserRole(page, "role-option-technicien");
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    // Verify task is still in progress
    await expect(page.locator('[data-testid="task-status-ro_tech_1"]')).toHaveText(/En cours/i);
    await expect(page.locator('[data-testid="technician-active-task-banner"]')).toBeVisible();
  });
});
