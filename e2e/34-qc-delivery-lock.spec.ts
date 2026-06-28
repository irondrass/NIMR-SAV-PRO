import { expect, Page, test } from "@playwright/test";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus } from "../src/types";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";

const doneTask = {
  id: "task-qc-lock-done",
  designation: "Contrôle final atelier",
  tempsEstime: 1,
  tempsPasse: 1,
  status: "done" as const,
  isEstimatedDurationValidated: true,
};

const openTask = {
  ...doneTask,
  id: "task-qc-lock-open",
  status: "in_progress" as const,
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
  dateValidation: "2026-06-24T09:00:00.000Z",
  validePar: "Contrôle Qualité",
};

async function seedDossiers(page: Page, dossiers: DossierSAV[]) {
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await page.goto("/");
  await page.evaluate(({ keys, dossiersValue }) => {
    localStorage.clear();
    localStorage.setItem(keys.dossiers, JSON.stringify(dossiersValue));
  }, { keys: STORAGE_KEYS, dossiersValue: dossiers });
  await page.reload();
}

function deliveryDossier(overrides: Partial<DossierSAV>): DossierSAV {
  return createMockDossier({
    id: "NIMR-QC-LOCK",
    clientNom: "Client QC Lock",
    vehiculeImmatriculation: "645 TU 6645",
    vehiculeVIN: "QCLOCKVIN00000001",
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [doneTask],
    checklistQC: qcValid,
    livraison: {
      controleQualiteOk: true,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-24T12:00:00.000Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false,
    },
    ...overrides,
  });
}

async function openDossierDeliveryTab(page: Page, dossierId: string) {
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanClick(page, page.locator(`[data-testid="dossier-card-${dossierId}"]`));
  await humanClick(page, page.locator('[data-testid="tab-deliveries"]'));
}

