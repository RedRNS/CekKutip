import { fixtureSummary } from '@cekkutip/shared/testing'
import type { Page } from '@playwright/test'
import { expect, expectNoAxeViolations, expectNoHorizontalScroll, test } from './helpers'

/**
 * These tests give the page an INVENTED summary (packages/shared/src/evaluation.fixture.ts) by
 * intercepting /api/evaluation. Nothing is ever written to eval/results.
 */
const serve = (page: Page, body: unknown, status = 200) =>
  page.route('**/api/evaluation', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  )

const BLOCK = /<script id="cekkutip-evaluation"[\s\S]*?<\/script>/

/**
 * A direct visit to /evaluation gets its state inside the HTML (the server puts it there). This
 * replaces that block with `state`, or removes it (null) so the page falls back to asking the API,
 * which is what happens when the page is opened from inside the app.
 */
async function inject(page: Page, state: unknown | null) {
  await page.route(
    (url) => url.pathname === '/evaluation',
    async (route) => {
      const res = await route.fetch()
      let html = (await res.text()).replace(BLOCK, '')
      if (state !== null) {
        const lessThan = String.fromCharCode(92) + 'u003c'
        const json = JSON.stringify(state).replaceAll('<', lessThan)
        html = html.replace(
          '</head>',
          `<script id="cekkutip-evaluation" type="application/json">${json}</script></head>`,
        )
      }
      // The body was decoded, so the old encoding and length headers no longer describe it.
      const headers = Object.fromEntries(
        Object.entries(res.headers()).filter(
          ([k]) => !['content-encoding', 'content-length'].includes(k),
        ),
      )
      await route.fulfill({ status: res.status(), headers, body: html })
    },
  )
}

/** Give the page this state for a direct visit, and the same state for the API (in-app visits). */
async function show(page: Page, state: unknown) {
  await inject(page, state)
  await serve(page, state)
}

