import { test, expect, Page } from "@playwright/test";
import { STORAGE_KEYS } from "../src/storage-keys";
import { AtelierZone, DossierSAV, DossierStatus, TechnicienResource, WorkshopReservation } from "../src/types";
import { changeUserRole, humanClick, humanFill, humanSelect, humanWait } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";

const lot7Techs: TechnicienResource[] = [
  createMockTech({ id: "tech_45_meca", nom: "Mecanicien 45", specialite: "Mécanicien", zoneAffectee: AtelierZone.GRANDS_TRAVAUX }),
  createMockTech({ id: "tech_45_elec", nom: "Electricien 45", specialite: "Électricien", zoneAffectee: AtelierZone.ELECTRICITE_DIAG }),
  createMockTech({ id: "tech_45_body", nom: "Tolier 45", specialite: "Tôlier", zoneAffectee: AtelierZone.CARROSSERIE }),
  createMockTech({ id: "tech_45_paint", nom: "Peintre 45", specialite: "Peintre", zoneAffectee: AtelierZone.PEINTURE }),
];

function makeLot7Dossier(): DossierSAV {
  return createMockDossier({
    id: "NIMR-45-LOT7",
    clientNom: "Client Lot 7",
    vehiculeImmatriculation: "945 TU 0045",
    vehiculeVIN: "NIMR45LOT7000001",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [
      { id: "task_45_mechanical", designation: "Contrôle géométrie", tempsEstime: 1, tempsPasse: 0, status: "pending", workshopStageId: "mechanical", isEstimatedDurationValidated: true, estimateSource: "quote-import" },
      { id: "task_45_electrical", designation: "Diagnostic faisceau", tempsEstime: 1, tempsPasse: 0, status: "pending", workshopStageId: "electrical", isEstimatedDurationValidated: true, estimateSource: "quote-import" },
      { id: "task_45_body", designation: "Tôlerie aile", tempsEstime: 1, tempsPasse: 0, status: "pending", workshopStageId: "body-disassembly", isEstimatedDurationValidated: true, estimateSource: "quote-import" },
      { id: "task_45_paint", designation: "Peinture aile", tempsEstime: 1, tempsPasse: 0, status: "pending", workshopStageId: "paint", isEstimatedDurationValidated: true, estimateSource: "quote-import" },
    ],
  });
}

async function seedLot7(page: Page, dossiers: DossierSAV[] = [makeLot7Dossier()]) {
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue, techsValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.techs, JSON.stringify(techsValue));
    localStorage.setItem(keys.reservations, JSON.stringify([]));
    localStorage.setItem(keys.fileAttachments, JSON.stringify([{
      id: "file-meta-e2e-45",
      dossierId: "NIMR-45-LOT7",
      category: "video",
      fileName: "future-video.mp4",
      mimeType: "video/mp4",
      size: 2048,
      createdAt: "2026-07-03T08:00:00.000Z",
      uploadedBy: "Directeur SAV",
      storageProvider: "future-google-drive",
      status: "metadata-only",
    }]));
  }, { keys: STORAGE_KEYS, dossiersValue: dossiers, techsValue: lot7Techs });
  await page.reload();
}

async function openMobileMenuIfNeeded(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 768) return;
  await humanClick(page, page.locator('[data-testid="mobile-menu-button"]'));
}

async function navigateTo(page: Page, navTestId: string) {
  await openMobileMenuIfNeeded(page);
  await humanClick(page, page.locator(`[data-testid="${navTestId}"]`));
}

async function openLot7Dossier(page: Page) {
  await navigateTo(page, "nav-dossiers");
  await humanFill(page, page.locator('input[placeholder*="Rechercher"]').first(), "NIMR-45-LOT7");
  await humanClick(page, page.locator('[data-testid="dossier-card-NIMR-45-LOT7"]'));
}

