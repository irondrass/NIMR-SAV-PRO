import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill, humanSelect } from "./helpers/human-actions";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus, ReclammationClient } from "../src/types";
import { createMockDossier } from "./helpers/test-data-creator";

test.describe("Lot 5F-2 - Workflow Réclamations SAV", () => {
  const linkedDossier = createMockDossier({
    id: "NIMR-CLAIM-001",
    clientNom: "Alice Complaint",
    vehiculeMarque: "Forthing",
    vehiculeModele: "T5 EVO",
    vehiculeImmatriculation: "111 TU 222",
    vehiculeVIN: "VINCLAIM001",
    statut: DossierStatus.PRET_A_LIVRER,
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
      dateValidation: "2026-06-12T08:00:00Z",
      validePar: "Contrôle Qualité",
    },
  });

  const complaints: ReclammationClient[] = [
    {
      id: "REC-TEST-001",
      dossierId: "NIMR-CLAIM-001",
      clientNom: "Alice Complaint",
      vehiculeNom: "Forthing T5 EVO",
      immatriculation: "111 TU 222",
      motif: "Traces de cambouis sur le volant après intervention",
      criticite: "moyenne",
      responsable: "Réceptionnaire Principal",
      actionCorrective: "Lavage intérieur complet offert",
      delaiCible: new Date(Date.now() + 86400000).toISOString(),
      delaiTraitement: new Date(Date.now() + 86400000).toISOString(),
      statut: "nouvelle",
      dateCreation: "2026-06-12T08:00:00Z",
      dateDerniereModification: "2026-06-12T08:00:00Z",
      historiqueActions: [
        {
          id: "hist-rec-test-001",
          date: "2026-06-12T08:00:00Z",
          utilisateur: "Réceptionnaire Principal",
          role: "Réceptionnaire",
          action: "Création réclamation",
          nouveauStatut: "nouvelle",
          commentaire: "Ouverture initiale",
        },
      ],
      historiqueLogs: ["2026-06-12T08:00:00Z - Réclamation créée."],
    },
    {
      id: "REC-TEST-002",
      dossierId: "NIMR-CLAIM-002",
      clientNom: "Bob Critical",
      vehiculeNom: "Dongfeng Shine",
      immatriculation: "333 TU 444",
      motif: "Bruit moteur suspect non résolu",
      criticite: "critique",
      responsable: "Chef Atelier",
      actionCorrective: "Contre-expertise immédiate",
      delaiCible: "2026-06-12T06:00:00Z",
      delaiTraitement: "2026-06-12T06:00:00Z",
      statut: "action_corrective",
      dateCreation: "2026-06-12T07:00:00Z",
      dateDerniereModification: "2026-06-12T07:30:00Z",
      historiqueActions: [
        {
          id: "hist-rec-test-002",
          date: "2026-06-12T07:30:00Z",
          utilisateur: "Chef Atelier",
          role: "Chef d’atelier",
          action: "Action corrective ajoutée",
          ancienStatut: "en_analyse",
          nouveauStatut: "action_corrective",
          commentaire: "Contre-expertise immédiate",
        },
      ],
      historiqueLogs: ["2026-06-12T07:30:00Z - Action corrective ajoutée."],
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ dossierKey, complaintKey, dossiersValue, complaintsValue }) => {
      localStorage.clear();
      localStorage.setItem(dossierKey, JSON.stringify(dossiersValue));
      localStorage.setItem(complaintKey, JSON.stringify(complaintsValue));
    }, {
      dossierKey: STORAGE_KEYS.dossiers,
      complaintKey: STORAGE_KEYS.reclamations,
      dossiersValue: [linkedDossier],
      complaintsValue: complaints,
    });
    await page.reload();
  });

  test("Accès rôles et lecture seule sans modification", async ({ page }) => {
    await changeUserRole(page, "role-option-chef-atelier");
    await expect(page.locator('[data-testid="nav-reclamations"]')).toBeVisible();

    await changeUserRole(page, "role-option-technicien");
    await expect(page.locator('[data-testid="nav-reclamations"]')).toHaveCount(0);

    await changeUserRole(page, "role-option-lecture-seule");
    await humanClick(page, page.locator('[data-testid="nav-reclamations"]'));
    await expect(page.locator('[data-testid="complaint-card"]').filter({ hasText: "Alice Complaint" })).toBeVisible();
    await expect(page.locator('[data-testid="complaint-create-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="complaint-save-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="complaint-readonly-message"]').first()).toBeVisible();
  });

  test("Réceptionnaire crée une réclamation SAV", async ({ page }) => {
    await changeUserRole(page, "role-option-receptionnaire");
    await humanClick(page, page.locator('[data-testid="nav-reclamations"]'));
    await humanClick(page, page.locator('[data-testid="complaint-create-button"]'));

    await humanFill(page, page.locator('[data-testid="complaint-client-input"]'), "Charlie Litige");
    await humanFill(page, page.locator('[data-testid="complaint-dossier-input"]'), "NIMR-CLAIM-001");
    await humanFill(page, page.locator('[data-testid="complaint-vehicle-input"]'), "Forthing U-Tour");
    await humanFill(page, page.locator('[data-testid="complaint-plate-input"]'), "555 TU 666");
    await humanSelect(page, page.locator('[data-testid="complaint-criticity-input"]'), "haute");
    await humanFill(page, page.locator('[data-testid="complaint-owner-input"]'), "Responsable SAV");
    await humanFill(page, page.locator('[data-testid="complaint-action-input"]'), "Remise commerciale après validation");
    await humanFill(page, page.locator('[data-testid="complaint-reason-input"]'), "Retard de livraison de 3 jours");
    await humanClick(page, page.locator('[data-testid="complaint-submit"]'));

    const charlieCard = page.locator('[data-testid="complaint-card"]').filter({ hasText: "Charlie Litige" });
    await expect(charlieCard).toBeVisible();
    await expect(charlieCard).toContainText("Retard de livraison de 3 jours");
    await expect(charlieCard.locator('[data-testid="complaint-history-entry"]').filter({ hasText: "Création réclamation" }).first()).toBeVisible();
  });

  test("Directeur modifie, affecte, change statut, résout, clôture et rouvre", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-reclamations"]'));

    const aliceCard = page.locator('[data-testid="complaint-card"]').filter({ hasText: "Alice Complaint" });
    await humanFill(page, aliceCard.locator('[data-testid="complaint-edit-owner"]'), "Directeur Relation Client");
    await humanSelect(page, aliceCard.locator('[data-testid="complaint-edit-criticity"]'), "critique");
    await humanSelect(page, aliceCard.locator('[data-testid="complaint-edit-status"]'), "en_analyse");
    await humanFill(page, aliceCard.locator('[data-testid="complaint-edit-action"]'), "Rappel client et contrôle qualité renforcé");
    await humanFill(page, aliceCard.locator('[data-testid="complaint-followup-comment"]'), "Décision directeur enregistrée");
    await humanClick(page, aliceCard.locator('[data-testid="complaint-save-button"]'));

    await expect(aliceCard.locator('[data-testid="complaint-status-badge"]')).toContainText("En analyse");
    await expect(aliceCard.locator('[data-testid="complaint-criticity-badge"]')).toContainText("Critique");
    await expect(aliceCard.locator('[data-testid="complaint-history-entry"]').filter({ hasText: "Affectation responsable" })).toBeVisible();

    await humanClick(page, aliceCard.locator('[data-testid="complaint-resolve-button"]'));
    await expect(aliceCard.locator('[data-testid="complaint-status-badge"]')).toContainText("Résolue");

    await humanClick(page, aliceCard.locator('[data-testid="complaint-close-button"]'));
    await expect(aliceCard.locator('[data-testid="complaint-status-badge"]')).toContainText("Clôturée");
    await expect(aliceCard.locator('[data-testid="complaint-save-button"]')).toHaveCount(0);

    await humanClick(page, aliceCard.locator('[data-testid="complaint-reopen-button"]'));
    await expect(aliceCard.locator('[data-testid="complaint-status-badge"]')).toContainText("Réouverte");
  });

  test("Chef Atelier ajoute une action corrective", async ({ page }) => {
    await changeUserRole(page, "role-option-chef-atelier");
    await humanClick(page, page.locator('[data-testid="nav-reclamations"]'));

    const bobCard = page.locator('[data-testid="complaint-card"]').filter({ hasText: "Bob Critical" });
    await humanFill(page, bobCard.locator('[data-testid="complaint-edit-action"]'), "Essai routier contradictoire avec chef atelier");
    await humanFill(page, bobCard.locator('[data-testid="complaint-followup-comment"]'), "Action atelier lancée");
    await humanClick(page, bobCard.locator('[data-testid="complaint-save-button"]'));

    await expect(bobCard.locator('[data-testid="complaint-action-value"]')).toContainText("Essai routier contradictoire avec chef atelier");
    await expect(bobCard.locator('[data-testid="complaint-history-entry"]').filter({ hasText: "Action atelier lancée" })).toBeVisible();
  });

  test("Filtres criticité/statut et ouverture du dossier lié", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-reclamations"]'));

    await humanSelect(page, page.locator('[data-testid="complaint-criticity-filter"]'), "critique");
    await expect(page.locator("text=Bob Critical")).toBeVisible();
    await expect(page.locator("text=Alice Complaint")).toHaveCount(0);

    await humanClick(page, page.locator('[data-testid="complaint-status-filter-toutes"]'));
    await humanSelect(page, page.locator('[data-testid="complaint-criticity-filter"]'), "toutes");
    await humanClick(page, page.locator('[data-testid="complaint-status-filter-nouvelle"]'));
    await expect(page.locator('[data-testid="complaint-card"]').filter({ hasText: "Alice Complaint" })).toBeVisible();
    await expect(page.locator('[data-testid="complaint-card"]').filter({ hasText: "Bob Critical" })).toHaveCount(0);

    const aliceCard = page.locator('[data-testid="complaint-card"]').filter({ hasText: "Alice Complaint" });
    await humanClick(page, aliceCard.locator('[data-testid="complaint-open-dossier"]'));
    await expect(page.locator('[data-testid="dossier-detail-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="dossier-id-title"]')).toContainText("NIMR-CLAIM-001");
    await expect(page.locator('[data-testid="dossier-linked-complaints"]')).toContainText("REC-TEST-001");
  });
});
