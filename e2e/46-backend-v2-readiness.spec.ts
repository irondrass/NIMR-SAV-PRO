import { test, expect, Page } from "@playwright/test";
import { STORAGE_KEYS } from "../src/storage-keys";
import { AtelierZone, DossierSAV, DossierStatus, TechnicienResource } from "../src/types";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";

const backendV2Techs: TechnicienResource[] = [
  createMockTech({ id: "tech_46_meca", nom: "Mecanicien 46", specialite: "Mécanicien", zoneAffectee: AtelierZone.GRANDS_TRAVAUX }),
  createMockTech({ id: "tech_46_elec", nom: "Electricien 46", specialite: "Électricien", zoneAffectee: AtelierZone.ELECTRICITE_DIAG }),
];

function makeBackendV2Dossier(): DossierSAV {
  return createMockDossier({
    id: "NIMR-46-BACKEND",
    clientNom: "Client Backend 46",
    vehiculeImmatriculation: "946 TU 0046",
    vehiculeVIN: "NIMR46BACKEND0001",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [
      { id: "task_46_meca", designation: "Diagnostic mécanique", tempsEstime: 1, tempsPasse: 0, status: "pending", workshopStageId: "mechanical", isEstimatedDurationValidated: true, estimateSource: "manual" },
      { id: "task_46_elec", designation: "Contrôle faisceau", tempsEstime: 1, tempsPasse: 0, status: "pending", workshopStageId: "electrical", isEstimatedDurationValidated: true, estimateSource: "manual" },
    ],
  });
}

async function seedBackendV2(page: Page) {
  await page.goto("/");
  await page.evaluate(({ keys, dossier, techs }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify([dossier]));
    localStorage.setItem(keys.techs, JSON.stringify(techs));
    localStorage.setItem(keys.reservations, JSON.stringify([]));
    localStorage.setItem(keys.fileAttachments, JSON.stringify([{
      id: "file-meta-e2e-46",
      dossierId: "NIMR-46-BACKEND",
      category: "video",
      fileName: "backend-v2-video.mp4",
      mimeType: "video/mp4",
      size: 4096,
      createdAt: "2026-07-04T08:00:00.000Z",
      uploadedBy: "Directeur SAV",
      storageProvider: "future-google-drive",
      status: "metadata-only",
    }]));
  }, { keys: STORAGE_KEYS, dossier: makeBackendV2Dossier(), techs: backendV2Techs });
  await page.reload();
}

async function openBackendDossier(page: Page) {
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanFill(page, page.locator('input[placeholder*="Rechercher"]').first(), "NIMR-46-BACKEND");
  await humanClick(page, page.locator('[data-testid="dossier-card-NIMR-46-BACKEND"]'));
}

test.describe("46 - Backend v2 readiness local-only", () => {
  test("app démarre sans variables Supabase et sans appels backend externes", async ({ page }) => {
    const forbiddenRequests: string[] = [];
    page.on("request", request => {
      const url = request.url();
      if (/supabase|www\.googleapis\.com\/drive|googleapis\.com\/drive|drive\.google|accounts\.google|oauth2/i.test(url)) {
        forbiddenRequests.push(url);
      }
    });

    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await changeUserRole(page, "role-option-directeur");

    await expect(page.locator('[data-testid="storage-diagnostics"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-user-role"]')).toHaveText("Directeur SAV");
    expect(forbiddenRequests).toEqual([]);
  });

  test("login/logout local reste solide après reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await changeUserRole(page, "role-option-receptionnaire");
    await expect(page.locator('[data-testid="current-user-role"]')).toHaveText("Réceptionnaire");

    await humanClick(page, page.locator('[data-testid="logout-button"]'));
    await expect(page.locator('[data-testid="login-screen"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-testid="login-screen"]')).toBeVisible();
  });

  test("dossier local persiste au reload et diagnostic stockage reste opérationnel", async ({ page }) => {
    await seedBackendV2(page);
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="file-metadata-count"]')).toContainText("1");

    await openBackendDossier(page);
    await expect(page.locator("body")).toContainText("Client Backend 46");

    await page.reload();
    await changeUserRole(page, "role-option-directeur");
    await openBackendDossier(page);
    await expect(page.locator("body")).toContainText("NIMR-46-BACKEND");
  });

  test("écran fichiers affiche metadata-only et téléchargement désactivé sans backend", async ({ page }) => {
    const forbiddenRequests: string[] = [];
    page.on("request", request => {
      const url = request.url();
      if (/supabase|www\.googleapis\.com\/drive|googleapis\.com\/drive|drive\.google|accounts\.google|oauth2/i.test(url)) {
        forbiddenRequests.push(url);
      }
    });

    await seedBackendV2(page);
    await changeUserRole(page, "role-option-directeur");
    await openBackendDossier(page);
    await humanClick(page, page.locator('[data-testid="tab-photos"]'));

    await expect(page.locator('[data-testid="secure-file-metadata-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="secure-file-row-file-meta-e2e-46"]')).toContainText("backend-v2-video.mp4");
    await expect(page.locator('[data-testid="secure-file-download-notice"]')).toContainText("Téléchargement disponible après activation Backend v2.0 / Google Drive sécurisé.");
    await expect(page.locator('[data-testid="secure-file-download-file-meta-e2e-46"]')).toBeDisabled();
    expect(forbiddenRequests).toEqual([]);
  });

  test("mobile 390px reste sans overflow avec metadata sécurisée", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedBackendV2(page);
    await changeUserRole(page, "role-option-directeur");
    await openBackendDossier(page);
    await humanClick(page, page.locator('[data-testid="tab-photos"]'));

    await expect(page.locator('[data-testid="mobile-menu-button"]')).toHaveAttribute("aria-label", "Ouvrir le menu");
    await expect(page.locator('[data-testid="secure-file-metadata-panel"]')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
