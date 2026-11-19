import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import type { Page, Route } from '@playwright/test'
import { EXAMPLES } from '../../apps/web/src/data/example-list'
import { SITE, expect, keyStatus, openPopup, saveKey, summary, test } from './fixtures'

const KEY = 'AIzaSyA-1234567890abcdefghijklmnopqrstu'
const OTHER = 'AIzaSyB-0987654321zyxwvutsrqponmlkjihgf'
const REF = EXAMPLES[0]?.text as string

const references = (page: Page) => page.getByRole('textbox', { name: 'References' })
const check = (page: Page) => page.getByRole('button', { name: /^Check references/ })

async function openSite(page: Page) {
  await page.goto(SITE)
  await page.evaluate(() => document.fonts.ready)
}

/** Ask the replay server without the key (it cannot call Google), and let the test change the answer. */
async function watchCheck(page: Page, change: (done: Record<string, unknown>) => void = () => {}) {
  const seen: { headers: Record<string, string>; url: string; body: string }[] = []
  await page.route('**/api/check', async (route: Route) => {
    const request = route.request()
    seen.push({ headers: request.headers(), url: request.url(), body: request.postData() ?? '' })
    const headers = { ...request.headers() }
    delete headers['x-gemini-key']
    const response = await route.fetch({ headers })
    const lines = (await response.text())
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>)
    for (const line of lines)
      if (line.type === 'done') change(line.summary as Record<string, unknown>)
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
    })
  })
  return seen
}