test.describe("Lot 6K-C - verrou QC avant restitution", () => {
  test("bloque la livraison si QC manquant", async ({ page }) => {
    const dossier = deliveryDossier({
      id: "NIMR-QC-MISSING",
      checklistQC: {
        ...qcValid,
        essaiEffectue: false,
        defautRepare: false,
        aucunVoyantAllume: false,
        niveauxVerifies: false,
        serrageSecurite: false,
        propreteVehicule: false,
        documentsPrets: false,
        photosApresOk: false,
        validationGlobale: "en_attente",
        dateValidation: undefined,
        validePar: undefined,
      },
      livraison: { ...deliveryDossier({}).livraison, controleQualiteOk: false },
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-livraison");
    await humanClick(page, page.locator('[data-testid="nav-livraison"]'));
    await humanClick(page, page.locator('[data-testid="delivery-dossier-row-NIMR-QC-MISSING"]'));

    await expect(page.locator('[data-testid="delivery-readiness-block"]')).toContainText("Restitution impossible");
    await expect(page.locator('[data-testid="delivery-blocked-message"]')).toContainText("contrôle qualité obligatoire");
    await expect(page.locator('[data-testid="btn-delivery-confirm"]')).toBeDisabled();
  });

  test("bloque la livraison si QC refusé", async ({ page }) => {
    const dossier = deliveryDossier({
      id: "NIMR-QC-REFUSED",
      statut: DossierStatus.EN_TRAVAUX,
      checklistQC: {
        ...qcValid,
        validationGlobale: "refuse",
        commentaireRefus: "Essai routier à reprendre.",
      },
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openDossierDeliveryTab(page, dossier.id);

    await expect(page.locator('[data-testid="delivery-readiness-block"]')).toContainText("Restitution impossible");
    await expect(page.locator('[data-testid="delivery-blocked-message"]')).toContainText("contrôle qualité refusé");
    await expect(page.locator('[data-testid="delivery-submit"]')).not.toBeVisible();
  });

  test("bloque la livraison si QC à refaire après modification atelier", async ({ page }) => {
    const dossier = deliveryDossier({
      id: "NIMR-QC-RECHECK",
      checklistQC: {
        ...qcValid,
        validationGlobale: "a_refaire",
        qcInvalidatedAt: "2026-06-24T10:00:00.000Z",
        qcInvalidatedReason: "Tâche atelier réouverte après QC.",
      },
      retourQualite: true,
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openDossierDeliveryTab(page, dossier.id);

    await expect(page.locator('[data-testid="delivery-qc-status"]').first()).toContainText("À refaire");
    await expect(page.locator('[data-testid="delivery-blocked-message"]').first()).toContainText("à refaire");
    await expect(page.locator('[data-testid="delivery-submit"]')).toBeDisabled();
  });

  test("bloque la livraison si des travaux atelier restent ouverts", async ({ page }) => {
    const dossier = deliveryDossier({
      id: "NIMR-QC-OPEN-TASK",
      statut: DossierStatus.EN_TRAVAUX,
      ordresReparation: [openTask],
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await openDossierDeliveryTab(page, dossier.id);

    await expect(page.locator('[data-testid="delivery-blocked-message"]').first()).toContainText("travaux atelier non terminés");
  });

  test("affiche prêt restitution si QC conforme et travaux terminés", async ({ page }) => {
    const dossier = deliveryDossier({ id: "NIMR-QC-READY" });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator('[data-testid="dossier-card-NIMR-QC-READY"]'));

    await expect(page.locator('[data-testid="dossier-delivery-state"]')).toContainText("Prêt restitution");
    await expect(page.locator('[data-testid="delivery-qc-status"]').first()).toContainText("Conforme");
    await expect(page.locator('[data-testid="delivery-blocked-message"]')).not.toBeVisible();
  });

  test("valide la restitution seulement quand le verrou est conforme", async ({ page }) => {
    const dossier = deliveryDossier({ id: "NIMR-QC-DELIVER" });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-livraison");
    await humanClick(page, page.locator('[data-testid="nav-livraison"]'));
    await humanClick(page, page.locator('[data-testid="delivery-dossier-row-NIMR-QC-DELIVER"]'));

    await expect(page.locator('[data-testid="btn-delivery-confirm"]')).not.toBeDisabled();
    await page.locator('[data-testid="delivery-check-qc"] input[type="checkbox"]').check();
    await page.locator('[data-testid="delivery-check-informed"] input[type="checkbox"]').check();
    await page.locator('[data-testid="delivery-check-reception"] input[type="checkbox"]').check();
    await page.locator('[data-testid="delivery-km-sortie"]').fill("10020");
    await humanClick(page, page.locator('[data-testid="btn-delivery-confirm"]'));
    await humanClick(page, page.locator('[data-testid="modal-delivery-confirm"]'));

    await expect(page.locator("text=Livraison confirmée pour le dossier NIMR-QC-DELIVER")).toBeVisible();
  });

  test("le bon restitution affiche un watermark si QC non conforme", async ({ page }) => {
    const dossier = deliveryDossier({
      id: "NIMR-QC-WATERMARK",
      checklistQC: { ...qcValid, validationGlobale: "a_refaire", qcInvalidatedReason: "Correction atelier après QC." },
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator('[data-testid="dossier-card-NIMR-QC-WATERMARK"]'));
    await humanClick(page, page.locator('[data-testid="tab-documents"]'));
    await humanClick(page, page.locator('[data-testid="print-delivery"]'));

    await expect(page.locator('[data-testid="delivery-invalid-watermark"]')).toContainText("NON VALIDE POUR RESTITUTION");
  });

  test("le rôle Livraison consulte QC mais ne voit pas les boutons QC", async ({ page }) => {
    const dossier = deliveryDossier({ id: "NIMR-QC-ROLE" });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-livraison");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator('[data-testid="dossier-card-NIMR-QC-ROLE"]'));
    await humanClick(page, page.locator('[data-testid="tab-quality-control"]'));

    await expect(page.locator('[data-testid="qc-status-badge"]')).toContainText("Conforme");
    await expect(page.locator('[data-testid="qc-accept"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="qc-refuse"]')).not.toBeVisible();
  });

  test("les boutons QC dédiés exposent les marqueurs de validation et refus", async ({ page }) => {
    const dossier = deliveryDossier({
      id: "NIMR-QC-BUTTONS",
      statut: DossierStatus.CONTROLE_QUALITE,
      checklistQC: { ...qcValid, validationGlobale: "en_attente", dateValidation: undefined, validePar: undefined },
    });
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-controle-qualite");
    await humanClick(page, page.locator('[data-testid="nav-controle-qualite"]'));
    await humanClick(page, page.locator('[data-testid="qc-dossier-row-NIMR-QC-BUTTONS"]'));

    await expect(page.locator('[data-testid="qc-approve-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="qc-refuse-button"]')).toBeVisible();
  });
});