test.describe('Evaluation page with results', () => {
  test('shows every table with exactly the numbers in the file', async ({ page }) => {
    await show(page, fixtureSummary())
    await page.goto('/evaluation')

    await expect(page.getByText('No results yet')).toHaveCount(0)
    await expect(page.getByText('Results will be published after data lock')).toHaveCount(0)

    // Facts about how the results were made.
    const facts = page.getByRole('region', { name: 'How these results were made' })
    await expect(facts).toContainText('0.1.0')
    await expect(facts).toContainText('abc1234')
    await expect(facts).toContainText('gemini-test-model')
    await expect(facts).toContainText('2026-12-10')
    await expect(facts).toContainText('TAU_T 0.9, TAU_A 0.6, TAU_L 0.6, TAU_V 0.4')
    await expect(facts).toContainText('1000 resamples')
    await expect(facts).toContainText('130 references, labelled by two people') // 80 development + 50 test
    await expect(facts).toContainText('fixed seed 20261209')

    // Splits appear in a fixed order.
    const headings = await page.getByRole('heading', { level: 2 }).allInnerTexts()
    expect(headings.indexOf('Development set (used to choose the cut-offs)')).toBeGreaterThan(-1)
    expect(headings.indexOf('Development set (used to choose the cut-offs)')).toBeLessThan(
      headings.indexOf('Test set (run once, after the cut-offs were frozen)'),
    )

    const main = page.getByRole('table', {
      name: 'Main comparison, Test set (run once, after the cut-offs were frozen)',
    })
    const rows = main.locator('tbody tr')
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(0).getByRole('rowheader')).toHaveText('CekKutip, full pipeline')
    await expect(rows.nth(1).getByRole('rowheader')).toHaveText('A1: no abstain')
    await expect(rows.nth(2).getByRole('rowheader')).toHaveText('B1: language model only')
    await expect(rows.nth(3).getByRole('rowheader')).toHaveText('B3: DOI check')

    const full = rows.nth(0)
    await expect(full).toContainText('0.813 [0.700, 0.900]') // macro-F1 with its interval
    await expect(full).toContainText('0.063 [0.020, 0.120]') // false accusation rate
    await expect(full).toContainText('of 32 real or unindexed')
    await expect(full).toContainText('0.250 [0.150, 0.350]') // abstain rate
    await expect(full.locator('td').nth(4)).toHaveText('2') // could not check: a column of its own

    // Time and cost are a separate table, so the main one fits without scrolling on a desktop.
    const time = page.getByRole('table', {
      name: 'Time and cost, Test set (run once, after the cut-offs were frozen)',
    })
    await expect(time.locator('tbody tr').nth(0)).toContainText('2,300') // median time
    await expect(time.locator('tbody tr').nth(0)).toContainText('0.400') // cost per 1,000
    await expect(time.locator('tbody tr').nth(3)).toContainText('n/a') // no cost: no model was used

    // Per-verdict F1, with verdict names that are never translated.
    const f1 = page.getByRole('table', { name: /^F1 for each verdict, Test set/ })
    await expect(f1.getByRole('columnheader')).toHaveText([
      'System',
      'Verified',
      'Mismatch',
      'Suspect',
      'Out-of-index',
    ])
    await expect(f1.locator('tbody tr').first()).toContainText('0.900')

    // Ablations are shown as a change against the full pipeline.
    const abl = page.getByRole('table', { name: /^Ablations, Test set/ })
    await expect(abl.locator('tbody tr')).toHaveCount(2)
    await expect(abl.locator('tbody tr').nth(1)).toContainText('-0.100') // 0.7125 against 0.8125
    await expect(abl.locator('tbody tr').nth(1)).toContainText('+0.250') // false accusation rate

    // With and without altered references.
    const syn = page.getByRole('table', { name: /^With and without altered references, Test set/ })
    await expect(syn.locator('tbody tr').first()).toContainText('0.863 [0.750, 0.950]')

    // The dev split has no ablations, so it has no ablation table.
    await expect(page.getByRole('table', { name: /^Ablations, Development set/ })).toHaveCount(0)

    // Labeler agreement.
    await expect(page.getByText('Cohen kappa 0.857 on 130 references')).toBeVisible()
    const kappa = page.getByRole('table', { name: /Labeler 1 \(rows\) against labeler 2/ })
    await expect(kappa.getByRole('row', { name: /^Verified/ })).toContainText('40')

    // The explanation sections are still there, with the heading in the past tense.
    await expect(page.getByRole('heading', { name: 'What we report' })).toBeVisible()
  })

  test('numbers follow the language: a decimal comma in Indonesian, verdict names untouched', async ({
    page,
  }) => {
    await show(page, fixtureSummary())
    await page.addInitScript("try { localStorage.setItem('cekkutip.lang', 'id') } catch {}")
    await page.goto('/evaluation')
    const main = page.getByRole('table', { name: /^Perbandingan utama, Set uji/ })
    await expect(main.locator('tbody tr').first()).toContainText('0,813 [0,700, 0,900]')
    const waktu = page.getByRole('table', { name: /^Waktu dan biaya, Set uji/ })
    await expect(waktu.locator('tbody tr').first()).toContainText('2.300') // a thousands dot in Indonesian
    await expect(main.locator('tbody tr').first()).toContainText(
      'dari 32 yang nyata atau tidak terindeks',
    )
    await expect(
      page
        .getByRole('table', { name: /^F1 untuk tiap verdict/ })
        .getByRole('columnheader')
        .nth(1),
    ).toHaveText('Verified')
    await expect(page.getByText('Kappa Cohen 0,857 pada 130 referensi')).toBeVisible()
  })

  test('no axe violations, tables scroll inside their own box, and the page does not scroll sideways at 375 px', async ({
    page,
  }) => {
    await show(page, fixtureSummary())
    await page.goto('/evaluation')
    await expectNoAxeViolations(page)
    await page.setViewportSize({ width: 375, height: 700 })
    await expectNoHorizontalScroll(page)
    const region = page.getByRole('region', { name: /^Main comparison, Test set/ })
    const scrolls = await region.evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(scrolls).toBe(true) // the table is wider than the screen, so it scrolls in its box
    await region.focus()
    await expect(region).toBeFocused() // and a keyboard user can reach it
    await expectNoAxeViolations(page)
  })
})

