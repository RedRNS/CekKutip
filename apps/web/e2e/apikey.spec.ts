import type { Page, Route } from '@playwright/test'
import { EXAMPLES } from '../src/data/example-list'
import {
  checkButton,
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  input,
  rows,
  test,
} from './helpers'

const KEY = 'AIzaSyA-1234567890abcdefghijklmnopqrstu'
const OTHER = 'AIzaSyB-0987654321zyxwvutsrqponmlkjihgf'
const STORAGE = 'cekkutip.geminiKey'
const REF = EXAMPLES[0]?.text as string

const summary = (page: Page) => page.getByText('Use your own Gemini API key (optional)')
const keyInput = (page: Page) => page.getByLabel('Gemini API key', { exact: true })
const status = (page: Page) => page.locator('.keypanel__status')

async function openPanel(page: Page) {
  await page.goto('/')
  await summary(page).click()
}

const stored = (page: Page) =>
  page.evaluate((name) => JSON.parse(window.localStorage.getItem(name) ?? 'null'), STORAGE)

/**
 * Watch the check request. The server is asked without the key (the replay server has no way to call
 * Google), and the answer can be changed on the way, for example to add an AI issue.
 */
async function watchCheck(
  page: Page,
  change: (doneLine: Record<string, unknown>) => void = () => {},
) {
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
    for (const line of lines) {
      if (line.type === 'done') change(line.summary as Record<string, unknown>)
    }
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
    })
  })
  return seen
}

/** Record what the page posts to the extension, from the first script on. */
async function recordPosts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __posted: unknown[] }
    w.__posted = []
    window.addEventListener('message', (e) => {
      const d = e.data as { source?: string } | null
      if (e.source === window && d && d.source === 'cekkutip-web') w.__posted.push(d)
    })
  })
}
const posted = (page: Page) =>
  page.evaluate(() => (window as unknown as { __posted: unknown[] }).__posted)

const fromExtension = (page: Page, message: unknown) =>
  page.evaluate((m) => window.postMessage(m, window.location.origin), message)

