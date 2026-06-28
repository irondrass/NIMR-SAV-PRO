import { expect, Page, test } from "@playwright/test";
import { DossierPriority, DossierSAV, DossierStatus, InterventionType } from "../src/types";
import { STORAGE_KEYS } from "../src/storage-keys";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";

const TECH_ID = "tech_print_a4";
const TECH_NAME = "Technicien Print A4";
const PRINT_NOW = "2026-06-28T08:30:00.000Z";

const doneTask = {
  id: "ro_print_a4",
  designation: "Contrôle vibration train avant",
  tempsEstime: 1.5,
  tempsPasse: 1.2,
  status: "done" as const,
  diagnosticFinal: "Cause constatée : silentbloc desserré.\nAction réalisée : resserrage contrôlé.\nTest / validation finale : essai routier conforme.",
  plannedTechnicianId: TECH_ID,
  plannedBayId: "bay_1",
  planningStart: "2026-06-28T09:00:00.000Z",
  planningEnd: "2026-06-28T10:30:00.000Z",
  isEstimatedDurationValidated: true,
  durationValidationReason: "Durée validée par chef atelier pour pilote.",
  chefNotes: "Contrôler train avant et essai final.",
};

function buildReadyDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  return createMockDossier({
    id: "NIMR-PRINT-A4",
    clientNom: "Client Pilote Print",
    clientTelephone: "+216 55 111 222",
    deposantNom: "Client Pilote Print",
    deposantTelephone: "+216 55 111 222",
    vehiculeMarque: "Forthing",
    vehiculeModele: "T5 EVO Hybride",
    vehiculeImmatriculation: "123 TU 6789",
    vehiculeVIN: "LJ4A1234567890123",
    vehiculeKilometrage: 12500,
    vehiculeCouleur: "Gris",
    vehiculeVersion: "HEV",
    typeDossier: InterventionType.MECANIQUE_GENERALE,
    priorite: DossierPriority.URGENTE,
    plainteClient: "Vibration ressentie au freinage sur route rapide.",
    observationsReception: "Essai réception confirme une vibration légère.",
    photosAvant: [{
      id: "photo_print_a4",
      url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      title: "Réception avant",
      date: PRINT_NOW,
      takenBy: "Réception",
      category: "réception avant",
    }],
    objetsLaisses: ["Carnet entretien pilote"],
    dateReception: PRINT_NOW,
    dateSouhaiteeLivraison: "2026-06-28T16:30:00.000Z",
    statut: DossierStatus.PRET_A_LIVRER,
    ordresReparation: [doneTask],
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
      dateValidation: "2026-06-28T14:45:00.000Z",
      validePar: "Contrôleur QC",
    },
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-06-28T16:30:00.000Z",
      dateLivraisonReelle: "2026-06-28T16:10:00.000Z",
      remarquesLivraison: "Restitution pilote sans réserve.",
      statutRestitution: "Livré sans réserve",
      confirmationReceptionClient: true,
      clotureInterne: false,
      kilometrageSortie: 12518,
    },
    prochaineActionRecommended: "Restitution client après QC conforme.",
    avancementGlobal: 95,
    ...overrides,
  });
}

function buildRefusedDossier(): DossierSAV {
  return buildReadyDossier({
    id: "NIMR-PRINT-QC-BLOCK",
    statut: DossierStatus.CONTROLE_QUALITE,
    retourQualite: true,
    checklistQC: {
      essaiEffectue: false,
      defautRepare: true,
      aucunVoyantAllume: true,
      niveauxVerifies: true,
      serrageSecurite: false,
      propreteVehicule: true,
      documentsPrets: true,
      photosApresOk: false,
      validationGlobale: "refuse",
      commentaireRefus: "Essai routier et serrage sécurité à reprendre.",
      dateValidation: "2026-06-28T14:00:00.000Z",
      validePar: "Contrôleur QC",
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-28T16:30:00.000Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false,
    },
  });
}

async function seedPrintDossiers(page: Page, dossiers: DossierSAV[]) {
  await page.addInitScript(() => {
    const printableWindow = window as Window & { __printCalls?: number };
    printableWindow.__printCalls = 0;
    window.print = () => {
      printableWindow.__printCalls = (printableWindow.__printCalls ?? 0) + 1;
    };
  });
  await page.goto("/");
  await page.evaluate(({ keys, seededDossiers }) => {
    localStorage.setItem(keys.dossiers, JSON.stringify(seededDossiers));
    localStorage.setItem(keys.techs, JSON.stringify([{
      id: "tech_print_a4",
      nom: "Technicien Print A4",
      specialite: "Mécanique générale",
      disponibilite: "disponible",
      compétences: ["Contrôle terrain"],
      zoneAffectee: "Mécanique Rapide",
      absencesConges: [],
      capaciteJournaliere: 8,
      chargeActuelle: 0,
    }]));
    localStorage.setItem(keys.reservations, "[]");
  }, { keys: STORAGE_KEYS, seededDossiers: dossiers });
}

async function openDocumentsTab(page: Page, role: string, dossierId: string, dossiers: DossierSAV[] = [buildReadyDossier()]) {
  await seedPrintDossiers(page, dossiers);
  await changeUserRole(page, role);
  await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
  await humanClick(page, page.locator(`[data-testid="dossier-card-${dossierId}"]`));
  await humanClick(page, page.locator('[data-testid="tab-documents"]'));
}

async function expectPrinted(page: Page) {
  await expect.poll(async () => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls ?? 0)).toBeGreaterThan(0);
}

