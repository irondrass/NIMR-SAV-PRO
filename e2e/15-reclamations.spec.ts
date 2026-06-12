import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill, humanSelect } from "./helpers/human-actions";
import { STORAGE_KEYS } from "../src/storage-keys";
import { ReclammationClient } from "../src/types";

test.describe("Lot 1/5 - Réclamations et Litiges clients", () => {
  const mockReclamations: ReclammationClient[] = [
    {
      id: "REC-TEST-001",
      dossierId: "NIMR-2026-001",
      clientNom: "Alice Complaint",
      vehiculeNom: "Forthing T5 EVO",
      motif: "Traces de cambouis sur le volant après intervention",
      criticite: "moyenne",
      responsable: "Réceptionnaire Principal",
      actionCorrective: "Lavage intérieur complet offert",
      delaiTraitement: "24h",
      statut: "nouvelle",
      dateCreation: new Date().toISOString(),
      historiqueLogs: []
    },
    {
      id: "REC-TEST-002",
      dossierId: "NIMR-2026-002",
      clientNom: "Bob Critical",
      vehiculeNom: "Forthing Yacht",
      motif: "Bruit moteur suspect non résolu",
      criticite: "critique",
      responsable: "Chef Atelier",
      actionCorrective: "Contre-expertise immédiate",
      delaiTraitement: "48h",
      statut: "en_cours",
      dateCreation: new Date().toISOString(),
      historiqueLogs: []
    }
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.reclamations, value: mockReclamations });
    await page.reload();
  });

  test("Sécurité et contrôle d'accès au panneau de réclamation", async ({ page }) => {
    // Chef d'atelier should NOT see the complaints tab
    await changeUserRole(page, "role-option-chef-atelier");
    await expect(page.locator('[data-testid="nav-reclamations"]')).toHaveCount(0);

    // Technicien should NOT see the complaints tab
    await changeUserRole(page, "role-option-technicien");
    await expect(page.locator('[data-testid="nav-reclamations"]')).toHaveCount(0);

    // Réceptionnaire SHOULD see the complaints tab
    await changeUserRole(page, "role-option-receptionnaire");
    await expect(page.locator('[data-testid="nav-reclamations"]')).toBeVisible();

    // Directeur SAV SHOULD see the complaints tab
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="nav-reclamations"]')).toBeVisible();
  });

  test("Filtrage par criticité, saisie et mise à jour d'un ticket", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-reclamations"]'));

    // Verify title and display
    await expect(page.locator("text=RÉCLAMATIONS CLIENTS & CONTENTIEUX SAV")).toBeVisible();
    await expect(page.locator("text=Alice Complaint")).toBeVisible();
    await expect(page.locator("text=Bob Critical")).toBeVisible();

    // Filter by "critique"
    await page.locator("select").first().selectOption("critique");
    await expect(page.locator("text=Bob Critical")).toBeVisible();
    await expect(page.locator("text=Alice Complaint")).toHaveCount(0);

    // Reset filter
    await page.locator("select").first().selectOption("Toutes");
    await expect(page.locator("text=Alice Complaint")).toBeVisible();

    // Create a new complaint
    await humanClick(page, page.locator("text=Saisir Réclamation"));
    await humanFill(page, page.locator('[placeholder="Ex: Client Démo 001"]'), "Charlie Litige");
    await humanFill(page, page.locator('[placeholder="Ex: NIMR-2026-002"]'), "NIMR-2026-003");
    await humanFill(page, page.locator('[placeholder="Forthing T5 EVO - 000 TU 0001"]'), "Forthing U-Tour");
    await page.locator("select").nth(1).selectOption("haute");
    await humanFill(page, page.locator('[placeholder="Problème de traces de doigts, pièces démontées non restituées..."]'), "Retard de livraison de 3 jours");
    await humanFill(page, page.locator('[placeholder="Prise en charge nettoyage, lavage gratuit, véhicule courtoisie..."]'), "Remise de 10% sur la prochaine facture");
    await humanFill(page, page.locator('[placeholder="Ex: Responsable Démo SAV (Directeur SAV)"]'), "Responsable SAV");

    await humanClick(page, page.locator("text=Confirmer la création"));

    // Verify the new card is rendered
    await expect(page.locator("text=Charlie Litige")).toBeVisible();
    await expect(page.locator("text=Retard de livraison de 3 jours")).toBeVisible();

    // Change status of Alice's complaint to "resolue"
    // The dropdown within Alice's card can be found by scoping to the card or selecting the select box corresponding to her card.
    // Let's locate the card that contains "Alice Complaint"
    const aliceCard = page.locator("div.border").filter({ hasText: "Alice Complaint" });
    await aliceCard.locator("select").selectOption("resolue");

    // Verify select value is saved (we can reload the page to check local persistence)
    await page.reload();
    await changeUserRole(page, "role-option-directeur");
    await humanClick(page, page.locator('[data-testid="nav-reclamations"]'));
    const updatedAliceCard = page.locator("div.border").filter({ hasText: "Alice Complaint" });
    await expect(updatedAliceCard.locator("select")).toHaveValue("resolue");
  });
});
