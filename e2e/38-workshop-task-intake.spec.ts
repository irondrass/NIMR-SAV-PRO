import { test, expect, Page } from "@playwright/test";
import { changeUserRole, humanClick, humanFill, humanSelect } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus, InterventionType } from "../src/types";

function fakeQuotePdfBuffer(): Buffer {
  return Buffer.from([
    "%PDF-1.4",
    "stream",
    "(DEVIS ATELIER FICTIF) Tj",
    "(Vidange huile moteur et filtre 1H) Tj",
    "(Diagnostic batterie 0,5H) Tj",
    "(Total HT 100) Tj",
    "(TVA 19) Tj",
    "endstream",
    "%%EOF",
  ].join("\n"), "utf8");
}

function closedAvailabilityConfig() {
  return {
    schedule: {
      days: [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({
        dayOfWeek,
        isClosed: true,
        windows: [],
      })),
    },
    exceptions: [],
    absences: [],
    bayUnavailabilities: [],
    holidays: [],
    shiftProfiles: [],
  };
}

async function seedStorage(page: Page, payload: {
  dossiers?: unknown[];
  vehicleMaster?: unknown[];
  reservations?: unknown[];
  availability?: unknown;
}) {
  await page.goto("/");
  await page.evaluate(({ keys, payload }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(payload.dossiers ?? []));
    localStorage.setItem(keys.reservations, JSON.stringify(payload.reservations ?? []));
    if (payload.vehicleMaster) {
      localStorage.setItem(keys.vehicleMaster, JSON.stringify(payload.vehicleMaster));
      localStorage.setItem(keys.vehicleMasterLastImport, new Date("2026-06-30T08:00:00.000Z").toISOString());
    }
    if (payload.availability) {
      localStorage.setItem(keys.availability, JSON.stringify(payload.availability));
    }
  }, { keys: STORAGE_KEYS, payload });
  await page.reload();
}

async function openDossierAsChef(page: Page, dossierId: string) {
  await changeUserRole(page, "role-option-chef-atelier");
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanClick(page, page.locator(`[data-testid="dossier-card-${dossierId}"]`));
}

