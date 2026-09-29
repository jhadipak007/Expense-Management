import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the app started by scripts/start_*.sh|ps1 (port 8080).
 * One worker: every test shares the seeded test user and one SQLite database.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
