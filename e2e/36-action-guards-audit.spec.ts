import { expect, Page, test } from "@playwright/test";
import { MOCK_TECHNICIENS } from "../src/data";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus, WorkshopReservation } from "../src/types";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";

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
  dateValidation: "2026-06-29T09:00:00.000Z",
  validePar: "Contrôle Qualité",
};

const doneTask = {
  id: "ro-guard-done",
  designation: "Contrôle final",
  tempsEstime: 1,
  tempsPasse: 1,
  status: "done" as const,
  isEstimatedDurationValidated: true,
};

async function seedApp(page: Page, dossiers: DossierSAV[], reservations: WorkshopReservation[] = []) {
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue, reservationsValue, techsValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
    localStorage.setItem(keys.reservations, JSON.stringify(reservationsValue));
    localStorage.setItem(keys.techs, JSON.stringify(techsValue));
  }, {
    keys: STORAGE_KEYS,
    dossiersValue: dossiers,
    reservationsValue: reservations,
    techsValue: MOCK_TECHNICIENS,
  });
  await page.reload();
}

function readyDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return createMockDossier({
    id: "NIMR-GUARD-READY",
    clientNom: "Client Guard",
    vehiculeImmatriculation: "610 TU 6100",
    vehiculeVIN: "GUARDREADY0000001",
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [doneTask],
    checklistQC: qcValid,
    livraison: {
      controleQualiteOk: true,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-29T12:00:00.000Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false,
    },
    ...overrides,
  });
}

function planningDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return createMockDossier({
    id: "NIMR-GUARD-PLAN",
    clientNom: "Client Planning",
    vehiculeImmatriculation: "620 TU 6200",
    vehiculeVIN: "GUARDPLAN0000001",
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [{
      id: "ro-guard-plan",
      designation: "Diagnostic garde",
      tempsEstime: 1,
      tempsPasse: 0,
      status: "pending",
      isEstimatedDurationValidated: true,
    }],
    ...overrides,
  });
}

async function fillReceptionMinimum(page: Page) {
  await humanClick(page, page.locator('[data-testid="nav-reception"]'));
  await humanClick(page, page.locator('[data-testid="preset-client-0"]'));
  await humanClick(page, page.locator('[data-testid="reception-next"]'));
  await humanClick(page, page.locator('[data-testid="preset-model-glory-500"]'));
  await humanClick(page, page.locator('[data-testid="preset-color-gris"]'));
  await humanFill(page, page.locator('[data-testid="reception-plate"]'), "636 TU 3636");
  await humanFill(page, page.locator('[data-testid="reception-vin"]'), "1HGCM82633A004352");
  await humanFill(page, page.locator('[data-testid="reception-mileage"]'), "12500");
  await humanClick(page, page.locator('[data-testid="reception-next"]'));
  await humanClick(page, page.locator('[data-testid="preset-complaint-entretien"]'));
  await humanClick(page, page.locator('[data-testid="reception-next"]'));
  await humanClick(page, page.locator('[data-testid="preset-fuel-75"]'));
}

async function openDeliveryConfirmation(page: Page, dossierId: string) {
  await humanClick(page, page.locator('[data-testid="nav-livraison"]'));
  await humanClick(page, page.locator(`[data-testid="delivery-dossier-row-${dossierId}"]`));
  await page.locator('[data-testid="delivery-check-qc"] input[type="checkbox"]').check();
  await page.locator('[data-testid="delivery-check-informed"] input[type="checkbox"]').check();
  await page.locator('[data-testid="delivery-check-reception"] input[type="checkbox"]').check();
  await page.locator('[data-testid="delivery-km-sortie"]').fill("10020");
  await humanClick(page, page.locator('[data-testid="btn-delivery-confirm"]'));
  await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible();
}

async function getAuditEntries(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), STORAGE_KEYS.auditLog);
}