test.describe("Lot 6K-F — tâches atelier depuis devis et réservation", () => {
  test("Réception depuis base véhicule Description crée un dossier sans tâches automatiques", async ({ page }) => {
    await seedStorage(page, {
      dossiers: [],
      vehicleMaster: [{
        id: "vm_desc_001",
        vin: "LDP43A961SS112183",
        plateNumber: "2318 TU 259",
        customerName: "Client Fictif",
        customerPhone: "+216 22 222 222",
        brand: "Dongfeng",
        description: "DONGFENG BOX EV 430",
        deliveryDate: "2026-03-04",
      }],
    });
    await changeUserRole(page, "role-option-receptionnaire");

    await humanClick(page, page.locator('[data-testid="nav-reception"]'));
    await humanFill(page, page.locator('[data-testid="vehicle-master-search-input"]'), "LDP43A961SS112183");
    await humanClick(page, page.locator('[data-testid="vehicle-use-btn-vm_desc_001"]'));

    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-vehicle-model"]')).toHaveValue("DONGFENG BOX EV 430");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await humanFill(page, page.locator('[data-testid="reception-reason"]'), "Contrôle atelier fictif depuis base véhicule");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await humanClick(page, page.locator('[data-testid="reception-submit"]'));
    await humanClick(page, page.locator('[data-testid="reception-submit-confirm"]'));

    await expect(page.getByText("Dossier créé avec succès")).toBeVisible();
    const created = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]")[0], STORAGE_KEYS.dossiers);
    expect(created.vehiculeModele).toBe("DONGFENG BOX EV 430");
    expect(created.ordresReparation).toHaveLength(0);
  });

  test("Chef Atelier crée une tâche, importe un devis PDF et réserve les premiers créneaux", async ({ page }) => {
    const dossierId = "NIMR-6KF-001";
    const dossier = createMockDossier({
      id: dossierId,
      statut: DossierStatus.EN_TRAVAUX,
      typeDossier: InterventionType.ENTRETIEN_RAPIDE,
      ordresReparation: [],
    });

    await seedStorage(page, { dossiers: [dossier], reservations: [] });
    await openDossierAsChef(page, dossierId);
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
    await expect(page.locator('[data-testid="workshop-task-card"]')).toHaveCount(0);

    await humanClick(page, page.locator('[data-testid="add-workshop-task-button"]'));
    await humanFill(page, page.locator('[data-testid="workshop-task-label"]'), "Vidange + filtre huile");
    await humanSelect(page, page.locator('[data-testid="workshop-task-stage"]'), "quick-service");
    await humanFill(page, page.locator('[data-testid="workshop-task-duration"]'), "1.5");
    await humanClick(page, page.locator('[data-testid="workshop-task-save"]'));
    await expect(page.locator('[data-testid="workshop-task-card"]').filter({ hasText: "Vidange + filtre huile" })).toHaveCount(1);

    await humanClick(page, page.locator('[data-testid="import-quote-pdf-button"]'));
    await page.locator('[data-testid="quote-pdf-input"]').setInputFiles({
      name: "devis-fictif.pdf",
      mimeType: "application/pdf",
      buffer: fakeQuotePdfBuffer(),
    });
    await expect(page.locator('[data-testid="quote-import-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="quote-detected-task"]').first()).toContainText(/Vidange|Diagnostic/i);
    await page.locator('[data-testid="quote-task-label"] input').nth(1).fill("Diagnostic batterie validé");
    await humanClick(page, page.locator('[data-testid="quote-import-confirm"]'));
    await expect(page.locator('[data-testid="quote-import-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="workshop-task-card"]').filter({ hasText: "Diagnostic batterie validé" })).toHaveCount(1);

    await humanClick(page, page.locator('[data-testid="tab-rdv-planning"]'));
    const quickRow = page.locator('[data-testid="workshop-stage-summary-row"]').filter({ hasText: "Vidange / entretien rapide" });
    await expect(quickRow.locator('[data-testid="workshop-stage-task-count"]')).toHaveText("2");
    await expect(quickRow.locator('[data-testid="workshop-stage-duration-total"]')).toContainText("2,5");

    await humanClick(page, page.locator('[data-testid="reserve-all-workshop-tasks"]'));
    await expect(page.locator('[data-testid="reservation-first-slot-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="reservation-technician-name"]')).not.toHaveText("");
    await expect(page.locator('[data-testid="reservation-bay-name"]')).not.toHaveText("");
    await expect(page.locator('[data-testid="reservation-start"]')).toContainText(/\d{2}:\d{2}/);

    const persisted = await page.evaluate(({ dossierKey, reservationKey, dossierId }) => {
      const dossiers = JSON.parse(localStorage.getItem(dossierKey) || "[]");
      const reservations = JSON.parse(localStorage.getItem(reservationKey) || "[]");
      return {
        dossier: dossiers.find((item: any) => item.id === dossierId),
        reservations,
      };
    }, { dossierKey: STORAGE_KEYS.dossiers, reservationKey: STORAGE_KEYS.reservations, dossierId });

    expect(persisted.dossier.ordresReparation.every((line: any) => line.planningStart && line.planningEnd)).toBe(true);
    expect(persisted.reservations.length).toBeGreaterThan(0);
  });

  test("Aucun créneau disponible affiche un message clair", async ({ page }) => {
    const dossierId = "NIMR-6KF-NOSLOT";
    const dossier = createMockDossier({
      id: dossierId,
      statut: DossierStatus.EN_TRAVAUX,
      ordresReparation: [{
        id: "ro_no_slot",
        designation: "Réparation mécanique fictive",
        tempsEstime: 1,
        tempsPasse: 0,
        status: "pending",
        estimateSource: "manual",
        isEstimatedDurationValidated: true,
        workshopStageId: "mechanical",
      }],
    });

    await seedStorage(page, {
      dossiers: [dossier],
      reservations: [],
      availability: closedAvailabilityConfig(),
    });
    await openDossierAsChef(page, dossierId);
    await humanClick(page, page.locator('[data-testid="tab-rdv-planning"]'));
    await humanClick(page, page.locator('[data-testid="reserve-all-workshop-tasks"]'));

    await expect(page.locator('[data-testid="reservation-error"]')).toContainText(/Aucun créneau|disponible|atelier/i);
    await expect(page.locator('[data-testid="reservation-first-slot-result"]')).not.toBeVisible();
  });
});
