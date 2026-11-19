import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium, expect, test as base } from '@playwright/test'
import type { BrowserContext, Page, Worker } from '@playwright/test'

export const SITE = 'http://localhost:8799'
export { expect }

interface TestFixtures {
  context: BrowserContext
  extensionId: string
  worker: Worker
}

interface WorkerFixtures {
  /** The built extension, pointed at the replay server. */
  extensionDir: string
}

/**
 * A real Chromium with the extension loaded. Extensions need the full Chromium build (the
 * "chromium" channel) and a persistent profile; each test gets a fresh profile.
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  extensionDir: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const dir = mkdtempSync(path.join(tmpdir(), 'cekkutip-ext-'))
      execSync('npx tsx scripts/build-extension.ts', {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env, CEKKUTIP_URL: SITE, EXTENSION_OUT: dir },
      })
      await use(dir)
      rmSync(dir, { recursive: true, force: true })
    },
    { scope: 'worker' },
  ],

  context: async ({ extensionDir }, use) => {
    const profile = mkdtempSync(path.join(tmpdir(), 'cekkutip-profile-'))
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      locale: 'en-US',
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    })
    await use(context)
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  },

  worker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers()
    worker ??= await context.waitForEvent('serviceworker')
    await use(worker)
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host)
  },
})

export const panelUrl = (id: string) => `chrome-extension://${id}/panel.html`

export async function openPanel(page: Page, id: string) {
  await page.goto(panelUrl(id))
  await page.evaluate(() => document.fonts.ready)
}

export const summary = (page: Page) => page.getByText('Use your own Gemini API key (optional)')
export const keyInput = (page: Page) => page.getByLabel('Gemini API key', { exact: true })
export const keyStatus = (page: Page) => page.locator('.keypanel__status')

export async function saveKey(page: Page, key: string) {
  await summary(page).click()
  await keyInput(page).fill(key)
  await page.getByRole('button', { name: 'Save key' }).click()
}
