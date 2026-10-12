import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  timeout: 120000,
  workers: process.env.CI ? 4 : 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
    actionTimeout: 10000,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      outputDir: "test-results/desktop",
      use: { viewport: { width: 1536, height: 1024 } },
    },
    {
      name: "mobile",
      outputDir: "test-results/mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
