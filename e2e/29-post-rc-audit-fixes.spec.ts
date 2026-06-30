import { test, expect, Page } from "@playwright/test";
import { changeUserRole, humanClick, humanFill, humanSelect } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { PRE_IMPORT_BACKUP_KEY, STRONG_IMPORT_CONFIRMATION } from "../src/import-export-safety";
import { DossierStatus, InterventionType } from "../src/types";

const validDiagnostic = {
  cause: "Connecteur capteur roue arrière oxydé après contrôle visuel complet.",
  action: "Nettoyage connecteur, reprise du verrouillage et effacement défaut effectué.",
  validation: "Essai routier court validé sans voyant ni code défaut résiduel.",
};

async function seedDossiers(page: Page, dossiers: unknown[]) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEYS.dossiers, value: dossiers });
}

async function openDossierDetail(page: Page, dossierId: string) {
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanClick(page, page.locator(`text=${dossierId}`));
  await expect(page.locator('[data-testid="dossier-detail-view"]')).toBeVisible();
}

function readyForDeliveryDossier(id: string) {
  const base = createMockDossier({
    id,
    clientNom: "Client Restitution",
    statut: DossierStatus.PRET_A_LIVRER,
    vehiculeKilometrage: 42000,
    dateDernierStatut: "2020-01-01T08:00:00.000Z",
  });

  return {
    ...base,
    checklistQC: {
      ...base.checklistQC,
      essaiEffectue: true,
      defautRepare: true,
      aucunVoyantAllume: true,
      niveauxVerifies: true,
      serrageSecurite: true,
      propreteVehicule: true,
      documentsPrets: true,
      photosApresOk: true,
      validationGlobale: "valide" as const,
      dateValidation: "2020-01-01T07:30:00.000Z",
    },
    ordresReparation: [
      {
        id: "ro_ready_delivery",
        designation: "Contrôle final",
        tempsEstime: 1,
        tempsPasse: 1,
        status: "done" as const,
        diagnosticFinal: "Cause constatée: Défaut traité.\nAction réalisée: Contrôle complet.\nTest / validation finale: Conforme.",
      },
    ],
    livraison: {
      ...base.livraison,
      controleQualiteOk: false,
      clientInforme: false,
      confirmationReceptionClient: false,
      remarquesLivraison: "",
      signatureClientUri: undefined,
      kilometrageSortie: undefined,
    },
  };
}