test.describe('Evaluation page without real results', () => {
  const noNumbers = async (page: Page) => {
    await expect(
      page.getByText('Results will be published after data lock on 9 December 2026.'),
    ).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    const main = await page.getByRole('main').innerText()
    expect(main).not.toMatch(/\d\.\d/)
    await expect(page.getByRole('main').locator('svg, canvas, img')).toHaveCount(0)
  }

  test('a summary made from the template data is ignored', async ({ page }) => {
    await show(page, fixtureSummary({ sample: true }))
    await page.goto('/evaluation')
    await noNumbers(page)
  })

  test('an incomplete or invalid summary is ignored', async ({ page }) => {
    await show(page, { sample: false, runs: [{ name: 'x' }] })
    await page.goto('/evaluation')
    await noNumbers(page)
  })

  test('a failed request, an unexpected 404, and a server error all show the empty state', async ({
    page,
  }) => {
    await inject(page, null)
    await page.route('**/api/evaluation', (route) => route.abort('connectionfailed'))
    await page.goto('/evaluation')
    await noNumbers(page)
    await page.unroute('**/api/evaluation')
    await serve(page, { available: false })
    await page.reload()
    await noNumbers(page)
    await page.unroute('**/api/evaluation')
    await serve(page, { error: { code: 'not_found', message: 'x' } }, 404)
    await page.reload()
    await noNumbers(page)
    await page.unroute('**/api/evaluation')
    await serve(page, 'not an object', 500)
    await page.reload()
    await noNumbers(page)
  })

  test('the real server has no results yet, so the real page shows the empty state', async ({
    page,
  }) => {
    await page.goto('/evaluation')
    await noNumbers(page)
    const res = await page.request.get('/api/evaluation')
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ available: false })
  })

  test('while loading, the page says so and shows no numbers', async ({ page }) => {
    await inject(page, null)
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/evaluation', async (route) => {
      await gate
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    })
    // This request is held open on purpose, so the network never goes idle: do not wait for it.
    await page.goto('/evaluation', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('status').filter({ hasText: 'Loading results' })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    release()
    await expect(page.getByText('Results will be published after data lock')).toBeVisible()
  })

  test('a direct visit has no loading state, makes no extra request, and nothing moves after it paints', async ({
    page,
  }) => {
    const apiCalls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/evaluation')) apiCalls.push(r.url())
    })
    await page.addInitScript(() => {
      ;(window as unknown as { shifts: number }).shifts = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number
          hadRecentInput: boolean
        }[]) {
          if (!e.hadRecentInput) (window as unknown as { shifts: number }).shifts += e.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/evaluation')
    await expect(page.getByText('Results will be published after data lock')).toBeVisible()
    await expect(page.getByText('Loading results')).toHaveCount(0)
    expect(apiCalls).toEqual([])
    const shifts = await page.evaluate(() => (window as unknown as { shifts: number }).shifts)
    expect(shifts).toBeLessThan(0.01)
  })
})

test.describe('Evaluation page opened from inside the app', () => {
  test('asks the API, and shows the results it gets', async ({ page }) => {
    await serve(page, fixtureSummary())
    await page.goto('/')
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Evaluation' })
      .click()
    await expect(page.getByRole('table', { name: /^Main comparison, Test set/ })).toBeVisible()
    await expect(page.getByText('No results yet')).toHaveCount(0)
  })

  test('shows the empty state when the API says there are no results', async ({ page }) => {
    await serve(page, { available: false })
    await page.goto('/')
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Evaluation' })
      .click()
    await expect(page.getByText('Results will be published after data lock')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
  })
})
