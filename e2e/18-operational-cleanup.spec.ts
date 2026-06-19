import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus } from "../src/types";

test.describe("Lot 5F-1 - Nettoyage opérationnel atelier", () => {
  const techs = [
    createMockTech({ id: "tech_01", nom: "Technicien Démo" }),
  ];

  const dossiers = [
    createMockDossier({
      id: "NIMR-5F-PENDING",
      clientNom: "Client Pending",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      vehiculeImmatriculation: "888 TU 005",
      vehiculeVIN: "VIN5F888",
      ordresReparation: [
        { id: "task_pending_5f", designation: "Vidange à faire", tempsEstime: 1, tempsPasse: 0, status: "pending" },
      ],
    }),
    createMockDossier({
      id: "NIMR-5F-RUNNING",
      clientNom: "Client Running",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      vehiculeImmatriculation: "889 TU 005",
      vehiculeVIN: "VIN5F889",
      ordresReparation: [
        { id: "task_running_5f", designation: "Diagnostic en cours", tempsEstime: 2, tempsPasse: 1, status: "in_progress" },
      ],
    }),
    createMockDossier({
      id: "NIMR-5F-BLOCKED",
      clientNom: "Client Blocked",
      statut: DossierStatus.BLOQUE,
      technicienId: "tech_01",
      bloqueRaison: "Attente pièce atelier",
      vehiculeImmatriculation: "890 TU 005",
      vehiculeVIN: "VIN5F890",
      ordresReparation: [
        { id: "task_blocked_5f", designation: "Freinage bloqué", tempsEstime: 1, tempsPasse: 0, status: "blocked" },
      ],
    }),
    createMockDossier({
      id: "NIMR-5F-DONE",
      clientNom: "Client Done",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      vehiculeImmatriculation: "891 TU 005",
      vehiculeVIN: "VIN5F891",
      ordresReparation: [
        { id: "task_done_5f", designation: "Travail terminé", tempsEstime: 1, tempsPasse: 1, status: "done" },
      ],
    }),
    createMockDossier({
      id: "NIMR-5F-ERP",
      clientNom: "Client ERP",
      statut: DossierStatus.PRET_FACTURATION,
      technicienId: "tech_01",
      vehiculeImmatriculation: "888 TU 005",
      vehiculeVIN: "VIN5F888",
      ordresReparation: [
        { id: "task_erp_5f", designation: "Ancien travail ERP", tempsEstime: 1, tempsPasse: 0, status: "pending" },
      ],
    }),
    createMockDossier({
      id: "NIMR-5F-LIVRE",
      clientNom: "Client Livré",
      statut: DossierStatus.LIVRE,
      technicienId: "tech_01",
      vehiculeImmatriculation: "888 TU 005",
      vehiculeVIN: "VIN5F888",
      ordresReparation: [
        { id: "task_livre_5f", designation: "Ancien travail livré", tempsEstime: 1, tempsPasse: 1, status: "done" },
      ],
    }),
    createMockDossier({
      id: "NIMR-5F-CLOSED",
      clientNom: "Client Clôturé",
      statut: DossierStatus.CLOTURE,
      technicienId: "tech_01",
      vehiculeImmatriculation: "888 TU 005",
      vehiculeVIN: "VIN5F888",
      ordresReparation: [
        { id: "task_closed_5f", designation: "Ancien travail clôturé", tempsEstime: 1, tempsPasse: 1, status: "done" },
      ],
    }),
    createMockDossier({
      id: "NIMR-5F-READY",
      clientNom: "Client À livrer",
      statut: DossierStatus.PRET_A_LIVRER,
      vehiculeImmatriculation: "892 TU 005",
      vehiculeVIN: "VIN5F892",
      ordresReparation: [
        { id: "task_ready_5f", designation: "Préparation terminée", tempsEstime: 1, tempsPasse: 1, status: "done" },
      ],
    }),
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ keyDossiers, valDossiers, keyTechs, valTechs }) => {
      localStorage.clear();
      localStorage.setItem(keyDossiers, JSON.stringify(valDossiers));
      localStorage.setItem(keyTechs, JSON.stringify(valTechs));
    }, {
      keyDossiers: STORAGE_KEYS.dossiers,
      valDossiers: dossiers,
      keyTechs: STORAGE_KEYS.techs,
      valTechs: techs,
    });
    await page.reload();
  });

  test("Mode Technicien masque les dossiers terminés/ERP/livrés et garde les tâches utiles", async ({ page }) => {
    await changeUserRole(page, "role-option-technicien");
    await humanClick(page, page.locator('[data-testid="nav-technician"]'));

    await expect(page.locator("text=NIMR-5F-PENDING")).toBeVisible();
    await expect(page.locator('[data-testid="task-status-task_pending_5f"]')).toContainText(/en attente/i);
    await expect(page.locator("text=NIMR-5F-RUNNING")).toBeVisible();
    await expect(page.locator('[data-testid="task-status-task_running_5f"]')).toContainText(/en cours/i);
    await expect(page.locator("text=NIMR-5F-BLOCKED")).toBeVisible();
    await expect(page.locator('[data-testid="task-status-task_blocked_5f"]')).toContainText(/bloquée/i);

    await expect(page.locator("text=NIMR-5F-DONE")).toHaveCount(0);
    await expect(page.locator("text=NIMR-5F-ERP")).toHaveCount(0);
    await expect(page.locator("text=NIMR-5F-LIVRE")).toHaveCount(0);
    await expect(page.locator('[data-testid="task-status-task_done_5f"]')).toHaveCount(0);
  });

  test("Dossiers SAV Actifs exclut ERP/livrés et les filtres dédiés les retrouvent", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));

    await expect(page.locator("text=NIMR-5F-PENDING")).toBeVisible();
    await expect(page.locator("text=NIMR-5F-ERP")).toHaveCount(0);
    await expect(page.locator("text=NIMR-5F-LIVRE")).toHaveCount(0);

    await humanClick(page, page.locator('[data-testid="dossier-operational-filter-ready_for_billing"]'));
    await expect(page.locator("text=NIMR-5F-ERP")).toBeVisible();
    await expect(page.locator("text=NIMR-5F-PENDING")).toHaveCount(0);

    await humanClick(page, page.locator('[data-testid="dossier-operational-filter-delivered"]'));
    await expect(page.locator("text=NIMR-5F-LIVRE")).toBeVisible();
    await expect(page.locator("text=NIMR-5F-ERP")).toHaveCount(0);

    await humanClick(page, page.locator('[data-testid="dossier-operational-filter-all"]'));
    await expect(page.locator("text=NIMR-5F-PENDING")).toBeVisible();
    await expect(page.locator("text=NIMR-5F-ERP")).toBeVisible();
    await expect(page.locator("text=NIMR-5F-LIVRE")).toBeVisible();
  });

  test("Kanban Atelier reste limité à la production", async ({ page }) => {
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-kanban"]'));

    await expect(page.locator("text=NIMR-5F-RUNNING")).toBeVisible();
    await expect(page.locator("text=NIMR-5F-READY")).toBeVisible();
    await expect(page.locator("text=NIMR-5F-ERP")).toHaveCount(0);
    await expect(page.locator("text=NIMR-5F-LIVRE")).toHaveCount(0);
    await expect(page.locator("text=NIMR-5F-CLOSED")).toHaveCount(0);
  });

  test("Recherche véhicule conserve l'historique et distingue les statuts opérationnels", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator('[data-testid="dossier-mode-vehicles"]'));
    await humanFill(page, page.locator('[data-testid="vehicle-search-input"]'), "888 TU 005");

    const vehicleCard = page.locator('[data-testid="vehicle-card"]').filter({ hasText: "888 TU 005" }).first();
    const dossierRow = (id: string) => vehicleCard.locator("tr").filter({ hasText: id });

    await expect(vehicleCard.locator('[data-testid="vehicle-linked-dossier-id"]:has-text("NIMR-5F-PENDING")')).toBeVisible();
    await expect(vehicleCard.locator('[data-testid="vehicle-linked-dossier-id"]:has-text("NIMR-5F-ERP")')).toBeVisible();
    await expect(vehicleCard.locator('[data-testid="vehicle-linked-dossier-id"]:has-text("NIMR-5F-LIVRE")')).toBeVisible();
    await expect(vehicleCard.locator('[data-testid="vehicle-linked-dossier-id"]:has-text("NIMR-5F-CLOSED")')).toBeVisible();

    await expect(dossierRow("NIMR-5F-PENDING").locator('[data-testid="vehicle-linked-dossier-operational-badge"]')).toContainText("Actif");
    await expect(dossierRow("NIMR-5F-ERP").locator('[data-testid="vehicle-linked-dossier-operational-badge"]')).toContainText("Prêt facturation ERP");
    await expect(dossierRow("NIMR-5F-LIVRE").locator('[data-testid="vehicle-linked-dossier-operational-badge"]')).toContainText("Livré");
    await expect(dossierRow("NIMR-5F-CLOSED").locator('[data-testid="vehicle-linked-dossier-operational-badge"]')).toContainText("Clôturé");
  });
});
