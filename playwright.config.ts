import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      LOCAL_AUTH_ENABLED: "true",
      LOCAL_MOCK_MODE: "true",
      DATABASE_URL:
        "postgresql://highlands:highlands_dev@localhost:5432/highlands_docs",
      DIRECT_URL:
        "postgresql://highlands:highlands_dev@localhost:5432/highlands_docs",
      AUTH_SECRET: "playwright-test-secret-minimum-32-chars",
      APP_URL: "http://localhost:3000",
    },
  },
});
