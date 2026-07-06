/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 43 — Terrain P0/P1 corrections
 * Corrections terrain priorité haute (P0/P1) identifiées lors de l'audit.
 * Données fictives uniquement.
 */

import { test, expect, Page } from "@playwright/test";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus } from "../src/types";
import {
  changeUserRole,
  humanClick,
  humanFill,
  humanWait,
} from "./helpers/human-actions";
import { createMockDossier, createWorkshopTechnicians } from "./helpers/test-data-creator";

// ──────────────────────────────────────────────────────────────────────────────
// Données fictives
// ──────────────────────────────────────────────────────────────────────────────

const openTask = {
  id: "task-terrain-open",
  designation: "Remplacement capteur ABS",
  tempsEstime: 2,
  tempsPasse: 0.5,
  status: "in_progress" as const,
  isEstimatedDurationValidated: true,
};

const doneTask = {
  id: "task-terrain-done",
  designation: "Contrôle freins",
  tempsEstime: 1,
  tempsPasse: 1,
  status: "done" as const,
  isEstimatedDurationValidated: true,
};

const qcPending = {
  essaiEffectue: false,
  defautRepare: false,
  aucunVoyantAllume: false,
  niveauxVerifies: false,
  serrageSecurite: false,
  propreteVehicule: false,
  documentsPrets: false,
  photosApresOk: false,
  validationGlobale: "en_attente" as const,
};

const qcValid = {
  essaiEffectue: true,
  defautRepare: true,
  aucunVoyantAllume: true,
  niveauxVerifies: true,
  serrageSecurite: true,
  propreteVehicule: true,
  documentsPrets: true,
  photosApresOk: true,
  validationGlobale: "valide" as const,
  dateValidation: "2026-07-01T09:00:00.000Z",
  validePar: "Contrôle Qualité",
};

const qcChecklistCompletePending = {
  ...qcValid,
  validationGlobale: "en_attente" as const,
  dateValidation: undefined,
  validePar: undefined,
};

function makeDossierWithOpenTasks(): DossierSAV {
  return createMockDossier({
    id: "NIMR-P0-QC-OPEN",
    clientNom: "Client P0 QC",
    vehiculeImmatriculation: "700 TU 4300",
    vehiculeVIN: "P0QCVINOPEN000001",
    statut: DossierStatus.CONTROLE_QUALITE,
    ordresReparation: [openTask, doneTask],
    checklistQC: qcChecklistCompletePending,
  });
}

function makeDossierReadyForDelivery(): DossierSAV {
  return createMockDossier({
    id: "NIMR-P0-DELIVERY-OK",
    clientNom: "Client Livraison OK",
    vehiculeImmatriculation: "701 TU 4301",
    vehiculeVIN: "P0DELIVERYOK00001",
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [doneTask],
    checklistQC: qcValid,
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-07-02T14:00:00.000Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false,
    },
  });
}

function makeDossierBlockedForDelivery(): DossierSAV {
  return createMockDossier({
    id: "NIMR-P0-DELIVERY-BLOCKED",
    clientNom: "Client Livraison Bloqué",
    vehiculeImmatriculation: "702 TU 4302",
    vehiculeVIN: "P0DELIVERYBLK0001",
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [openTask],
    checklistQC: qcValid,
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-07-02T14:00:00.000Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false,
    },
  });
}

