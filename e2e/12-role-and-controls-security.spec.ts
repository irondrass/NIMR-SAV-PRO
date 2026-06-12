import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick, humanWait } from "./helpers/human-actions";
import { createMockDossier } from "./helpers/test-data-creator";
import { STORAGE_KEYS } from "../src/storage-keys";
import { DossierStatus, UserRole } from "../src/types";

test.describe("Sécurité des rôles et contrôle de forçage", () => {
  const testDossier = createMockDossier({
    id: "NIMR-SECURE-001",
    clientNom: "Security Client",
    statut: DossierStatus.VEHICULE_RECU,
  });

  test.beforeEach(async ({ page }) => {
    // Clear and seed a test dossier
    await page.goto("/");
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEYS.dossiers, value: [testDossier] });
    await page.reload();
  });

  test("Directeur SAV accède à la gestion utilisateurs sans sélecteur de rôle libre", async ({ page }) => {
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Directeur SAV");

    await expect(page.locator('[data-testid="role-switch-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="nav-users"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="nav-users"]'));
    await expect(page.locator('[data-testid="user-management-page"]')).toBeVisible();
  });

  test("Les autres rôles ne peuvent pas accéder à la gestion utilisateurs", async ({ page }) => {
    const rolesToCheck = [
      { id: "role-option-chef-atelier", label: "Chef d’atelier" },
      { id: "role-option-technicien", label: "Technicien" },
      { id: "role-option-livraison", label: "Livraison" },
      { id: "role-option-lecture-seule", label: "Lecture seule" }
    ];

    for (const roleInfo of rolesToCheck) {
      await changeUserRole(page, roleInfo.id);
      await expect(page.locator('[data-testid="current-role"]')).toHaveText(roleInfo.label);

      await expect(page.locator('[data-testid="role-switch-button"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="nav-users"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="nav-settings"]')).toHaveCount(0);
    }
  });

  test("Absence du forçage statut opérationnel et visibilité limitée de la priorité", async ({ page }) => {
    // We will check multiple roles on the dossier detail page
    const rolesConfig = [
      { roleId: "role-option-technicien", label: "Technicien", canEditPriority: false },
      { roleId: "role-option-lecture-seule", label: "Lecture seule", canEditPriority: false },
      { roleId: "role-option-controle-qualite", label: "Contrôle Qualité", canEditPriority: false },
      { roleId: "role-option-livraison", label: "Livraison", canEditPriority: false },
      { roleId: "role-option-receptionnaire", label: "Réceptionnaire", canEditPriority: false },
      { roleId: "role-option-chef-atelier", label: "Chef d’atelier", canEditPriority: true },
      { roleId: "role-option-directeur", label: "Directeur SAV", canEditPriority: true }
    ];

    for (const conf of rolesConfig) {
      await changeUserRole(page, conf.roleId);
      await expect(page.locator('[data-testid="current-role"]')).toHaveText(conf.label);

      // Navigate to the test dossier detail view (if dossiers list tab is visible, else tech view is different)
      if (conf.roleId === "role-option-technicien") {
        // Technicians don't see dossiers list, they see tech-view. Let's make sure they don't see status/priority override
        await humanClick(page, page.locator('[data-testid="nav-technician"]'));
        await expect(page.locator('[data-testid="force-status-select"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="force-priority-select"]')).toHaveCount(0);
        // Since technician does not have detailed view with assignment, assign select should also not be visible
        await expect(page.locator('[data-testid="assign-technicien-select"]')).toHaveCount(0);
      } else {
        await humanClick(page, page.locator('[data-testid="nav-dossiers"]'));
        await humanClick(page, page.locator(`text=${testDossier.id}`));

        await expect(page.locator('[data-testid="force-status-select"]')).toHaveCount(0);
        if (conf.canEditPriority) {
          await expect(page.locator('[data-testid="force-priority-select"]')).toBeVisible();
          await expect(page.locator('[data-testid="assign-technicien-select"]')).toBeVisible();
        } else {
          await expect(page.locator('[data-testid="force-priority-select"]')).toHaveCount(0);
          await expect(page.locator('[data-testid="assign-technicien-select"]')).toHaveCount(0);
        }
      }
    }
  });
});