test.describe('your own Gemini key on the website', () => {
  test('is offered, closed, with the plain facts about it', async ({ page }) => {
    await page.goto('/')
    await expect(summary(page)).toBeVisible()
    await expect(keyInput(page)).toBeHidden()
    await summary(page).click()
    await expect(keyInput(page)).toBeVisible()
    await expect(page.getByText(/shared Gemini key, which has a daily limit/)).toBeVisible()
    await expect(page.getByText(/never stored or logged/).first()).toBeVisible()
    await expect(status(page)).toHaveText('No key saved. The shared reader is used.')
    await expect(page.getByRole('button', { name: 'Remove key' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save key' })).toBeDisabled()
    const link = page.getByRole('link', { name: /Get a free key from Google AI Studio/ })
    await expect(link).toHaveAttribute('href', 'https://aistudio.google.com/apikey')
    await expect(link).toHaveAttribute('target', '_blank')
  })

  test('saves a key in this browser, shows only its ends, and clears the box', async ({ page }) => {
    await openPanel(page)
    await keyInput(page).fill(`  "${KEY}" `)
    await page.getByRole('button', { name: 'Save key' }).click()
    await expect(status(page)).toHaveText('Using your key: AIza...rstu')
    await expect(page.getByText('Key saved in this browser.')).toBeVisible()
    await expect(keyInput(page)).toHaveValue('')
    await expect(page.getByText(KEY)).toHaveCount(0) // the full key is never shown
    expect((await stored(page)).key).toBe(KEY)
    await expect(page.getByRole('button', { name: 'Remove key' })).toBeEnabled()
  })

  test('keeps the key after the page is reloaded', async ({ page }) => {
    await openPanel(page)
    await keyInput(page).fill(KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
    await page.reload()
    await summary(page).click()
    await expect(status(page)).toHaveText('Using your key: AIza...rstu')
  })

  test('refuses text that cannot be a key, and keeps nothing', async ({ page }) => {
    await openPanel(page)
    await keyInput(page).fill('my name is not a key')
    await page.getByRole('button', { name: 'Save key' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'That does not look like a Gemini API key. Check it and try again.',
    )
    await expect(status(page)).toHaveText('No key saved. The shared reader is used.')
    expect(await stored(page)).toBeNull()
  })

  test('removes the key, and the removal is remembered', async ({ page }) => {
    await openPanel(page)
    await keyInput(page).fill(KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
    await page.getByRole('button', { name: 'Remove key' }).click()
    await expect(status(page)).toHaveText('No key saved. The shared reader is used.')
    await expect(page.getByText('Key removed. The shared reader is used.')).toBeVisible()
    expect((await stored(page)).key).toBeNull()
    await page.reload()
    await summary(page).click()
    await expect(status(page)).toHaveText('No key saved. The shared reader is used.')
  })

  test('can show the key while typing, and hides it by default', async ({ page }) => {
    await openPanel(page)
    await expect(keyInput(page)).toHaveAttribute('type', 'password')
    await page.getByLabel('Show key').check()
    await expect(keyInput(page)).toHaveAttribute('type', 'text')
  })

  test('has no accessibility violations with the panel open, and does not overflow on a phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await openPanel(page)
    await keyInput(page).fill(KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
    await expectNoAxeViolations(page)
    await expectNoHorizontalScroll(page)
  })

  test('works in Indonesian', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Switch to Bahasa Indonesia' }).click()
    await page.getByText('Pakai kunci API Gemini milikmu (opsional)').click()
    await expect(
      page.getByText('Belum ada kunci tersimpan. Pembaca bersama dipakai.'),
    ).toBeVisible()
    await page.getByLabel('Kunci API Gemini', { exact: true }).fill(KEY)
    await page.getByRole('button', { name: 'Simpan kunci' }).click()
    await expect(status(page)).toHaveText('Memakai kuncimu: AIza...rstu')
  })

  test('the Privacy page says what happens to the key', async ({ page }) => {
    await page.goto('/privacy')
    await expect(
      page.getByText(/If you add your own Gemini key, it stays in your browser/),
    ).toBeVisible()
  })
})

test.describe('checking with your own key', () => {
  async function saveKey(page: Page) {
    await openPanel(page)
    await keyInput(page).fill(KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
  }

  test('sends the key in one header, and nowhere else', async ({ page }) => {
    const seen = await watchCheck(page)
    await saveKey(page)
    await input(page).fill(REF)
    await checkButton(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    expect(seen).toHaveLength(1)
    expect(seen[0]?.headers['x-gemini-key']).toBe(KEY)
    expect(seen[0]?.url).not.toContain(KEY)
    expect(seen[0]?.body).not.toContain(KEY)
    await expect(rows(page).nth(0).locator('.verdict')).toHaveText('Verified')
  })

  test('makes the AI reader available even though the server has none of its own', async ({
    page,
  }) => {
    await page.goto('/')
    const noAi = page.getByLabel(/Do not send my text to an AI service/)
    await expect(noAi).toBeChecked()
    await expect(noAi).toBeDisabled()
    await summary(page).click()
    await keyInput(page).fill(KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
    await expect(noAi).not.toBeChecked()
    await expect(noAi).toBeEnabled()
    await page.getByRole('button', { name: 'Remove key' }).click()
    await expect(noAi).toBeChecked()
    await expect(noAi).toBeDisabled()
  })

  test('sends no key when "do not send my text to an AI service" is chosen', async ({ page }) => {
    const seen = await watchCheck(page)
    await saveKey(page)
    await page.getByLabel(/Do not send my text to an AI service/).check()
    await input(page).fill(REF)
    await checkButton(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    expect(seen).toHaveLength(1)
    expect(seen[0]?.headers).not.toHaveProperty('x-gemini-key')
    expect(JSON.parse(seen[0]?.body ?? '{}').options.parseMode).toBe('regex')
  })

  test('sends no key when none is saved', async ({ page }) => {
    const seen = await watchCheck(page)
    await page.goto('/')
    await input(page).fill(REF)
    await checkButton(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    expect(seen[0]?.headers).not.toHaveProperty('x-gemini-key')
  })

  test('tells the person when Google refused their key, and still shows every result', async ({
    page,
  }) => {
    await watchCheck(page, (done) => void (done.aiIssue = 'rejected'))
    await saveKey(page)
    await input(page).fill(REF)
    await checkButton(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'did not accept your Gemini key' }),
    ).toHaveText(
      'Google did not accept your Gemini key, so the no-AI reader was used instead. Check the key.',
    )
    await expect(rows(page)).toHaveCount(1)
  })

  test('tells the person when their key ran out', async ({ page }) => {
    await watchCheck(page, (done) => void (done.aiIssue = 'quota'))
    await saveKey(page)
    await input(page).fill(REF)
    await checkButton(page).click()
    await expect(page.getByText('reached its usage limit')).toBeVisible()
  })

  test('offers their own key when the shared reader is at its limit', async ({ page }) => {
    await watchCheck(page, (done) => void (done.aiIssue = 'quota'))
    await page.goto('/')
    await input(page).fill(REF)
    await checkButton(page).click()
    await expect(
      page.getByText('The shared AI reader reached its daily limit', { exact: false }),
    ).toBeVisible()
    await expect(page.getByText(/Add your own free Gemini key/)).toBeVisible()
  })

  test('shows no banner when nothing went wrong', async ({ page }) => {
    await watchCheck(page)
    await saveKey(page)
    await input(page).fill(REF)
    await checkButton(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    await expect(page.locator('.banner')).toHaveCount(0)
  })

  test('says so when the server refuses a key that cannot be a key', async ({ page }) => {
    await page.route('**/api/check', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'invalid_api_key', message: 'x' } }),
      }),
    )
    await saveKey(page)
    await input(page).fill(REF)
    await checkButton(page).click()
    await expect(page.getByText(/The Gemini key does not look right/)).toBeVisible()
  })
})

test.describe('sharing the key with the browser extension', () => {
  test('says hello to the extension when the page opens, with the key it holds', async ({
    page,
  }) => {
    await recordPosts(page)
    await page.addInitScript(
      ([name, value]) => window.localStorage.setItem(name as string, value as string),
      [STORAGE, JSON.stringify({ key: KEY, updatedAt: 500 })],
    )
    await page.goto('/')
    const messages = (await posted(page)) as { type: string; state: { key: string } }[]
    expect(messages[0]).toMatchObject({
      source: 'cekkutip-web',
      type: 'hello',
      state: { key: KEY, updatedAt: 500 },
    })
  })

  test('takes a newer key from the extension, saves it, and says the extension is connected', async ({
    page,
  }) => {
    await openPanel(page)
    await expect(page.getByText(/browser extension is connected/)).toHaveCount(0)
    await fromExtension(page, {
      source: 'cekkutip-extension',
      type: 'state',
      state: { key: KEY, updatedAt: Date.now() + 5000 },
    })
    await expect(status(page)).toHaveText('Using your key: AIza...rstu')
    await expect(page.getByText(/browser extension is connected/)).toBeVisible()
    expect((await stored(page)).key).toBe(KEY)
  })

  test('takes a removal from the extension', async ({ page }) => {
    await openPanel(page)
    await keyInput(page).fill(KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
    await fromExtension(page, {
      source: 'cekkutip-extension',
      type: 'state',
      state: { key: null, updatedAt: Date.now() + 5000 },
    })
    await expect(status(page)).toHaveText('No key saved. The shared reader is used.')
  })

  test('keeps its own newer key against an older one from the extension', async ({ page }) => {
    await openPanel(page)
    await keyInput(page).fill(KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
    await fromExtension(page, {
      source: 'cekkutip-extension',
      type: 'state',
      state: { key: OTHER, updatedAt: 1 },
    })
    await expect(status(page)).toHaveText('Using your key: AIza...rstu')
  })

  test('tells the extension when a key is saved or removed here', async ({ page }) => {
    await recordPosts(page)
    await openPanel(page)
    await keyInput(page).fill(KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
    await page.getByRole('button', { name: 'Remove key' }).click()
    // postMessage arrives on a later turn of the event loop, so wait for it.
    const setKeys = async () =>
      ((await posted(page)) as { type: string; state: { key: string | null } }[])
        .filter((m) => m.type === 'set')
        .map((m) => m.state.key)
    await expect.poll(setKeys).toEqual([KEY, null])
  })

  test('answers the extension announcing itself with a hello, and sends nothing else', async ({
    page,
  }) => {
    await recordPosts(page)
    await page.goto('/')
    const before = ((await posted(page)) as unknown[]).length
    await fromExtension(page, { source: 'cekkutip-extension', type: 'present' })
    await expect.poll(async () => ((await posted(page)) as unknown[]).length).toBe(before + 1)
    const last = ((await posted(page)) as { type: string }[]).at(-1)
    expect(last?.type).toBe('hello')
  })

  test('ignores messages that are not from the extension, or are malformed', async ({ page }) => {
    await openPanel(page)
    for (const junk of [
      { source: 'someone-else', type: 'state', state: { key: KEY, updatedAt: Date.now() + 9000 } },
      { source: 'cekkutip-web', type: 'state', state: { key: KEY, updatedAt: Date.now() + 9000 } },
      {
        source: 'cekkutip-extension',
        type: 'state',
        state: { key: 'not a key', updatedAt: Date.now() + 9000 },
      },
      { source: 'cekkutip-extension', type: 'state' },
      'text',
      null,
    ]) {
      await fromExtension(page, junk)
    }
    await expect(status(page)).toHaveText('No key saved. The shared reader is used.')
    await expect(page.getByText(/browser extension is connected/)).toHaveCount(0)
    expect(await stored(page)).toBeNull()
  })

  test('follows a change made in another tab of the site', async ({ page, context }) => {
    await openPanel(page)
    const other = await context.newPage()
    await other.goto('/')
    await other.getByText('Use your own Gemini API key (optional)').click()
    await other.getByLabel('Gemini API key', { exact: true }).fill(KEY)
    await other.getByRole('button', { name: 'Save key' }).click()
    await expect(status(page)).toHaveText('Using your key: AIza...rstu')
  })
})