test.describe('what the extension is allowed to do', () => {
  test('asks for one site and two small permissions, nothing else', async ({ extensionDir }) => {
    const manifest = JSON.parse(readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'))
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.permissions).toEqual(['storage', 'contextMenus'])
    expect(manifest.host_permissions).toEqual(['http://localhost/*'])
    expect(manifest.content_scripts).toHaveLength(1)
    expect(manifest.content_scripts[0].matches).toEqual(['http://localhost/*'])
    expect(manifest.content_scripts[0].js).toEqual(['bridge.js'])
    const text = JSON.stringify(manifest)
    for (const broad of [
      '<all_urls>',
      '*://*',
      'tabs',
      'cookies',
      'webRequest',
      'history',
      'scripting',
    ])
      expect(text, `manifest must not mention ${broad}`).not.toContain(broad)
  })

  test('has no remote code and no inline script in the popup', async ({ extensionDir }) => {
    const html = readFileSync(path.join(extensionDir, 'popup.html'), 'utf8')
    expect(html).toContain('<script src="popup.js"></script>')
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html).not.toMatch(/https?:\/\//)
  })

  test('the loaded extension has a name and an icon', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/icons/48.png`)
    await expect(page.locator('img')).toBeVisible()
  })
})

test.describe('the popup', () => {
  test('is the CekKutip tool, with the key panel and the link to the site', async ({
    page,
    extensionId,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await openPopup(page, extensionId)
    await expect(page.getByText('CekKutip', { exact: true }).first()).toBeVisible()
    await expect(references(page)).toBeVisible()
    await expect(check(page)).toBeDisabled()
    await expect(summary(page)).toBeVisible()
    await expect(page.getByRole('link', { name: /Open the CekKutip website/ })).toHaveAttribute(
      'href',
      SITE,
    )
    await expect(page.getByText('Verdicts are prompts for review').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('checks references against the server and shows a verdict', async ({
    page,
    extensionId,
  }) => {
    await openPopup(page, extensionId)
    await references(page).fill(REF)
    await expect(page.getByText('1 found', { exact: true })).toBeVisible()
    await check(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    await expect(page.locator('.ledger > li').nth(0).locator('.verdict')).toHaveText('Verified')
    await expect(page.locator('.ledger > li').nth(0)).toContainText('Found in Crossref')
  })

  test('shows the evidence and the corrected reference for a Mismatch, as the website does', async ({
    page,
    extensionId,
  }) => {
    await openPopup(page, extensionId)
    await references(page).fill(EXAMPLES[1]?.text as string)
    await check(page).click()
    await expect(page.locator('.ledger > li').nth(0).locator('.verdict')).toHaveText('Mismatch')
    await page.getByRole('button', { name: 'Show details for reference 1' }).click()
    await expect(page.getByText('Corrected reference (APA 7)')).toBeVisible()
  })

  test('has no accessibility violations, and fits the 400 px window', async ({
    page,
    extensionId,
  }) => {
    await openPopup(page, extensionId)
    await references(page).fill(REF)
    await check(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(result.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([])
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('switches to Indonesian', async ({ page, extensionId }) => {
    await openPopup(page, extensionId)
    await page.getByRole('button', { name: /Switch to Bahasa Indonesia/ }).click()
    await expect(page.getByRole('textbox', { name: 'Referensi' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Buka situs CekKutip/ })).toBeVisible()
  })

  test('takes the text chosen from the right-click menu, once', async ({
    page,
    extensionId,
    worker,
  }) => {
    await worker.evaluate((text) => chrome.storage.session.set({ pendingText: text }), REF)
    await openPopup(page, extensionId)
    await expect(references(page)).toHaveValue(REF)
    // Nothing was sent: the person still chooses "Check references".
    await expect(page.getByText('0 of')).toHaveCount(0)
    await expect(check(page)).toBeEnabled()
    // The text was taken, so the next time the popup opens it is empty.
    await openPopup(page, extensionId)
    await expect(references(page)).toHaveValue('')
  })

  test('sets up the right-click menu item for selected text', async ({ worker }) => {
    // A browser menu cannot be driven from a test. "update" with no changes succeeds only when the
    // item exists, and creates nothing, so it asks the question without changing the answer.
    const exists = () =>
      worker.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            chrome.contextMenus.update('cekkutip-check-selection', {}, () => {
              resolve(chrome.runtime.lastError === undefined)
            })
          }),
      )
    await expect.poll(exists).toBe(true)
    const missing = await worker.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          chrome.contextMenus.update('no-such-item', {}, () => {
            resolve(chrome.runtime.lastError === undefined)
          })
        }),
    )
    expect(missing).toBe(false) // the probe can tell the difference
  })
})

test.describe('your own key in the popup', () => {
  test('is saved in the extension and shows only its ends', async ({
    page,
    extensionId,
    worker,
  }) => {
    await openPopup(page, extensionId)
    await saveKey(page, KEY)
    await expect(keyStatus(page)).toHaveText('Using your key: AIza...rstu')
    await expect(page.getByText(KEY)).toHaveCount(0)
    const stored = await worker.evaluate(() => chrome.storage.local.get('cekkutip.geminiKey'))
    expect(JSON.parse(stored['cekkutip.geminiKey'] as string).key).toBe(KEY)
  })

  test('is kept when the popup is closed and opened again', async ({ page, extensionId }) => {
    await openPopup(page, extensionId)
    await saveKey(page, KEY)
    await openPopup(page, extensionId)
    await summary(page).click()
    await expect(keyStatus(page)).toHaveText('Using your key: AIza...rstu')
  })

  test('is sent in one header with the AI reader, and not with the no-AI reader', async ({
    page,
    extensionId,
  }) => {
    const seen = await watchCheck(page)
    await openPopup(page, extensionId)
    await saveKey(page, KEY)
    await references(page).fill(REF)
    await check(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    expect(seen[0]?.headers['x-gemini-key']).toBe(KEY)
    expect(seen[0]?.url).not.toContain(KEY)
    expect(seen[0]?.body).not.toContain(KEY)

    await page.getByLabel(/Do not send my text to an AI service/).check()
    await check(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    await expect.poll(() => seen.length).toBe(2)
    expect(seen[1]?.headers).not.toHaveProperty('x-gemini-key')
  })

  test('tells the person when Google refused it', async ({ page, extensionId }) => {
    await watchCheck(page, (done) => void (done.aiIssue = 'rejected'))
    await openPopup(page, extensionId)
    await saveKey(page, KEY)
    await references(page).fill(REF)
    await check(page).click()
    await expect(page.getByText(/Google did not accept your Gemini key/)).toBeVisible()
  })
})

test.describe('the key is shared between the popup and the website', () => {
  test('a key saved in the extension is there when the website is opened', async ({
    context,
    page,
    extensionId,
  }) => {
    await openPopup(page, extensionId)
    await saveKey(page, KEY)

    const site = await context.newPage()
    await openSite(site)
    await summary(site).click()
    await expect(keyStatus(site)).toHaveText('Using your key: AIza...rstu')
    await expect(site.getByText(/browser extension is connected/)).toBeVisible()
    const local = await site.evaluate(() =>
      JSON.parse(localStorage.getItem('cekkutip.geminiKey') ?? 'null'),
    )
    expect(local.key).toBe(KEY)
  })

  test('a key saved on the website is there when the popup is opened', async ({
    context,
    page,
    extensionId,
  }) => {
    await openSite(page)
    await saveKey(page, KEY)

    const popup = await context.newPage()
    await openPopup(popup, extensionId)
    await summary(popup).click()
    await expect(keyStatus(popup)).toHaveText('Using your key: AIza...rstu')
  })

  test('a key saved in the extension appears on an open website at once', async ({
    context,
    page,
    extensionId,
  }) => {
    await openSite(page)
    await summary(page).click()
    await expect(keyStatus(page)).toHaveText('No key saved. The shared reader is used.')

    const popup = await context.newPage()
    await openPopup(popup, extensionId)
    await saveKey(popup, KEY)
    await expect(keyStatus(page)).toHaveText('Using your key: AIza...rstu')
  })

  test('a key saved on an open website appears in an open popup at once', async ({
    context,
    page,
    extensionId,
  }) => {
    await openPopup(page, extensionId)
    await summary(page).click()

    const site = await context.newPage()
    await openSite(site)
    await saveKey(site, OTHER)
    await expect(keyStatus(page)).toHaveText('Using your key: AIza...ihgf')
  })

  test('removing it on one side removes it on the other, and it does not come back', async ({
    context,
    page,
    extensionId,
  }) => {
    await openPopup(page, extensionId)
    await saveKey(page, KEY)
    const site = await context.newPage()
    await openSite(site)
    await summary(site).click()
    await expect(keyStatus(site)).toHaveText('Using your key: AIza...rstu')

    await site.getByRole('button', { name: 'Remove key' }).click()
    await expect(keyStatus(page)).toHaveText('No key saved. The shared reader is used.')

    // Opening both again: nothing returns from either side.
    await site.reload()
    await summary(site).click()
    await expect(keyStatus(site)).toHaveText('No key saved. The shared reader is used.')
    await openPopup(page, extensionId)
    await summary(page).click()
    await expect(keyStatus(page)).toHaveText('No key saved. The shared reader is used.')
  })

  test('removing it in the extension removes it from the website', async ({
    context,
    page,
    extensionId,
  }) => {
    await openSite(page)
    await saveKey(page, KEY)
    const popup = await context.newPage()
    await openPopup(popup, extensionId)
    await summary(popup).click()
    await popup.getByRole('button', { name: 'Remove key' }).click()
    await expect(keyStatus(page)).toHaveText('No key saved. The shared reader is used.')
  })

  test('the website sends a check with the key it got from the extension', async ({
    context,
    page,
    extensionId,
  }) => {
    const popup = await context.newPage()
    await openPopup(popup, extensionId)
    await saveKey(popup, KEY)

    const seen = await watchCheck(page)
    await openSite(page)
    await expect(page.getByLabel(/Do not send my text to an AI service/)).toBeEnabled()
    await page.getByRole('textbox', { name: 'References' }).fill(REF)
    await page.getByRole('button', { name: /^Check references/ }).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    expect(seen[0]?.headers['x-gemini-key']).toBe(KEY)
  })
})

test.describe('the extension on other sites', () => {
  test('does not touch a page that is not CekKutip', async ({ context }) => {
    const other = await context.newPage()
    await other.route('http://example.test/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><body><script>window.__heard=[];addEventListener("message",e=>__heard.push(e.data))</script></body></html>',
      }),
    )
    await other.goto('http://example.test/')
    await other.waitForTimeout(500)
    const heard = await other.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard)
    expect(heard).toEqual([]) // the extension never announced itself here
  })
})