test.describe("Lot 6K-D - impressions A4 terrain", () => {
  test("réception imprime la fiche réception véhicule", async ({ page }) => {
    const dossier = buildReadyDossier();
    await openDocumentsTab(page, "role-option-receptionnaire", dossier.id, [dossier]);

    await humanClick(page, page.locator('[data-testid="print-reception-sheet"]'));
    await expectPrinted(page);
    const preview = page.locator('[data-testid="print-document-preview"]');
    await expect(preview).toContainText("Fiche Réception");
    await expect(preview).toContainText(dossier.id);
    await expect(preview).toContainText("Acceptation simple client");
  });

  test("chef atelier imprime l'OR opérationnel interne", async ({ page }) => {
    const dossier = buildReadyDossier();
    await openDocumentsTab(page, "role-option-chef-atelier", dossier.id, [dossier]);

    await humanClick(page, page.locator('[data-testid="print-operational-or"]'));
    await expectPrinted(page);
    const preview = page.locator('[data-testid="print-document-preview"]');
    await expect(preview).toContainText("Ordre de Réparation Interne");
    await expect(preview).toContainText("OR opérationnel interne");
    await expect(preview).toContainText("Pièce à confirmer ERP");
    await expect(preview).toContainText("QC obligatoire avant restitution");
  });

  test("chef atelier imprime la fiche technicien avec signatures", async ({ page }) => {
    const dossier = buildReadyDossier();
    await seedPrintDossiers(page, [dossier]);
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`[data-testid="dossier-card-${dossier.id}"]`));
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));

    await humanClick(page, page.locator('[data-testid="print-technician-sheet"]'));
    await expectPrinted(page);
    const taskSheet = page.locator('[data-testid="technician-task-sheet-print"]');
    await expect(taskSheet).toContainText("Fiche tâche technicien");
    await expect(taskSheet).toContainText(dossier.id);
    await expect(taskSheet).toContainText(TECH_NAME);
    await expect(taskSheet).toContainText("Signature Technicien");
    await expect(taskSheet).toContainText("Signature Chef Atelier");
    await expect(taskSheet).toContainText("Contrôle Qualité");
  });

  test("contrôle qualité imprime la grille QC", async ({ page }) => {
    const dossier = buildReadyDossier();
    await openDocumentsTab(page, "role-option-controle-qualite", dossier.id, [dossier]);

    await humanClick(page, page.locator('[data-testid="print-qc-sheet"]'));
    await expectPrinted(page);
    const preview = page.locator('[data-testid="print-document-preview"]');
    await expect(preview).toContainText("Fiche Contrôle Qualité");
    await expect(preview).toContainText("Restitution interdite sans QC conforme");
    await expect(preview).toContainText("Signature Contrôle Qualité");
  });

  test("livraison imprime le PV restitution", async ({ page }) => {
    const dossier = buildReadyDossier();
    await openDocumentsTab(page, "role-option-livraison", dossier.id, [dossier]);

    await humanClick(page, page.locator('[data-testid="print-delivery-pv"]'));
    await expectPrinted(page);
    const preview = page.locator('[data-testid="print-document-preview"]');
    await expect(preview).toContainText("Bon de Restitution & Livraison");
    await expect(preview).toContainText("PV restitution / livraison client");
    await expect(preview).toContainText("Signature client");
  });

  test("QC non conforme affiche un watermark non restituable", async ({ page }) => {
    const dossier = buildRefusedDossier();
    await openDocumentsTab(page, "role-option-chef-atelier", dossier.id, [dossier]);

    await humanClick(page, page.locator('[data-testid="print-qc-sheet"]'));
    await expectPrinted(page);
    await expect(page.locator('[data-testid="print-document-watermark"]')).toContainText("NON RESTITUABLE - QC NON CONFORME");
  });

  test("PV conforme ne contient pas de watermark bloquant", async ({ page }) => {
    const dossier = buildReadyDossier();
    await openDocumentsTab(page, "role-option-livraison", dossier.id, [dossier]);

    await humanClick(page, page.locator('[data-testid="print-delivery-pv"]'));
    await expectPrinted(page);
    const preview = page.locator('[data-testid="print-document-preview"]');
    await expect(preview).toContainText("QC conforme");
    await expect(page.locator('[data-testid="print-document-watermark"]')).toHaveCount(0);
  });

  test("lecture seule consulte et imprime sans boutons d'action atelier", async ({ page }) => {
    const dossier = buildReadyDossier();
    await openDocumentsTab(page, "role-option-lecture-seule", dossier.id, [dossier]);

    await humanClick(page, page.locator('[data-testid="print-reception-sheet"]'));
    await expectPrinted(page);
    await humanClick(page, page.locator('[data-testid="tab-repair-orders"]'));
    await expect(page.locator('[data-testid^="task-start-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="task-block-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="task-finish-"]')).toHaveCount(0);
  });

  test("boutons print accessibles en vue mobile/tablette", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dossier = buildReadyDossier();
    await openDocumentsTab(page, "role-option-directeur", dossier.id, [dossier]);

    for (const testId of ["print-reception-sheet", "print-operational-or", "print-qc-sheet", "print-delivery-pv"]) {
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
    }
  });

  test("aucun document imprimable ne contient de termes sensibles", async ({ page }) => {
    const dossier = buildReadyDossier();
    await openDocumentsTab(page, "role-option-directeur", dossier.id, [dossier]);

    await humanClick(page, page.locator('[data-testid="print-delivery-pv"]'));
    await expectPrinted(page);
    const printableText = (await page.locator('[data-testid="print-document-preview"]').innerText()).toLowerCase();
    const blockedPrintTerms = [
      ["mon", "tant"],
      ["pr", "ix"],
      ["fac", "ture"],
      ["paie", "ment"],
      ["cai", "sse"],
      ["mar", "ge"],
      ["st", "ock", " r", "éel"],
    ].map(parts => parts.join(""));

    for (const term of blockedPrintTerms) {
      expect(printableText).not.toContain(term);
    }
  });
});
