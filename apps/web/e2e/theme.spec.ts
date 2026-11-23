import type { Page } from '@playwright/test'
import {
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  input,
  rows,
  runExample,
  test,
} from './helpers'

const DARK_PAPER = 'rgb(14, 25, 29)' // #0e191d
const LIGHT_PAPER = 'rgb(246, 248, 247)' // #f6f8f7

const PAGES = ['/', '/format', '/how-it-works', '/evaluation', '/extension', '/about', '/privacy']

const paper = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const dataTheme = (page: Page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-theme'))
const storedChoice = (page: Page) => page.evaluate(() => localStorage.getItem('cekkutip.theme'))

const toDark = (page: Page) => page.getByRole('button', { name: 'Switch to dark mode' })
const toLight = (page: Page) => page.getByRole('button', { name: 'Switch to light mode' })

test.describe('dark mode follows the system', () => {
  test.use({ colorScheme: 'dark' })

  for (const path of PAGES) {
    test(`${path} is dark, has no accessibility violations, and fits a phone`, async ({ page }) => {
      await page.goto(path)
      expect(await paper(page)).toBe(DARK_PAPER)
      expect(await dataTheme(page)).toBeNull() // nothing was chosen: the stylesheet follows the system
      await expectNoAxeViolations(page)
      await page.setViewportSize({ width: 375, height: 700 })
      await expectNoHorizontalScroll(page)
    })
  }

  test('check results of every verdict, and an open evidence panel, keep their contrast', async ({
    page,
  }) => {
    await runExample(page)
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Show details for reference 2' }).click()
    await expect(rows(page).nth(1).locator('.evidence')).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('the Format page with results, and the file drop message, keep their contrast', async ({
    page,
  }) => {
    await page.goto('/format')
    await page.getByRole('button', { name: 'Try an example' }).click()
    await expect(page.locator('.fmt-list > li')).toHaveCount(5)
    await expectNoAxeViolations(page)
  })

  test('the switch offers light, and the verdicts still say what they are in words', async ({
    page,
  }) => {
    await runExample(page)
    await expect(toLight(page)).toBeVisible()
    const first = rows(page).first().locator('.verdict')
    await expect(first).toHaveText('Verified')
  })
})

test.describe('the switch', () => {
  test.use({ colorScheme: 'light' })

  test('moves to dark, keeps the choice after a reload, and moves back', async ({ page }) => {
    await page.goto('/')
    expect(await paper(page)).toBe(LIGHT_PAPER)

    await toDark(page).click()
    expect(await paper(page)).toBe(DARK_PAPER)
    expect(await dataTheme(page)).toBe('dark')
    expect(await storedChoice(page)).toBe('dark')
    await expect(toLight(page)).toBeVisible()
    await expectNoAxeViolations(page)

    await page.reload()
    expect(await paper(page)).toBe(DARK_PAPER)
    expect(await dataTheme(page)).toBe('dark')

    await toLight(page).click()
    expect(await paper(page)).toBe(LIGHT_PAPER)
    expect(await storedChoice(page)).toBe('light')
  })

  test('is applied before the page is drawn: the script is in the head and does not wait', async ({
    page,
  }) => {
    await page.goto('/')
    const script = page.locator('head > script[src="/theme.js"]')
    await expect(script).toHaveCount(1)
    expect(await script.getAttribute('defer')).toBeNull()
    expect(await script.getAttribute('async')).toBeNull()
    expect(await script.getAttribute('type')).toBeNull()
  })

  test('a choice saved earlier is in place by the time the page loads', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cekkutip.theme', 'dark'))
    await page.goto('/about')
    expect(await dataTheme(page)).toBe('dark')
    expect(await paper(page)).toBe(DARK_PAPER)
  })

  test('ignores a saved value that is not light or dark', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cekkutip.theme', 'purple'))
    await page.goto('/')
    expect(await dataTheme(page)).toBeNull()
    expect(await paper(page)).toBe(LIGHT_PAPER)
  })

  test('works without any storage', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked')
        },
      })
    })
    await page.goto('/')
    await toDark(page).click()
    expect(await paper(page)).toBe(DARK_PAPER)
  })

  test('has a name in each language', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Switch to Bahasa Indonesia' }).click()
    await expect(page.getByRole('button', { name: 'Ganti ke mode gelap' })).toBeVisible()
    await page.getByRole('button', { name: 'Ganti ke mode gelap' }).click()
    await expect(page.getByRole('button', { name: 'Ganti ke mode terang' })).toBeVisible()
  })

  test('is reachable with the keyboard and fits in the header on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/')
    await toDark(page).focus()
    await page.keyboard.press('Enter')
    expect(await dataTheme(page)).toBe('dark')
    await expectNoHorizontalScroll(page)
    const box = await toLight(page).boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  })
})

test.describe('the person chooses against the system', () => {
  test('light wins over a dark system, for the page and for the controls', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    expect(await paper(page)).toBe(DARK_PAPER)
    await toLight(page).click()
    expect(await paper(page)).toBe(LIGHT_PAPER)
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
    ).toBe('light')
    await expectNoAxeViolations(page)
  })

  test('the system changing while nothing is chosen changes the page', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(toDark(page)).toBeVisible()
    await page.emulateMedia({ colorScheme: 'dark' })
    expect(await paper(page)).toBe(DARK_PAPER)
    await expect(toLight(page)).toBeVisible() // the switch follows, and offers the other way
  })
})

test.describe('print', () => {
  test('stays dark-free: black on white, whatever the screen shows', async ({ page }) => {
    await page.goto('/')
    await toDark(page).click()
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return { paper: s.getPropertyValue('--paper').trim(), ink: s.getPropertyValue('--ink').trim() }
    })
    expect(tokens).toEqual({ paper: '#f6f8f7', ink: '#12232e' })
    expect(await paper(page)).toBe('rgb(255, 255, 255)')
  })
})

test('the check still works in dark mode, from typing to a result', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await input(page).fill('Doe, J. (2022). A made-up article. Journal of Nothing, 1(1), 1-2.')
  await page.getByRole('button', { name: /^Check references/ }).click()
  await expect(page.getByText('1 of 1 checked')).toBeVisible()
  await expectNoAxeViolations(page)
})
