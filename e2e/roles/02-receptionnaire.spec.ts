import { test, expect } from "@playwright/test";
import { changeUserRole, humanWait, humanClick, humanFill } from "../helpers/human-actions";
import { STORAGE_KEYS } from "../../src/storage-keys";

test.describe("Rôle : Réceptionnaire", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await changeUserRole(page, "role-option-receptionnaire");
  });

  test("Habilitations restrictives du Réceptionnaire", async ({ page }) => {
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Réceptionnaire");

    // Guided Reception and dossiers list should be visible
    await expect(page.locator('[data-testid="nav-reception"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-dossiers"]')).toBeVisible();

    // Workshop and Technician specific views should be hidden
    await expect(page.locator('[data-testid="nav-chef-atelier"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="nav-technician"]')).not.toBeVisible();
  });

  test("Validation des étapes de création de dossier (cas négatifs & presets & positif)", async ({ page }) => {
    // Navigate to Guided Reception
    await humanClick(page, page.locator('[data-testid="nav-reception"]'));

    // --- STEP 1: Client Info ---
    // Try to click Next without name
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-error-message"]')).toHaveText(/nom/i);

    // Click client preset 0 (Client Démo Flotte 001)
    const presetClientBtn = page.locator('[data-testid="preset-client-0"]');
    await expect(presetClientBtn).toBeVisible();
    await humanClick(page, presetClientBtn);

    // Verify name and phone are filled
    const nameInput = page.locator('[data-testid="reception-client-name"]');
    const phoneInput = page.locator('[data-testid="reception-client-phone"]');
    await expect(nameInput).toHaveValue("Client Démo Flotte 001");
    await expect(phoneInput).toHaveValue("+216 55 111 001");

    // Verify deposant fields are synchronised (since checkbox is checked by default)
    const checkbox = page.locator('[data-testid="reception-deposant-same"]');
    await expect(checkbox).toBeChecked();
    
    const deposantNameInput = page.locator('input[placeholder="Nom du conducteur livreur"]');
    const deposantPhoneInput = page.locator('input[placeholder="Téléphone du livreur"]');
    await expect(deposantNameInput).toHaveValue("Client Démo Flotte 001");
    await expect(deposantPhoneInput).toHaveValue("+216 55 111 001");

    // Uncheck sync checkbox, and test different deposant details
    await humanClick(page, checkbox);
    await expect(checkbox).not.toBeChecked();

    await humanFill(page, deposantNameInput, "Chauffeur Flotte");
    await humanFill(page, deposantPhoneInput, "+216 99 888 777");
    
    // Client details should remain unchanged
    await expect(nameInput).toHaveValue("Client Démo Flotte 001");
    await expect(phoneInput).toHaveValue("+216 55 111 001");

    // Move to next step
    await humanClick(page, page.locator('[data-testid="reception-next"]'));

    // --- STEP 2: Vehicle Info ---
    // Try to click Next without vehicle data
    await humanClick(page, page.locator('[data-testid="reception-next"]'));
    await expect(page.locator('[data-testid="reception-error-message"]')).toHaveText(/modèle/i);

    // Click vehicle model preset (DFSK Glory 500)
    const presetModelBtn = page.locator('[data-testid="preset-model-glory-500"]');
    await expect(presetModelBtn).toBeVisible();
    await humanClick(page, presetModelBtn);

    // Verify brand and model are filled
    const brandSelect = page.locator('[data-testid="reception-vehicle-brand"]');
    const modelInput = page.locator('[data-testid="reception-vehicle-model"]');
    await expect(brandSelect).toHaveValue("DFSK");
    await expect(modelInput).toHaveValue("Glory 500");

    // Click color preset "Gris"
    const presetColorBtn = page.locator('[data-testid="preset-color-gris"]');
    await expect(presetColorBtn).toBeVisible();
    await humanClick(page, presetColorBtn);

    const colorInput = page.locator('[data-testid="reception-vehicle-color"]');
    await expect(colorInput).toHaveValue("Gris");

    // Fill remaining fields (plate, VIN, mileage)
    await humanFill(page, page.locator('[data-testid="reception-plate"]'), "999 TU 9999");
    await humanFill(page, page.locator('[data-testid="reception-vin"]'), "1HGCM82633A004352");
    await humanFill(page, page.locator('[data-testid="reception-mileage"]'), "12500");
    
    // Move to next step
    await humanClick(page, page.locator('[data-testid="reception-next"]'));

    // --- STEP 3: Objects left on board & Reason ---
    // Click complaint preset (Entretien périodique / Vidange)
    const presetComplaintBtn = page.locator('[data-testid="preset-complaint-entretien"]');
    await expect(presetComplaintBtn).toBeVisible();
    await humanClick(page, presetComplaintBtn);

    const reasonTextarea = page.locator('[data-testid="reception-reason"]');
    await expect(reasonTextarea).toHaveValue("Entretien périodique / Vidange");

    // Saisie libre: add free text after preset
    await humanFill(page, reasonTextarea, "Entretien périodique / Vidange et vibrations train avant");
    await expect(reasonTextarea).toHaveValue("Entretien périodique / Vidange et vibrations train avant");

    // Move to next step
    await humanClick(page, page.locator('[data-testid="reception-next"]'));

    // --- STEP 4: Carrosserie & Fuel & Submit ---
    // Test quick fuel level: click Reserve first
    const presetFuelReserve = page.locator('[data-testid="preset-fuel-reserve"]');
    await expect(presetFuelReserve).toBeVisible();
    await humanClick(page, presetFuelReserve);
    await expect(page.locator('[data-testid="reception-fuel-value"]')).toHaveText("Réserve (5%)");

    // Click fuel level 75%
    const presetFuel75 = page.locator('[data-testid="preset-fuel-75"]');
    await expect(presetFuel75).toBeVisible();
    await humanClick(page, presetFuel75);
    await expect(page.locator('[data-testid="reception-fuel-value"]')).toHaveText("75%");

    // Submit form
    await humanClick(page, page.locator('[data-testid="reception-submit"]'));
    await expect(page.locator('[data-testid="reception-submit-modal"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="reception-submit-confirm"]'));

    // --- STEP 5: Success & Reload/Persistence ---
    // Reload page to test database persistence
    await page.reload();

    // Navigate to dossiers list
    await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));

    // Check that our newly created dossier persists and shows correctly in the table
    const row = page.locator('tr:has-text("999 TU 9999")');
    await expect(row).toBeVisible();
    await expect(row).toContainText("Client Démo Flotte 001");
    await expect(row).toContainText("DFSK Glory 500");
  });
});
