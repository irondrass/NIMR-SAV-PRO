import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanFill, humanSelect } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";

test.describe("Gestion des preuves Photos SAV", () => {
  const testDossier = createMockDossier({
    id: "NIMR-PHOTO-001",
    clientNom: "Photo Test Client",
    photosAvant: []
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [testDossier] });
    await page.reload();
    await changeUserRole(page, "role-option-directeur");
  });

  test("Ajout, prévisualisation et suppression d'une photo de carrosserie", async ({ page }) => {
    // Navigate to dossier detail
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
    await humanClick(page, page.locator(`text=${testDossier.id}`));

    // Go to photos tab
    await humanClick(page, page.locator('[data-testid="tab-photos"]'));

    // Check currently no photos message is shown
    await expect(page.locator('text=Aucune photo enregistrée')).toBeVisible();

    // Fill photo title and select category
    await humanFill(page, page.locator('[data-testid="photo-title-input"]'), "Pare-chocs fêlé");
    await humanSelect(page, page.locator('[data-testid="photo-category-select"]'), "défaut carrosserie");

    // Upload mock photo file
    const mockFile = {
      name: "scratch.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")
    };

    await page.setInputFiles('[data-testid="photo-file-input-import"]', mockFile);

    // Wait for the photo to render (photo card with class/testid should appear)
    const photoCard = page.locator('[data-testid^="photo-card-"]');
    await expect(photoCard).toBeVisible();

    // Verify category and title are displayed on the card
    await expect(photoCard).toContainText("défaut carrosserie");
    await expect(photoCard).toContainText("Pare-chocs fêlé");

    // Retrieve photo id from testid
    const testId = await photoCard.getAttribute("data-testid");
    const photoId = testId?.replace("photo-card-", "");

    // Delete the photo
    const deleteBtn = page.locator(`[data-testid="photo-delete-${photoId}"]`);
    await expect(deleteBtn).toBeVisible();
    await humanClick(page, deleteBtn);

    // Verify it is removed and "no photos" message returns
    await expect(photoCard).not.toBeVisible();
    await expect(page.locator('text=Aucune photo enregistrée')).toBeVisible();
  });
});
