import { test, expect, Page } from "@playwright/test";
import { changeUserRole, humanClick, humanFill } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierSAV, DossierStatus, InterventionType } from "../src/types";
import {
  CLIENT_SIDE_SECURITY_NOTICE,
  PILOT_SIGNATURE_NOTICE,
  WARRANTY_LOCAL_ATTACHMENT_NOTICE,
} from "../src/rc-notices";

async function seedDossiers(page: Page, dossiers: DossierSAV[]) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEYS.dossiers, value: dossiers });
}

async function drawSimpleSignature(page: Page) {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas signature introuvable");
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 55);
  await page.mouse.up();
}

function readyWithoutQcDossier(): DossierSAV {
  const base = createMockDossier({
    id: "NIMR-6I-NO-QC",
    clientNom: "Client Sans QC",
    statut: DossierStatus.PRET_A_LIVRER,
    vehiculeKilometrage: 18000,
  });
  return {
    ...base,
    checklistQC: {
      ...base.checklistQC,
      validationGlobale: "en_attente",
    },
    ordresReparation: [
      {
        id: "ro_6i_done",
        designation: "Contrôle final fictif",
        tempsEstime: 1,
        tempsPasse: 1,
        status: "done",
        diagnosticFinal: [
          "Cause constatée: Défaut traité sur dossier fictif pilote.",
          "Action réalisée: Contrôle SAV fictif terminé sans donnée réelle.",
          "Test / validation finale: Essai interne pilote conforme.",
        ].join("\n"),
      },
    ],
  };
}

function warrantyDossier(): DossierSAV {
  return createMockDossier({
    id: "NIMR-6I-WARRANTY",
    clientNom: "Client Garantie Pilote",
    typeDossier: InterventionType.GARANTIE_CONSTRUCTEUR,
    vehiculeVIN: "1HGCM82633A004352",
    statut: DossierStatus.VEHICULE_RECU,
  });
}

function deliveredDossier(): DossierSAV {
  const base = createMockDossier({
    id: "NIMR-6I-SAT",
    clientNom: "Client Satisfaction",
    statut: DossierStatus.LIVRE,
  });
  return {
    ...base,
    livraison: {
      ...base.livraison,
      controleQualiteOk: true,
      clientInforme: true,
      confirmationReceptionClient: true,
      dateLivraisonReelle: "2026-06-18T10:00:00.000Z",
      statutRestitution: "Livré sans réserve",
    },
  };
}

test.describe("Lot 6I — remédiations P0/P1 SAV", () => {
  test("Direction affiche la limite RC client-side sans promesse de sécurité console", async ({ page }) => {
    await seedDossiers(page, [warrantyDossier()]);
    await changeUserRole(page, "role-option-directeur");

    await expect(page.locator('[data-testid="director-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="client-side-security-notice"]')).toHaveText(CLIENT_SIDE_SECURITY_NOTICE);
    await expect(page.locator('[data-testid="nav-warranty"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-satisfaction"]')).toBeVisible();
  });

  test("Modules Garantie et Satisfaction restent locaux et visibles en pilote", async ({ page }) => {
    await seedDossiers(page, [warrantyDossier(), deliveredDossier()]);
    await changeUserRole(page, "role-option-directeur");

    await humanClick(page, page.locator('[data-testid="nav-warranty"]'));
    await expect(page.locator('[data-testid="warranty-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="warranty-local-attachment-notice"]')).toContainText(WARRANTY_LOCAL_ATTACHMENT_NOTICE);
    await expect(page.locator('[data-testid="warranty-dossier-NIMR-6I-WARRANTY"]')).toBeVisible();

    await humanClick(page, page.locator('[data-testid="nav-satisfaction"]'));
    await expect(page.locator('[data-testid="satisfaction-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="satisfaction-dossier-NIMR-6I-SAT"]')).toBeVisible();
    await humanFill(page, page.locator('[data-testid="satisfaction-comment"]'), "Retour pilote interne fictif, sans donnée réelle.");
    await humanClick(page, page.locator('[data-testid="satisfaction-save"]'));
    await expect(page.getByText(/Retour satisfaction pilote enregistré localement/i)).toBeVisible();
  });

  test("Livraison reste impossible sans QC validé malgré checklist locale cochée", async ({ page }) => {
    const dossier = readyWithoutQcDossier();
    await seedDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-livraison");

    await humanClick(page, page.locator('[data-testid="nav-livraison"]'));
    await humanClick(page, page.locator(`[data-testid="delivery-blocked-row-${dossier.id}"]`));
    await expect(page.locator('[data-testid="delivery-simple-signature-notice"]')).toContainText(PILOT_SIGNATURE_NOTICE);

    await humanClick(page, page.locator('[data-testid="delivery-check-qc"]'));
    await humanClick(page, page.locator('[data-testid="delivery-check-informed"]'));
    await humanClick(page, page.locator('[data-testid="delivery-check-reception"]'));
    await humanFill(page, page.locator('[data-testid="delivery-km-sortie"]'), "18010");
    await drawSimpleSignature(page);

    const confirmButton = page.locator('[data-testid="btn-delivery-confirm"]');
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeDisabled();

    const blockingMessage = page.locator(
      '[data-testid="delivery-blocked-message"], [data-testid="delivery-blocking-reasons"]'
    ).first();
    await expect(blockingMessage).toBeVisible();
    await expect(blockingMessage).toContainText(/qualité|QC|contrôle/i);
    await expect(page.locator('[data-testid="dossier-delivery-state"]')).not.toContainText(/livré|restitué/i);

    await expect(page.getByText(/Livraison confirmée pour le dossier NIMR-6I-NO-QC/i)).toHaveCount(0);
  });
});
