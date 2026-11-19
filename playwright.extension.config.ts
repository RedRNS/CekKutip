import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests for the browser extension. A real Chromium loads the built extension and talks
 * to the replay server (scripts/e2e-server.ts), so there is no network and no AI key.
 * Run: npm run test:extension
 */
export default defineConfig({
  testDir: 'extension/e2e',
  testMatch: '**/*.spec.ts',
  // Each test owns a browser profile and the tests share one server: keep it simple.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: { locale: 'en-US' },
  webServer: {
    command: 'npx tsx scripts/e2e-server.ts',
    url: 'http://localhost:8799/api/health',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
