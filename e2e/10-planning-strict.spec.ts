import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";
import { createMockDossier, createMockTech } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus } from "../src/types";

test.describe("Vérification planning strict et charge Gantt", () => {
  const testTech = createMockTech({
    id: "tech_gantt_01",
    nom: "Gantt Master Tech",
    capaciteJournaliere: 8,
    chargeActuelle: 0
  });

  const testDossier = createMockDossier({
    id: "NIMR-GANTT-01",
    clientNom: "Gantt Dossier",
    statut: DossierStatus.VEHICULE_RECU,
    technicienId: undefined, // Unassigned at start
    ordresReparation: [
      { id: "ro_gantt_1", designation: "Travail A", tempsEstime: 2.0, tempsPasse: 0, status: "pending" },
      { id: "ro_gantt_2", designation: "Travail B", tempsEstime: 2.0, tempsPasse: 0, status: "pending" }
    ]
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ keyD, keyT, valD, valT }) => {
      localStorage.clear();
      localStorage.setItem(keyD, JSON.stringify(valD));
      localStorage.setItem(keyT, JSON.stringify(valT));
    }, {
      keyD: STORAGE_KEYS.dossiers,
      valD: [testDossier],
      keyT: STORAGE_KEYS.techs,
      valT: [testTech]
    });
    await page.reload();
    await changeUserRole(page, "role-option-chef-atelier");
  });

  test("Calcul dynamique de la charge Gantt suite à assignation de travaux", async ({ page }) => {
    // 1. Check original charge in planning (should be 0%)
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await expect(page.locator('[data-testid="tech-charge-tech_gantt_01"]')).toHaveText("0%");

    // 2. Assign the dossier to this technician
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));

    // In detail view summary, assign to tech_gantt_01
    const assignSelect = page.locator('[data-testid="assign-technicien-select"]');
    await expect(assignSelect).toBeVisible();
    await assignSelect.selectOption(testTech.id);

    // 3. Go back to planning and assert new charge is updated (4H out of 8H = 50%)
    await humanClick(page, page.locator('[data-testid="nav-planning"]'));
    await expect(page.locator('[data-testid="tech-charge-tech_gantt_01"]')).toHaveText("50%");
  });
});
