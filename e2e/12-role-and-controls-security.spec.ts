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

  test("Directeur SAV peut changer de rôle via l'interface réelle", async ({ page }) => {
    // 1. Initialized as Directeur SAV
    await changeUserRole(page, "role-option-directeur");
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Directeur SAV");

    // 2. Click "Changer" link
    const switchBtn = page.locator('[data-testid="role-switch-button"]');
    await expect(switchBtn).toBeVisible();
    await humanClick(page, switchBtn);

    // 3. We should be on Settings tab. Click "role-option-receptionnaire" button
    const recepBtn = page.locator('[data-testid="role-option-receptionnaire"]');
    await expect(recepBtn).toBeVisible();
    await humanClick(page, recepBtn);

    // 4. Verify role changes to Réceptionnaire and switch button is gone
    await expect(page.locator('[data-testid="current-role"]')).toHaveText("Réceptionnaire");
    await expect(switchBtn).not.toBeVisible();
  });

  test("Les autres rôles ne peuvent pas changer de rôle via l'interface réelle", async ({ page }) => {
    const rolesToCheck = [
      { id: "role-option-chef-atelier", label: "Chef d’atelier" },
      { id: "role-option-technicien", label: "Technicien" },
      { id: "role-option-lecture-seule", label: "Lecture seule" }
    ];

    for (const roleInfo of rolesToCheck) {
      await changeUserRole(page, roleInfo.id);
      await expect(page.locator('[data-testid="current-role"]')).toHaveText(roleInfo.label);

      // Verify "Changer" button is not visible
      await expect(page.locator('[data-testid="role-switch-button"]')).toHaveCount(0);

      // Verify blocking message is visible and understandable in the sidebar
      const blockedMsg = page.locator('[data-testid="role-change-blocked-message"]');
      await expect(blockedMsg).toBeVisible();
      await expect(blockedMsg).toHaveText("Modification bloquée");

      // Even if they try to navigate to settings view (which they shouldn't be able to, but let's check)
      await expect(page.locator('[data-testid="nav-settings"]')).toHaveCount(0);
    }
  });

  test("Visibilité et utilisation des contrôles de forçage selon les privilèges", async ({ page }) => {
    // We will check multiple roles on the dossier detail page
    const rolesConfig = [
      { roleId: "role-option-technicien", label: "Technicien", canForce: false },
      { roleId: "role-option-lecture-seule", label: "Lecture seule", canForce: false },
      { roleId: "role-option-controle-qualite", label: "Contrôle Qualité", canForce: false },
      { roleId: "role-option-receptionnaire", label: "Réceptionnaire", canForce: false },
      { roleId: "role-option-chef-atelier", label: "Chef d’atelier", canForce: true },
      { roleId: "role-option-directeur", label: "Directeur SAV", canForce: true }
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

        if (conf.canForce) {
          await expect(page.locator('[data-testid="force-status-select"]')).toBeVisible();
          await expect(page.locator('[data-testid="force-priority-select"]')).toBeVisible();
          await expect(page.locator('[data-testid="assign-technicien-select"]')).toBeVisible();
        } else {
          await expect(page.locator('[data-testid="force-status-select"]')).toHaveCount(0);
          await expect(page.locator('[data-testid="force-priority-select"]')).toHaveCount(0);
          await expect(page.locator('[data-testid="assign-technicien-select"]')).toHaveCount(0);
        }
      }
    }
  });
});
