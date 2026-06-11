import { test, expect } from "@playwright/test";
import { changeUserRole, humanWait, humanClick } from "../helpers/human-actions";
import { createMockDossier, createMockTech } from "../helpers/test-data-creator";
import { STORAGE_KEYS } from "../../src/storage-keys";
import { DossierStatus, DossierPriority } from "../../src/types";

test.describe("Rôle : Directeur SAV", () => {
  const testDossier = createMockDossier({
    id: "NIMR-DIR-001",
    clientNom: "Directeur Client Test",
    statut: DossierStatus.EN_TRAVAUX,
    ordresReparation: [
      { id: "ro_dir_1", designation: "Contrôle moteur", tempsEstime: 2.0, tempsPasse: 2.0, status: "done" }
    ]
  });
  const blockedDossier = createMockDossier({
    id: "NIMR-DIR-BLOCKED",
    clientNom: "Directeur Blocage Test",
    statut: DossierStatus.BLOQUE,
    technicienId: "tech_01",
    bloqueRaison: "Attente pièce",
    ordresReparation: [
      { id: "ro_dir_blocked", designation: "Tâche bloquée", tempsEstime: 1.0, tempsPasse: 0.5, status: "blocked" }
    ]
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [testDossier, blockedDossier] });
    await page.reload();
    await changeUserRole(page, "role-option-directeur");
  });

  test("Accès global et tableau de bord 360", async ({ page }) => {
    // Assert current role displayed
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Directeur SAV");

    // All sidebar options should be accessible
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-dossiers"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-planning"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-settings"]')).toBeVisible();
  });

  test("Le forçage statut est absent de la fiche opérationnelle, la priorité reste éditable", async ({ page }) => {
    // Navigate to dossiers list and click our test dossier
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));

    // Status forcing must not exist in the operational dossier detail view.
    const statusSelect = page.locator('[data-testid="force-status-select"]');
    const prioritySelect = page.locator('[data-testid="force-priority-select"]');

    await expect(statusSelect).toHaveCount(0);
    await expect(prioritySelect).toBeVisible();

    // Force priority to URGENTE
    await prioritySelect.selectOption(DossierPriority.URGENTE);
    await humanWait(page, 200);

    // Refresh and check persistence
    await page.reload();
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));

    // Assert status has not been bypassed
    await expect(page.locator('[data-testid="status-badge"]').filter({ hasText: DossierStatus.EN_TRAVAUX })).toBeVisible();
  });

  test("Levée de blocage avec motif obligatoire avant reprise", async ({ page }) => {
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${blockedDossier.id}`));
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    const startBtn = page.locator('[data-testid="task-start-ro_dir_blocked"]');
    await expect(startBtn).toBeDisabled();
    await expect(page.locator('[data-testid="task-unblock-ro_dir_blocked"]')).toBeVisible();

    await humanClick(page, page.locator('[data-testid="task-unblock-ro_dir_blocked"]'));
    const modal = page.locator('[data-testid="modal-task-unblock"]');
    await expect(modal).toBeVisible();
    await expect(page.locator('[data-testid="modal-task-unblock-confirm"]')).toBeDisabled();

    await page.locator('[data-testid="modal-task-unblock-select"]').selectOption("Pièce reçue et contrôlée");
    await expect(page.locator('[data-testid="modal-task-unblock-confirm"]')).toBeEnabled();
    await humanClick(page, page.locator('[data-testid="modal-task-unblock-confirm"]'));

    await expect(page.locator('[data-testid="task-status-ro_dir_blocked"]')).toHaveText(/suspendue/i);
    await expect(page.locator('[data-testid="task-start-ro_dir_blocked"]')).toBeEnabled();
  });

  test("Réouverture d'une tâche terminée avec motif obligatoire", async ({ page }) => {
    // Go to dossier details
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));
 
    // Switch to Ordres de travaux tab
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
 
    // Check that reopen button is visible for the done task
    const reopenBtn = page.locator(`[data-testid="task-reopen-ro_dir_1"]`);
    await expect(reopenBtn).toBeVisible();
 
    // Click reopen to show modal
    await humanClick(page, reopenBtn);

    // Modal should be visible
    const modal = page.locator('[data-testid="modal-task-reopen"]');
    await expect(modal).toBeVisible();

    // Confirm button should be disabled initially
    const confirmBtn = page.locator('[data-testid="modal-task-reopen-confirm"]');
    await expect(confirmBtn).toBeDisabled();

    // Select "Autre (saisie libre)"
    const select = page.locator('[data-testid="modal-task-reopen-select"]');
    await select.selectOption("Autre (saisie libre)");

    // Confirm button should still be disabled because details are empty
    await expect(confirmBtn).toBeDisabled();

    // Fill details
    const input = page.locator('[data-testid="modal-task-reopen-input"]');
    await page.locator('[data-testid="modal-task-reopen-input"]').fill("Refus client suite essai");

    // Confirm button should now be enabled
    await expect(confirmBtn).toBeEnabled();

    // Click confirm
    await humanClick(page, confirmBtn);

    // Modal should be gone
    await expect(modal).toHaveCount(0);
 
    // Expect task to change back to reopened status
    await expect(page.locator('[data-testid="task-status-ro_dir_1"]')).toHaveText(/Réouvert/i);
  });

  test("Dashboard KPI Directeur Lot 5 visible, filtrable et sans périmètre interdit", async ({ page }) => {
    const now = new Date();
    const todayReception = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0).toISOString();
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 11, 0, 0).toISOString();
    const tomorrowDelivery = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 16, 0, 0).toISOString();
    const techs = [
      createMockTech({ id: "tech_01", nom: "Technicien KPI 01", capaciteJournaliere: 8 }),
      createMockTech({ id: "tech_02", nom: "Technicien KPI 02", capaciteJournaliere: 8 }),
    ];
    const ready = createMockDossier({
      id: "NIMR-DIR-KPI-READY",
      clientNom: "Client KPI Prêt",
      dateReception: todayReception,
      statut: DossierStatus.PRET_A_LIVRER,
      priorite: DossierPriority.URGENTE,
      ordresReparation: [
        {
          id: "ro_kpi_ready",
          designation: "Réparation validée",
          tempsEstime: 2,
          tempsPasse: 2,
          status: "done",
          plannedTechnicianId: "tech_01",
          plannedBayId: "bay_01",
          planningDate: todayReception.slice(0, 10),
          planningStart: todayStart,
          planningEnd: todayEnd,
          planningSegments: [{ start: todayStart, end: todayEnd }],
          history: [
            `${todayEnd} - Tâche terminée.`,
            `${todayStart} - Tâche démarrée.`,
          ],
        },
      ],
      checklistQC: {
        essaiEffectue: true,
        defautRepare: true,
        aucunVoyantAllume: true,
        niveauxVerifies: true,
        serrageSecurite: true,
        propreteVehicule: true,
        documentsPrets: true,
        photosApresOk: true,
        validationGlobale: "valide",
        dateValidation: todayEnd,
        validePar: "Contrôle Qualité",
      },
      livraison: {
        controleQualiteOk: true,
        clientInforme: true,
        dateLivraisonPrevue: tomorrowDelivery,
        remarquesLivraison: "",
        confirmationReceptionClient: false,
        clotureInterne: false,
      },
    });
    const blocked = createMockDossier({
      id: "NIMR-DIR-KPI-BLOCK",
      clientNom: "Client KPI Bloqué",
      dateReception: todayReception,
      statut: DossierStatus.BLOQUE,
      priorite: DossierPriority.VEHICULE_IMMOBILISE,
      technicienId: "tech_02",
      bloqueRaison: "Attente décision atelier",
      ordresReparation: [
        {
          id: "ro_kpi_block",
          designation: "Recherche panne",
          tempsEstime: 3,
          tempsPasse: 1,
          status: "blocked",
          plannedTechnicianId: "tech_02",
          plannedBayId: "bay_02",
          planningDate: todayReception.slice(0, 10),
          planningStart: todayStart,
          planningEnd: yesterdayEnd,
        },
      ],
    });
    const delivered = createMockDossier({
      id: "NIMR-DIR-KPI-LIVRE",
      clientNom: "Client KPI Livré",
      dateReception: todayReception,
      statut: DossierStatus.LIVRE,
      ordresReparation: [
        {
          id: "ro_kpi_livre",
          designation: "Essai final",
          tempsEstime: 1,
          tempsPasse: 1,
          status: "done",
          history: [`${todayEnd} - Tâche terminée.`, `${todayStart} - Tâche démarrée.`],
        },
      ],
      checklistQC: {
        essaiEffectue: true,
        defautRepare: true,
        aucunVoyantAllume: true,
        niveauxVerifies: true,
        serrageSecurite: true,
        propreteVehicule: true,
        documentsPrets: true,
        photosApresOk: true,
        validationGlobale: "valide",
        dateValidation: todayEnd,
      },
      livraison: {
        controleQualiteOk: true,
        clientInforme: true,
        dateLivraisonPrevue: tomorrowDelivery,
        dateLivraisonReelle: todayEnd,
        remarquesLivraison: "",
        confirmationReceptionClient: true,
        clotureInterne: true,
      },
    });
    const readyErp = createMockDossier({
      ...delivered,
      id: "NIMR-DIR-KPI-ERP",
      clientNom: "Client KPI ERP",
      statut: DossierStatus.PRET_FACTURATION,
    });

    await page.evaluate(({ dossierKey, techKey, dossiers, techs }) => {
      localStorage.clear();
      localStorage.setItem(dossierKey, JSON.stringify(dossiers));
      localStorage.setItem(techKey, JSON.stringify(techs));
    }, {
      dossierKey: STORAGE_KEYS.dossiers,
      techKey: STORAGE_KEYS.techs,
      dossiers: [ready, blocked, delivered, readyErp],
      techs,
    });
    await page.reload();
    await changeUserRole(page, "role-option-directeur");

    const dashboard = page.locator('[data-testid="director-dashboard"]');
    await expect(dashboard).toBeVisible();
    await expect(dashboard.locator('[data-testid="kpi-open-dossiers"]')).toBeVisible();
    await expect(dashboard.locator('[data-testid="kpi-blocked-dossiers"]')).toBeVisible();
    await expect(dashboard.locator('[data-testid="kpi-ready-delivery"]')).toBeVisible();
    await expect(dashboard.locator('[data-testid="kpi-ready-erp"]')).toBeVisible();
    await expect(dashboard.locator('[data-testid="kpi-pending-erp"]')).toBeVisible();

    for (const period of ["today", "week", "month", "all"]) {
      await humanClick(page, dashboard.locator(`[data-testid="dashboard-period-${period}"]`));
      await expect(dashboard.locator(`[data-testid="dashboard-period-${period}"]`)).toHaveAttribute("aria-pressed", "true");
    }

    await expect(dashboard.locator('[data-testid="dashboard-critical-alert"]').first()).toBeVisible();
    await expect(dashboard.locator('[data-testid^="dashboard-svg-"]')).toHaveCount(5);
    await expect(dashboard).toContainText("Prêt facturation ERP");
    await expect(dashboard).toContainText("En attente clôture ERP");

    const dashboardText = await dashboard.textContent();
    for (const pattern of [
      /chiffre d’affaires/i,
      /\bCA\b/,
      /paiement/i,
      /caisse/i,
      /stock pièces/i,
      /marge/i,
      /facture payée/i,
      /facturable/i,
      /rentabilité/i,
    ]) {
      expect(pattern.test(dashboardText ?? ""), `Terme interdit visible dans le dashboard: ${pattern}`).toBe(false);
    }

    await humanClick(page, dashboard.locator('[data-testid="dashboard-dossier-link-NIMR-DIR-KPI-BLOCK"]').first());
    await expect(page.locator("text=NIMR-DIR-KPI-BLOCK")).toBeVisible();
    await expect(page.locator("text=Retour à la liste des dossiers")).toBeVisible();
  });
});