test.describe("Lot 6F — Correctifs post-RC audit terrain", () => {
  test("DossierDetail refuse 'ok' et accepte un diagnostic structuré avant clôture", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-6F-DETAIL",
      clientNom: "Client Detail",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        { id: "ro_6f_detail", designation: "Diagnostic ABS", tempsEstime: 1.5, tempsPasse: 0.4, status: "in_progress" },
      ],
    });

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-directeur");
    await openDossierDetail(page, dossier.id);
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    await humanClick(page, page.locator('[data-testid="task-finish-ro_6f_detail"]'));
    await expect(page.locator('[data-testid="modal-detail-task-finish"]')).toBeVisible();
    await humanFill(page, page.locator('[data-testid="detail-task-finish-cause"]'), "ok");
    await expect(page.locator('[data-testid="detail-task-finish-confirm"]')).toBeDisabled();

    await humanFill(page, page.locator('[data-testid="detail-task-finish-cause"]'), validDiagnostic.cause);
    await humanFill(page, page.locator('[data-testid="detail-task-finish-action"]'), validDiagnostic.action);
    await humanFill(page, page.locator('[data-testid="detail-task-finish-validation"]'), validDiagnostic.validation);
    await expect(page.locator('[data-testid="detail-task-finish-confirm"]')).toBeEnabled();
    await humanClick(page, page.locator('[data-testid="detail-task-finish-confirm"]'));

    await expect(page.locator('[data-testid="task-status-ro_6f_detail"]')).toContainText(/terminé/i);
    await expect(page.locator('[data-testid="task-final-diagnostic-ro_6f_detail"]')).toContainText(/Cause constatée/i);
  });

  test("Blocage tâche exige motif/commentaire et remonte l'alerte attente pièce", async ({ page }) => {
    const dossier = createMockDossier({
      id: "NIMR-6F-BLOCK",
      clientNom: "Client Blocage",
      statut: DossierStatus.EN_TRAVAUX,
      technicienId: "tech_01",
      ordresReparation: [
        { id: "ro_6f_block", designation: "Remplacement module", tempsEstime: 2, tempsPasse: 0.5, status: "in_progress" },
      ],
    });

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-directeur");
    await openDossierDetail(page, dossier.id);
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    await humanClick(page, page.locator('[data-testid="task-block-ro_6f_block"]'));
    await expect(page.locator('[data-testid="modal-task-block-confirm"]')).toBeDisabled();
    await humanSelect(page, page.locator('[data-testid="modal-task-block-select"]'), "Attente pièce");
    await expect(page.locator('[data-testid="modal-task-block-confirm"]')).toBeDisabled();
    await humanFill(page, page.locator('[data-testid="modal-task-block-input"]'), "Pièce commandée, suivi réception nécessaire avant reprise atelier.");
    await humanFill(page, page.locator('[data-testid="block-spare-part-ref"]'), "CAP-ABS-6F");
    await humanSelect(page, page.locator('[data-testid="modal-task-block-owner"]'), "Réception");
    await expect(page.locator('[data-testid="modal-task-block-confirm"]')).toBeEnabled();
    await humanClick(page, page.locator('[data-testid="modal-task-block-confirm"]'));

    await expect(page.locator('[data-testid="task-status-ro_6f_block"]')).toContainText(/bloquée/i);
    await expect(page.locator('[data-testid="task-block-followup-ro_6f_block"]')).toContainText(/Réception/i);

    await humanClick(page, page.locator('[data-testid="nav-chef-atelier"]'));
    await expect(page.locator('[data-testid="alert-missing-pieces"]')).toContainText("NIMR-6F-BLOCK");
    await humanClick(page, page.locator('[data-testid="nav-reception"]'));
    await expect(page.locator('[data-testid="alert-missing-pieces"]')).toContainText("NIMR-6F-BLOCK");
  });

  test("Import/export JSON imposent confirmation forte et sauvegarde locale", async ({ page }) => {
    const originalDossier = createMockDossier({ id: "NIMR-6F-ORIG", clientNom: "Client Original" });
    const importedDossier = createMockDossier({ id: "NIMR-6F-IMPORT", clientNom: "Client Importé" });

    await seedDossiers(page, [originalDossier]);
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-settings"]'));

    await humanClick(page, page.locator('[data-testid="export-json"]'));
    await expect(page.locator('[data-testid="export-json-confirm-modal"]')).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await humanClick(page, page.locator('[data-testid="export-json-confirm"]'));
    await expect((await downloadPromise).suggestedFilename()).toContain("NIMR_SAV_PRO_BASE_BACKUP.json");

    await page.setInputFiles('[data-testid="import-json-input"]', {
      name: "lot-6f-valid-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ dossiers: [importedDossier] })),
    });
    await expect(page.locator('[data-testid="import-json-confirm-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-json-confirm"]')).toBeDisabled();
    await expect(page.locator('[data-testid="import-json-summary"]')).toContainText(/1 dossier/i);
    await expect(await page.evaluate((key) => Boolean(localStorage.getItem(key)), PRE_IMPORT_BACKUP_KEY)).toBe(true);

    await humanFill(page, page.locator('[data-testid="import-json-confirmation-input"]'), STRONG_IMPORT_CONFIRMATION);
    await expect(page.locator('[data-testid="import-json-confirm"]')).toBeEnabled();
    await humanClick(page, page.locator('[data-testid="import-json-confirm"]'));
    await expect(page.locator('[data-testid="import-success-message"]')).toBeVisible();

    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await expect(page.locator(`text=${importedDossier.id}`)).toBeVisible();
    await expect(page.locator(`text=${originalDossier.id}`)).not.toBeVisible();
  });

  test("Livraison réserve client exige un commentaire et affiche le statut sensible", async ({ page }) => {
    const dossier = readyForDeliveryDossier("NIMR-6F-DELIVERY");

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-livraison");
    await humanClick(page, page.locator('[data-testid="nav-livraison"]'));
    await humanClick(page, page.locator(`[data-testid="delivery-dossier-row-${dossier.id}"]`));

    await humanClick(page, page.locator('[data-testid="delivery-check-qc"]'));
    await humanClick(page, page.locator('[data-testid="delivery-check-informed"]'));
    await humanClick(page, page.locator('[data-testid="delivery-check-reception"]'));
    await humanFill(page, page.locator('[data-testid="delivery-km-sortie"]'), "42100");
    await humanClick(page, page.locator('[data-testid="delivery-status-reserve-client"]'));
    await humanClick(page, page.locator('[data-testid="btn-delivery-confirm"]'));
    await expect(page.locator('[data-testid="action-error-message"]')).toContainText(/commentaire obligatoire/i);

    await humanFill(page, page.locator('[data-testid="delivery-comment"]'), "Client signale une réserve sur un bruit à surveiller lors de la reprise.");
    await humanClick(page, page.locator('[data-testid="btn-delivery-confirm"]'));
    await humanClick(page, page.locator('[data-testid="modal-delivery-confirm"]'));

    await expect(page.locator(`[data-testid="delivery-history-status-${dossier.id}"]`)).toContainText("Réserve client");
  });

  test("Réception impose VIN garantie et bloque les dates futures hors PDI", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await changeUserRole(page, "role-option-receptionnaire");
    await humanClick(page, page.locator('[data-testid="nav-reception"]'));

    await humanFill(page, page.locator('[data-testid="reception-client-name"]'), "Client Garantie");
    await humanFill(page, page.locator('[data-testid="reception-client-phone"]'), "+216 20 000 123");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await humanFill(page, page.locator('[data-testid="reception-vehicle-model"]'), "T5 EVO");
    await humanFill(page, page.locator('[data-testid="reception-plate"]'), "123 TU 789");
    await humanFill(page, page.locator('[data-testid="reception-mileage"]'), "18000");
    await humanFill(page, page.locator('[data-testid="reception-delivery-date"]'), "2099-01-01");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await humanSelect(page, page.locator('[data-testid="reception-type"]'), InterventionType.GARANTIE_CONSTRUCTEUR);
    await humanFill(page, page.locator('[data-testid="reception-reason"]'), "Défaut garantie constructeur à diagnostiquer sur ouvrant de carrosserie.");
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await humanClick(page, page.locator('[data-testid="reception-submit"]'));

    await expect(page.locator('[data-testid="reception-error-message"]')).toContainText(/VIN obligatoire/i);

    await humanClick(page, page.locator('[data-testid="reception-previous"]'));
    await humanSelect(page, page.locator('[data-testid="reception-type"]'), InterventionType.PREPARATION_LIVRAISON);
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await humanClick(page, page.locator('[data-testid="reception-submit"]'));
    await expect(page.locator('[data-testid="reception-submit-modal"]')).toBeVisible();
  });

  test("Aging prêt à livrer est visible au dashboard directeur", async ({ page }) => {
    const dossier = readyForDeliveryDossier("NIMR-6F-AGING");

    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-dashboard"]'));

    await expect(page.locator('[data-testid="aging-alerts-dashboard"]')).toContainText("NIMR-6F-AGING");
    await expect(page.locator('[data-testid="aging-alerts-dashboard"]')).toContainText(/prêt à livrer/i);
  });
});