test.describe("Lot 6K-E - action guards, modales et audit local", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", async dialog => {
      throw new Error(`Boîte native interdite: ${dialog.type()}`);
    });
    await page.addInitScript(() => {
      const mockDate = new Date("2026-06-29T07:00:00");
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

  test("1. Double clic création dossier ne crée pas deux dossiers", async ({ page }) => {
    await seedApp(page, []);
    await changeUserRole(page, "role-option-receptionnaire");
    await fillReceptionMinimum(page);
    await humanClick(page, page.locator('[data-testid="reception-submit"]'));
    await expect(page.locator('[data-testid="reception-submit-modal"]')).toBeVisible();

    await page.locator('[data-testid="reception-submit-confirm"]').evaluate((element: HTMLElement) => {
      element.click();
      element.click();
    });

    await expect(page.locator('[data-testid="reception-start"]')).toContainText("Dossier créé");
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]") as DossierSAV[], STORAGE_KEYS.dossiers);
    expect(stored).toHaveLength(1);
  });

  test("2. Double clic réservation planning ne crée pas deux réservations", async ({ page }) => {
    const dossier = planningDossier();
    await seedApp(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await page.locator('[data-testid="planning-suggest-dossier"]').selectOption(`${dossier.id}::ro-guard-plan`);
    await humanClick(page, page.locator('[data-testid="planning-suggest-submit"]'));
    await expect(page.locator('[data-testid="planning-suggest-result"]')).toBeVisible();

    await page.locator('[data-testid="planning-suggest-apply"]').evaluate((element: HTMLElement) => {
      element.click();
      element.click();
    });

    await expect(page.locator('[data-testid="planning-suggest-feedback"]')).toContainText("Créneau réservé avec succès.");
    const reservations = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]") as WorkshopReservation[], STORAGE_KEYS.reservations);
    expect(reservations.filter(res => res.taskIds.includes("ro-guard-plan"))).toHaveLength(1);
  });

  test("3. Double clic validation QC ne crée pas deux validations", async ({ page }) => {
    const dossier = readyDossier({
      id: "NIMR-GUARD-QC",
      statut: DossierStatus.CONTROLE_QUALITE,
      checklistQC: { ...qcValid, validationGlobale: "en_attente", dateValidation: undefined, validePar: undefined },
    });
    await seedApp(page, [dossier]);
    await changeUserRole(page, "role-option-controle-qualite");
    await humanClick(page, page.locator('[data-testid="nav-controle-qualite"]'));
    await humanClick(page, page.locator('[data-testid="qc-dossier-row-NIMR-GUARD-QC"]'));
    for (const testId of ["qc-check-essai", "qc-check-defaut", "qc-check-voyants", "qc-check-niveaux", "qc-check-serrage", "qc-check-proprete", "qc-check-docs", "qc-check-photos"]) {
      await page.locator(`[data-testid="${testId}"] input[type="checkbox"]`).check();
    }
    await humanClick(page, page.locator('[data-testid="btn-qc-validate"]'));
    await expect(page.locator('[data-testid="modal-qc-validate"]')).toBeVisible();
    await page.locator('[data-testid="modal-qc-validate-confirm"]').evaluate((element: HTMLElement) => {
      element.click();
      element.click();
    });

    await expect(page.locator("text=Contrôle qualité validé pour le dossier NIMR-GUARD-QC")).toBeVisible();
    const entries = await getAuditEntries(page);
    expect(entries.filter((entry: any) => entry.action === "validation_qc" && entry.dossierId === "NIMR-GUARD-QC")).toHaveLength(1);
  });

  test("4. Livraison bloquée affiche un message clair et journalise la tentative", async ({ page }) => {
    const dossier = readyDossier({
      id: "NIMR-GUARD-BLOCKED",
      checklistQC: { ...qcValid, validationGlobale: "en_attente", dateValidation: undefined, validePar: undefined },
    });
    await seedApp(page, [dossier]);
    await changeUserRole(page, "role-option-livraison");
    await humanClick(page, page.locator('[data-testid="nav-livraison"]'));
    await humanClick(page, page.locator('[data-testid="delivery-dossier-row-NIMR-GUARD-BLOCKED"]'));

    await expect(page.locator('[data-testid="delivery-blocked-message"]')).toContainText("contrôle qualité obligatoire");
    const entries = await getAuditEntries(page);
    expect(entries.some((entry: any) =>
      entry.action === "tentative_livraison_bloquee" &&
      entry.dossierId === "NIMR-GUARD-BLOCKED" &&
      entry.result === "blocked"
    )).toBe(true);
  });

  test("5. Modification atelier après QC invalide QC et ajoute audit trail", async ({ page }) => {
    const dossier = readyDossier({ id: "NIMR-GUARD-RECHECK" });
    await seedApp(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator('[data-testid="dossier-card-NIMR-GUARD-RECHECK"]'));
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
    await humanClick(page, page.locator('[data-testid="task-reopen-ro-guard-done"]'));
    await page.locator('[data-testid="modal-task-reopen-select"]').selectOption("Complément de travaux requis");
    await humanClick(page, page.locator('[data-testid="modal-task-reopen-confirm"]'));

    await expect(page.locator('[data-testid="action-success-message"]')).toContainText("contrôle qualité doit être refait");
    await expect(page.locator('[data-testid="audit-trail-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="audit-trail-entry"]').first()).toContainText("contrôle qualité doit être refait");
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]") as DossierSAV[], STORAGE_KEYS.dossiers);
    expect(stored.find(item => item.id === "NIMR-GUARD-RECHECK")?.checklistQC.validationGlobale).toBe("a_refaire");
  });

  test("6. Rôle lecture seule ne peut pas déclencher action métier", async ({ page }) => {
    await seedApp(page, [planningDossier({ id: "NIMR-GUARD-READONLY" })]);
    await changeUserRole(page, "role-option-lecture-seule");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator('[data-testid="dossier-card-NIMR-GUARD-READONLY"]'));
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    await expect(page.locator('[data-testid^="task-start-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="new-task-submit"]')).toHaveCount(0);
    const businessEntries = (await getAuditEntries(page)).filter((entry: any) => entry.module !== "auth");
    expect(businessEntries).toHaveLength(0);
  });

  test("7. ConfirmModal apparaît pour une action sensible", async ({ page }) => {
    await seedApp(page, [readyDossier()]);
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-settings"]'));
    await humanClick(page, page.locator('[data-testid="export-json"]'));

    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-modal-title"]')).toContainText(/export JSON/i);
  });

  test("8. Annuler dans ConfirmModal ne modifie rien", async ({ page }) => {
    const dossier = readyDossier({ id: "NIMR-GUARD-CANCEL" });
    await seedApp(page, [dossier]);
    await changeUserRole(page, "role-option-livraison");
    await openDeliveryConfirmation(page, dossier.id);
    await humanClick(page, page.locator('[data-testid="confirm-modal-cancel"]'));
    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]") as DossierSAV[], STORAGE_KEYS.dossiers);
    expect(stored.find(item => item.id === dossier.id)?.statut).toBe(DossierStatus.PRET_A_LIVRER);
  });

  test("9. Confirmer dans ConfirmModal exécute une seule fois", async ({ page }) => {
    const dossier = readyDossier({ id: "NIMR-GUARD-DELIVER" });
    await seedApp(page, [dossier]);
    await changeUserRole(page, "role-option-livraison");
    await openDeliveryConfirmation(page, dossier.id);
    await page.locator('[data-testid="modal-delivery-confirm"]').evaluate((element: HTMLElement) => {
      element.click();
      element.click();
    });

    await expect(page.locator("text=Livraison confirmée pour le dossier NIMR-GUARD-DELIVER")).toBeVisible();
    const entries = await getAuditEntries(page);
    expect(entries.filter((entry: any) => entry.action === "livraison_reussie" && entry.dossierId === dossier.id)).toHaveLength(1);
  });

  test("10. Mobile/tablette : modales restent utilisables", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, [readyDossier()]);
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-settings"]'));
    await humanClick(page, page.locator('[data-testid="export-json"]'));

    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-modal-confirm"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="confirm-modal-cancel"]'));
    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0);
  });
});
