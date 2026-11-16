import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests run against the built web app served by the real server, with every lookup
 * answered from the recorded cache (scripts/e2e-server.ts). No network and no AI key are used.
 */
export default defineConfig({
  testDir: 'apps/web/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8799',
    locale: 'en-US',
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command: 'npx tsx scripts/e2e-server.ts',
    url: 'http://localhost:8799/api/health',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
