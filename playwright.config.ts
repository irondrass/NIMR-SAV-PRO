import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Run serially to avoid local storage collisions
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["./e2e/helpers/defect-reporter.ts"]
  ],
  use: {
    baseURL: "http://127.0.0.1:4173/NIMR-SAV-PRO/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "tablet-chrome",
      use: { ...devices["Galaxy Tab S4"] },
    },
  ],
  webServer: {
    command: "node scripts/cleanup-playwright-preview.mjs && npm run build && node scripts/serve-playwright-preview.mjs",
    url: "http://127.0.0.1:4173/__nimr_playwright_health",
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
