import { test, expect, Page } from "@playwright/test";
import { changeUserRole, humanClick } from "./helpers/human-actions";

async function setRuntimeEnv(page: Page, env: Record<string, string>) {
  await page.addInitScript(runtimeEnv => {
    (window as Window & { __NIMR_RUNTIME_ENV__?: Record<string, string> }).__NIMR_RUNTIME_ENV__ = runtimeEnv;
  }, env);
}

test.describe("47 - Backend v2-B staging readiness", () => {
  test("application démarre en local-only sans env Supabase et diagnostic sans secret", async ({ page }) => {
    const forbiddenRequests: string[] = [];
    page.on("request", request => {
      const url = request.url();
      if (/supabase|googleapis\.com\/drive|drive\.google|accounts\.google|oauth2/i.test(url)) {
        forbiddenRequests.push(url);
      }
    });

    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await changeUserRole(page, "role-option-directeur");

    const diagnostic = page.locator('[data-testid="backend-v2-diagnostics"]');
    await expect(diagnostic).toBeVisible();
    await expect(page.locator('[data-testid="backend-v2-mode"]')).toHaveText("local-only");
    await expect(page.locator('[data-testid="backend-v2-supabase-configured"]')).toHaveText("non");
    await expect(page.locator('[data-testid="backend-v2-auth-provider"]')).toHaveText("local");
    await expect(page.locator('[data-testid="backend-v2-message"]')).toContainText("Mode local actif");

    const text = await diagnostic.innerText();
    expect(text).not.toMatch(/YOUR_SUPABASE|https:\/\/|AIza|ya29|service_role|mhadhbikhaled@gmail\.com/i);
    expect(forbiddenRequests).toEqual([]);
  });

  test("backend-enabled sans URL/key affiche une erreur contrôlée", async ({ page }) => {
    await setRuntimeEnv(page, {
      VITE_NIMR_BACKEND_MODE: "backend-enabled",
      VITE_NIMR_ENV: "staging",
    });
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await changeUserRole(page, "role-option-directeur");

    await expect(page.locator('[data-testid="backend-v2-mode"]')).toHaveText("backend-enabled");
    await expect(page.locator('[data-testid="backend-v2-environment"]')).toHaveText("staging");
    await expect(page.locator('[data-testid="backend-v2-guardrails"]')).toContainText("VITE_SUPABASE_URL");
    await expect(page.locator('[data-testid="backend-v2-guardrails"]')).toContainText("VITE_SUPABASE_ANON_KEY");
  });

  test("mode production simulé bloque l'application", async ({ page }) => {
    await setRuntimeEnv(page, {
      VITE_NIMR_BACKEND_MODE: "backend-enabled",
      VITE_NIMR_ENV: "production",
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
    });
    await page.goto("/");

    await expect(page.locator('[data-testid="backend-production-block"]')).toBeVisible();
    await expect(page.locator('[data-testid="backend-production-block"]')).toContainText("Production réelle non autorisée");
    await expect(page.locator('[data-testid="login-screen"]')).toHaveCount(0);
  });

  test("diagnostic Backend v2 reste réservé Direction et lecture technique", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await changeUserRole(page, "role-option-receptionnaire");
    await expect(page.locator('[data-testid="backend-v2-diagnostics"]')).toHaveCount(0);

    await humanClick(page, page.locator('[data-testid="logout-button"]'));
    await changeUserRole(page, "role-option-lecture-seule");
    await expect(page.locator('[data-testid="backend-v2-diagnostics"]')).toBeVisible();
  });

  test("pages principales restent accessibles en local-only", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await changeUserRole(page, "role-option-directeur");

    await expect(page.locator('[data-testid="director-dashboard"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="nav-reception"]'));
    await expect(page.locator('[data-testid="reception-start"]')).toBeVisible();
    await humanClick(page, page.locator('[data-testid="nav-chef-atelier"]'));
    await expect(page.getByText("CONTRÔLEUR DE PRODUCTION CHEF D'ATELIER")).toBeVisible();
    await humanClick(page, page.locator('[data-testid="nav-controle-qualite"]'));
    await expect(page.getByText("Contrôle Qualité dédié")).toBeVisible();
    await humanClick(page, page.locator('[data-testid="nav-livraison"]'));
    await expect(page.getByText("Module Livraison dédié")).toBeVisible();
  });
});
