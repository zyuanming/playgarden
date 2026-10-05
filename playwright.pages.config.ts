import { defineConfig } from "@playwright/test";

const publishedURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./e2e-pages",
  timeout: 180000,
  retries: 0,
  workers: 2,
  reporter: "list",
  outputDir: "test-results/pages",
  use: {
    baseURL: publishedURL || "http://127.0.0.1:4174/playgarden/",
    headless: true,
    actionTimeout: 10000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "pages-desktop", use: { viewport: { width: 1536, height: 1024 } } },
    { name: "pages-mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: publishedURL ? undefined : {
    command: "npx vite preview --host 127.0.0.1 --port 4174 --base=/playgarden/",
    url: "http://127.0.0.1:4174/playgarden/",
    reuseExistingServer: false,
  },
});
