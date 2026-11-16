import { AxeBuilder } from '@axe-core/playwright'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Verdict labels the example list must produce, in order (see src/data/example-list.ts). */
export const EXPECTED = [
  'Verified',
  'Mismatch',
  'Suspect',
  'Verified',
  'Out-of-index',
  'Mismatch',
  'Out-of-index',
  'Suspect',
  'Verified',
  'Out-of-index',
]

export const input = (page: Page) => page.getByRole('textbox', { name: 'References' })
export const checkButton = (page: Page) => page.getByRole('button', { name: /^Check references/ })
export const rows = (page: Page) => page.locator('.ledger > li')
export const filters = (page: Page) => page.getByRole('group', { name: 'Show results' })

export async function runExample(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try an example' }).click()
  await checkButton(page).click()
  await expect(page.getByText('10 of 10 checked')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible()
}

export async function expectNoAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(result.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length})`)).toEqual([])
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

/** A reference that was never recorded: in replay-only mode its lookup cannot be answered. */
export const UNRECORDED =
  'Nobody, X. (2019). A reference that is not in the recorded cache at all. Journal of Missing Things, 1(1), 1-2.'