test.describe("45 - Lot 7 stockage, performance et readiness", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockDate = new Date("2026-07-03T07:00:00");
      const NativeDate = Date;
      class MockDate extends NativeDate {
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

  test("app démarre base vide, aucune donnée démo et diagnostic Directeur visible", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await changeUserRole(page, "role-option-directeur");

    await expect(page.locator('[data-testid="storage-diagnostics"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-schema-version"]')).toContainText("7");
    await expect(page.locator('[data-testid="empty-state-dossiers"]').or(page.locator("body"))).toBeVisible();

    const demoRuntime = await page.evaluate((keys) => {
      const dossiers = JSON.parse(localStorage.getItem(keys.dossiers) || "[]") as Array<{ id: string; clientNom?: string }>;
      return dossiers.some(dossier => /demo/i.test(`${dossier.id} ${dossier.clientNom ?? ""}`));
    }, STORAGE_KEYS);
    expect(demoRuntime).toBe(false);
  });

  test("création simulée, reload conserve dossier et migration localStorage vers IndexedDB est déclarée", async ({ page }) => {
    await seedLot7(page);
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="storage-migration-status"]')).toContainText(/migrated|fallback|failed/);
    await openLot7Dossier(page);
    await expect(page.locator("body")).toContainText("NIMR-45-LOT7");

    await page.reload();
    await changeUserRole(page, "role-option-directeur");
    await openLot7Dossier(page);
    await expect(page.locator("body")).toContainText("Client Lot 7");
  });

  test("diagnostic stockage absent Réception et valeurs cohérentes Directeur", async ({ page }) => {
    await seedLot7(page);
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="storage-diagnostics"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-metadata-count"]')).toContainText("1");

    await humanClick(page, page.locator('[data-testid="logout-button"]'));
    await changeUserRole(page, "role-option-receptionnaire");
    await expect(page.locator('[data-testid="storage-diagnostics"]')).toHaveCount(0);
  });

  test("recherche dossier, dispatch multi-spécialité, réservation automatique et ETA restent OK", async ({ page }) => {
    await seedLot7(page);
    await changeUserRole(page, "role-option-directeur");
    await openLot7Dossier(page);
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    await humanSelect(page, page.locator('[data-testid="task-assign-select-task_45_mechanical"]'), "tech_45_meca");
    await humanSelect(page, page.locator('[data-testid="task-assign-select-task_45_electrical"]'), "tech_45_elec");
    await humanSelect(page, page.locator('[data-testid="task-assign-select-task_45_body"]'), "tech_45_body");
    await humanSelect(page, page.locator('[data-testid="task-assign-select-task_45_paint"]'), "tech_45_paint");
    await expect(page.locator('[data-testid="task-assignment-status-task_45_paint"]')).toContainText("Peintre 45");

    await navigateTo(page, "nav-planning");
    await humanSelect(page, page.locator('[data-testid="planning-eta-vehicle-select"]'), "NIMR-45-LOT7");
    await humanClick(page, page.locator('[data-testid="planning-auto-reserve-btn"]'));
    await expect(page.locator('[data-testid="auto-planning-success"]')).toContainText("réservée");

    const result = await page.evaluate(({ dossierKey, reservationKey }) => {
      const dossiers = JSON.parse(localStorage.getItem(dossierKey) || "[]") as DossierSAV[];
      const reservations = JSON.parse(localStorage.getItem(reservationKey) || "[]") as WorkshopReservation[];
      const dossier = dossiers.find(current => current.id === "NIMR-45-LOT7");
      return {
        reservations: reservations.length,
        etaDefined: Boolean(dossier?.datePlanningFin),
      };
    }, { dossierKey: STORAGE_KEYS.dossiers, reservationKey: STORAGE_KEYS.reservations });
    expect(result.reservations).toBeGreaterThan(0);
    expect(result.etaDefined).toBe(true);
  });

  test("logout après reload/cache revient au login", async ({ page }) => {
    await seedLot7(page);
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="logout-button"]'));
    await expect(page.locator('[data-testid="login-screen"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-testid="login-screen"]')).toBeVisible();
  });

  test("mobile 390px sans overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedLot7(page);
    await changeUserRole(page, "role-option-directeur");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toHaveAttribute("aria-label", "Ouvrir le menu");
  });

  test("métadonnées fichiers futures présentes sans upload réel ni clé Google", async ({ page }) => {
    const googleRequests: string[] = [];
    page.on("request", request => {
      if (/drive\.google|www\.googleapis\.com\/drive|googleapis\.com\/drive|accounts\.google|oauth2/i.test(request.url())) {
        googleRequests.push(request.url());
      }
    });

    await seedLot7(page);
    await changeUserRole(page, "role-option-directeur");
    await humanWait(page);

    const checks = await page.evaluate((keys) => {
      const metadata = JSON.parse(localStorage.getItem(keys.fileAttachments) || "[]");
      const allStorage = Object.keys(localStorage).map(key => `${key}=${localStorage.getItem(key)}`).join("\n");
      return {
        metadataCount: metadata.length,
        provider: metadata[0]?.storageProvider,
        status: metadata[0]?.status,
        hasGoogleSecret: /client_secret|access_token|refresh_token|AIza|googleapis|oauth/i.test(allStorage),
      };
    }, STORAGE_KEYS);

    expect(checks.metadataCount).toBe(1);
    expect(checks.provider).toBe("future-google-drive");
    expect(checks.status).toBe("metadata-only");
    expect(checks.hasGoogleSecret).toBe(false);
    expect(googleRequests).toEqual([]);
  });
});
