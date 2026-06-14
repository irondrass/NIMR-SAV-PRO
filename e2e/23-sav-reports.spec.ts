/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";

test.describe("SAV History and Reports", () => {
  test("Directeur SAV views all reports, uses filters, and confirms absence of financial data", async ({ page }) => {
    // 1. Go to main page and login as Directeur SAV
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await changeUserRole(page, "role-option-directeur");

    // 2. Click on the Reports tab (Rapports SAV)
    const reportNavSelector = '[data-testid="nav-performance"]';
    await page.waitForSelector(reportNavSelector, { state: "visible" });
    await humanClick(page, page.locator(reportNavSelector));

    // 3. Verify KPIs report is shown initially (default for Directeur)
    const activeTab = page.locator('[data-testid="report-tab-kpis"]');
    await expect(activeTab).toBeVisible();
    await expect(activeTab).toHaveClass(/bg-slate-900/);

    const activeCount = page.locator('[data-testid="kpi-active-count"]');
    await expect(activeCount).toBeVisible();

    // 4. Change period filter to week
    const periodFilter = page.locator('[data-testid="filter-period"]');
    await expect(periodFilter).toBeVisible();
    await periodFilter.selectOption("semaine");

    // 5. Navigate to other reports and verify their contents are visible
    const receptionTab = page.locator('[data-testid="report-tab-reception"]');
    await expect(receptionTab).toBeVisible();
    await humanClick(page, receptionTab);

    const workshopTab = page.locator('[data-testid="report-tab-workshop"]');
    await expect(workshopTab).toBeVisible();
    await humanClick(page, workshopTab);

    const planningTab = page.locator('[data-testid="report-tab-planning"]');
    await expect(planningTab).toBeVisible();
    await humanClick(page, planningTab);

    const qcTab = page.locator('[data-testid="report-tab-qc"]');
    await expect(qcTab).toBeVisible();
    await humanClick(page, qcTab);

    const deliveryTab = page.locator('[data-testid="report-tab-delivery"]');
    await expect(deliveryTab).toBeVisible();
    await humanClick(page, deliveryTab);

    const complaintsTab = page.locator('[data-testid="report-tab-complaints"]');
    await expect(complaintsTab).toBeVisible();
    await humanClick(page, complaintsTab);

    const blockingsTab = page.locator('[data-testid="report-tab-blockings"]');
    await expect(blockingsTab).toBeVisible();
    await humanClick(page, blockingsTab);

    // 6. Check that no financial properties or wording exists on the page
    const pageText = await page.innerText("body");
    const forbiddenWords = [
      "chiffre d'affaires",
      "chiffre d’affaires",
      "marge bénéficiaire",
      "paiement",
      "caisse",
      "facturation réelle",
      "stock réel",
      "disponibilité pièce"
    ];
    forbiddenWords.forEach(word => {
      expect(pageText.toLowerCase()).not.toContain(word.toLowerCase());
    });
  });

  test("Technician does not have access to global SAV reports tab", async ({ page }) => {
    // 1. Go to main page and login as Technicien
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await changeUserRole(page, "role-option-technicien");

    // 2. Verify navigation button to SAV reports is hidden
    const reportNav = page.locator('[data-testid="nav-performance"]');
    await expect(reportNav).not.toBeVisible();
  });
});