function makeDossierQcRefusedForDelivery(): DossierSAV {
  return createMockDossier({
    id: "NIMR-P0-DELIVERY-QC-REFUSED",
    clientNom: "Client QC Refusé",
    vehiculeImmatriculation: "703 TU 4303",
    vehiculeVIN: "P0DELIVERYQCBLK01",
    statut: DossierStatus.NON_RETIRE,
    ordresReparation: [doneTask],
    checklistQC: {
      ...qcValid,
      validationGlobale: "refuse" as const,
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-07-02T14:00:00.000Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function seedDossiers(page: Page, dossiers: DossierSAV[]) {
  await page.goto("/");
  await page.evaluate(
    async ({ keys, dossiersValue, techniciansValue }) => {
      localStorage.clear();
      localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
      localStorage.setItem(keys.techs, JSON.stringify(techniciansValue));
      localStorage.setItem(keys.reservations, JSON.stringify([]));
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("nimr-sav-pro-local-db");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    },
    {
      keys: STORAGE_KEYS,
      dossiersValue: dossiers,
      techniciansValue: createWorkshopTechnicians(),
    }
  );
  await page.reload();
}

async function loginDirecteur(page: Page) {
  await changeUserRole(page, "role-option-directeur");
}

async function loginReception(page: Page) {
  await changeUserRole(page, "role-option-receptionnaire");
}

async function loginLivraison(page: Page) {
  await changeUserRole(page, "role-option-livraison");
}

function isMobileViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

async function openMobileMenuIfNeeded(page: Page) {
  if (!isMobileViewport(page)) return;
  const overlay = page.locator('[data-testid="mobile-menu-overlay"]');
  if (await overlay.isVisible().catch(() => false)) return;
  await humanClick(page, page.locator('[data-testid="mobile-menu-button"]'));
}

async function navigateTo(page: Page, navTestId: string) {
  await openMobileMenuIfNeeded(page);
  await humanClick(page, page.locator(`[data-testid="${navTestId}"]`));
}

async function clickLogout(page: Page) {
  await openMobileMenuIfNeeded(page);
  await humanClick(page, page.locator('[data-testid="logout-button"]'));
}

async function goToReceptionVehicleStep(page: Page) {
  await navigateTo(page, "nav-reception");
  await humanFill(page, page.locator('[data-testid="reception-client-name"]'), "Client Terrain 43");
  await humanFill(page, page.locator('[data-testid="reception-client-phone"]'), "55123456");
  await humanClick(page, page.locator('[data-testid="reception-next"]'));
  await expect(page.locator('[data-testid="reception-vin"]')).toBeVisible();
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

test.describe("43 — Terrain P0/P1 corrections", () => {

  // ─── 1. QC conforme bloqué avec tâches ouvertes ──────────────────────────

  test("QC conforme bloqué avec tâches ouvertes", async ({ page }) => {
    const dossier = makeDossierWithOpenTasks();
    await seedDossiers(page, [dossier]);
    await loginDirecteur(page);

    // Navigate to QC view
    await navigateTo(page, "nav-controle-qualite");
    await humanWait(page);

    // Open the dossier in QC
    const qcRow = page.locator(`[data-testid="qc-dossier-row-${dossier.id}"]`);
    if (await qcRow.isVisible()) {
      await humanClick(page, qcRow);
    } else {
      // Fallback: navigate via dossier list
      await navigateTo(page, "nav-dossiers");
      await humanClick(page, page.locator(`[data-testid="dossier-card-${dossier.id}"]`));
      await humanClick(page, page.locator('[data-testid="tab-quality-control"]'));
    }

    // Verify QC is blocked: button is disabled and warning is shown
    await expect(page.locator('[data-testid="btn-qc-validate"]')).toBeDisabled();
    await expect(page.locator('[data-testid="qc-blocked-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="qc-blocked-warning"]')).toContainText("Validation bloquée");
  });

  // ─── 2. Livraison ne liste pas un faux prêt ──────────────────────────────

  test("Livraison ne liste pas un dossier avec tâches ouvertes", async ({ page }) => {
    const blockedDossier = makeDossierBlockedForDelivery();
    const readyDossier = makeDossierReadyForDelivery();
    await seedDossiers(page, [blockedDossier, readyDossier]);
    await loginLivraison(page);

    await navigateTo(page, "nav-livraison");
    await humanWait(page);

    // The delivery dossier list should NOT show the blocked dossier
    const blockedRow = page.locator(
      `[data-testid="delivery-dossier-row-${blockedDossier.id}"]`
    );
    await expect(blockedRow).not.toBeVisible();

    // The ready dossier SHOULD be listed
    const readyRow = page.locator(
      `[data-testid="delivery-dossier-row-${readyDossier.id}"]`
    );
    await expect(readyRow).toBeVisible();
  });

  // ─── 3. Dossier bloqué visible dans Bloqués livraison ────────────────────

  test("Dossier bloqué visible dans la liste bloqués livraison", async ({ page }) => {
    const blockedDossier = makeDossierQcRefusedForDelivery();
    await seedDossiers(page, [blockedDossier]);
    await loginLivraison(page);

    await navigateTo(page, "nav-livraison");
    await humanWait(page);

    // The blocked list section should be visible
    const blockedList = page.locator('[data-testid="delivery-blocked-list"]');
    await expect(blockedList).toBeVisible();
  });

  // ─── 4. Création ressource atelier depuis base propre ────────────────────

  test("Création ressource atelier depuis base propre", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginDirecteur(page);

    await navigateTo(page, "nav-planning");
    await humanWait(page);

    // Empty resources warning should be visible
    const emptyWarning = page.locator('[data-testid="empty-resources-warning"]');
    await expect(emptyWarning).toBeVisible();

    // Fill resource name
    await humanFill(
      page,
      page.locator('[data-testid="resource-name"]'),
      "Technicien Terrain Test"
    );

    // Select resource specialty
    const specialtySelect = page.locator('[data-testid="resource-specialty"]');
    if (await specialtySelect.isVisible()) {
      await specialtySelect.selectOption({ index: 1 });
      await humanWait(page);
    }

    // Submit resource
    const submitBtn = page.locator('[data-testid="submit-resource-button"]');
    await expect(submitBtn).toBeVisible();
    await humanClick(page, submitBtn);
    await humanWait(page);

    // Warning should disappear after adding a resource
    await expect(emptyWarning).not.toBeVisible();
  });

  // ─── 5. Mobile 390px sans overflow horizontal ────────────────────────────

  test("Mobile 390px sans overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await changeUserRole(page, "role-option-directeur");

    // Check no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow, "Page has horizontal overflow at 390px").toBe(false);

    // Mobile menu button should be visible
    const mobileMenuBtn = page.locator('[data-testid="mobile-menu-button"]');
    await expect(mobileMenuBtn).toBeVisible();
  });

  // ─── 6. Menu mobile ouvrable/fermable ────────────────────────────────────

  test("Menu mobile ouvrable et fermable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await changeUserRole(page, "role-option-directeur");

    const mobileMenuBtn = page.locator('[data-testid="mobile-menu-button"]');
    await expect(mobileMenuBtn).toBeVisible();

    // Open mobile menu
    await humanClick(page, mobileMenuBtn);
    const overlay = page.locator('[data-testid="mobile-menu-overlay"]');
    await expect(overlay).toBeVisible();

    // Close by clicking overlay
    const viewport = page.viewportSize();
    await page.mouse.click(Math.max(1, (viewport?.width ?? 390) - 16), 200);
    await humanWait(page);
    await expect(overlay).not.toBeVisible();
  });

  // ─── 7. Logout puis login autre rôle ─────────────────────────────────────

  test("Logout puis login autre rôle", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Login as directeur
    await loginDirecteur(page);
    await expect(page.locator('[data-testid="current-role"]')).toHaveText(
      "Directeur SAV"
    );

    // Logout
    await clickLogout(page);

    // Verify login screen
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();

    // Login as réception
    await loginReception(page);
    await expect(page.locator('[data-testid="current-role"]')).toHaveText(
      "Réceptionnaire"
    );
  });

  // ─── 8. QC forfaitaire non créé comme tâche atelier ──────────────────────

  test("QC forfaitaire non créé comme tâche atelier", async ({ page }) => {
    const DEVIS_AVEC_QC_FORFAIT = `Désignation Qté Prix unitaire Montant
Vidange + filtre huile 1 33,000 33,000
Contrôle qualité forfaitaire 1 0,000 0,000
Remplacement plaquettes frein 2 45,000 90,000
Total DT 123,000`;

    const dossier = createMockDossier({
      id: "NIMR-P0-QC-FORFAIT",
      clientNom: "Client QC Forfait",
      vehiculeImmatriculation: "703 TU 4303",
      vehiculeVIN: "P0QCFORFAIT000001",
      statut: DossierStatus.VEHICULE_RECU,
      ordresReparation: [],
    });

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanWait(page);

    // Navigate to dossier repair orders
    await navigateTo(page, "nav-dossiers");
    await humanClick(page, page.locator(`[data-testid="dossier-card-${dossier.id}"]`));
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    // Import quote
    await humanClick(page, page.locator('[data-testid="quote-import-button"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).toBeVisible();

    await humanFill(
      page,
      page.locator('[data-testid="quote-text-input"]'),
      DEVIS_AVEC_QC_FORFAIT
    );
    await humanClick(page, page.locator('[data-testid="quote-import-analyze"]'));
    await humanWait(page, 500);

    await expect(page.locator('[data-testid="quote-preview-table"]')).toBeVisible({
      timeout: 7000,
    });

    // "Contrôle qualité forfaitaire" should NOT be a selectable labor line
    const laborRows = page.locator('[data-testid="quote-line-labor"]');
    const laborCount = await laborRows.count();
    for (let i = 0; i < laborCount; i++) {
      const text = await laborRows.nth(i).textContent();
      expect(
        text?.toLowerCase(),
        `Labor row ${i} should not contain QC forfait`
      ).not.toContain("contrôle qualité forfaitaire");
    }
  });

  // ─── 9. Messages livraison nombre/statut tâches bloquantes ───────────────

  test("Messages livraison affichent les tâches bloquantes", async ({ page }) => {
    const blockedDossier = makeDossierBlockedForDelivery();
    await seedDossiers(page, [blockedDossier]);
    await changeUserRole(page, "role-option-chef-atelier");

    await navigateTo(page, "nav-dossiers");
    await humanClick(
      page,
      page.locator(`[data-testid="dossier-card-${blockedDossier.id}"]`)
    );
    await humanClick(page, page.locator('[data-testid="tab-deliveries"]'));

    // Blocked reason detail should contain task count info
    const blockedDetail = page.locator('[data-testid="blocked-reason-detail"]').or(
      page.locator('[data-testid="delivery-blocked-message"]')
    );
    await expect(blockedDetail.first()).toBeVisible();
    await expect(blockedDetail.first()).toContainText(
      /tâche|travaux|non terminé|bloqué/i
    );
  });

  // ─── 10. Aucun placeholder DEMO VIN ──────────────────────────────────────

  test("Aucun placeholder DEMO dans le champ VIN réception", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginReception(page);

    await goToReceptionVehicleStep(page);

    const vinInput = page.locator('[data-testid="reception-vin"]');
    if (await vinInput.isVisible()) {
      const placeholder = await vinInput.getAttribute("placeholder");
      expect(
        placeholder?.toUpperCase() ?? "",
        'Le placeholder VIN ne doit pas contenir "DEMO"'
      ).not.toContain("DEMO");
    }
  });

  // ─── 11. Kilométrage non prérempli à 15000 ──────────────────────────────

  test("Kilométrage non prérempli à 15000", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginReception(page);

    await goToReceptionVehicleStep(page);

    const mileageInput = page.locator('[data-testid="reception-mileage"]');
    if (await mileageInput.isVisible()) {
      const value = await mileageInput.inputValue();
      expect(
        value,
        "Le champ kilométrage doit être vide par défaut"
      ).toBe("");
    }
  });

  // ─── 12. Kilométrage vide bloque l'étape ─────────────────────────────────

  test("Kilométrage vide bloque l'étape de réception", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginReception(page);

    await goToReceptionVehicleStep(page);

    // Fill minimum required fields but leave mileage empty
    await humanFill(page, page.locator('[data-testid="reception-vehicle-model"]'), "T5 EVO");
    await humanFill(page, page.locator('[data-testid="reception-plate"]'), "700 TU 4300");
    await humanFill(page, page.locator('[data-testid="reception-vin"]'), "L1234567890123456");

    // Leave mileage empty, try to advance
    const submitBtn = page.locator(
      '[data-testid="reception-submit"], [data-testid="reception-next"]'
    ).first();
    if (await submitBtn.isVisible()) {
      await humanClick(page, submitBtn);
      await humanWait(page);

      // Expect mileage validation error
      await expect(page.locator("body")).toContainText(
        /kilométrage.*obligatoire|Le kilométrage est obligatoire/i
      );
    }
  });
});
