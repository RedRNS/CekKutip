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
import type { Page } from '@playwright/test'

const A = 'Alpha, A. (2020). One.'
const B = 'Beta, B. (2021). Two.'
const C = 'Gamma, C. (2022). Three.'

const summary = (page: Page) => page.getByText(/^Review how your list was split/)
const item = (page: Page, n: number) => page.getByRole('listitem', { name: `Reference ${n}` })

async function openPreview(page: Page, text: string) {
  await page.goto('/')
  await input(page).fill(text)
  await summary(page).click()
}

test.describe('split preview', () => {
  test('is absent until there is something to show, and shows the count', async ({ page }) => {
    await page.goto('/')
    await expect(summary(page)).toHaveCount(0)
    await input(page).fill(`${A}\n${B}`)
    await expect(summary(page)).toHaveText('Review how your list was split (2)')
  })

  test('lists each detected reference, numbered, with what each button does', async ({ page }) => {
    await openPreview(page, `${A}\n${B}\n${C}`)
    await expect(item(page, 1)).toContainText(A)
    await expect(item(page, 2)).toContainText(B)
    await expect(item(page, 3)).toContainText(C)
    // The first reference has nothing before it to merge into.
    await expect(item(page, 1).getByRole('button', { name: /Merge/ })).toHaveCount(0)
    await expect(
      item(page, 2).getByRole('button', { name: 'Merge reference 2 with reference 1' }),
    ).toBeVisible()
    await expect(item(page, 2).getByRole('button', { name: 'Edit reference 2' })).toBeVisible()
  })

  test('merging joins a reference to the previous one and updates the box and the count', async ({
    page,
  }) => {
    await openPreview(page, `${A}\n${B}\n${C}`)
    await item(page, 2)
      .getByRole('button', { name: /^Merge reference 2/ })
      .click()

    await expect(page.getByText('2 found', { exact: true })).toBeVisible()
    await expect(summary(page)).toHaveText('Review how your list was split (2)')
    await expect(item(page, 1)).toContainText(`${A} ${B}`)
    await expect(item(page, 2)).toContainText(C)
    // The box is rewritten with one reference per paragraph.
    await expect(input(page)).toHaveValue(`${A} ${B}\n\n${C}`)
    // Focus moves to the merged reference, and the change is announced.
    await expect(item(page, 1)).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'merged' })).toHaveText(
      'Reference 2 merged into reference 1. 2 found.',
    )
  })

  test('editing with a blank line splits one reference into two', async ({ page }) => {
    await openPreview(page, `${A} ${B}\n\n${C}`)
    await expect(summary(page)).toHaveText('Review how your list was split (2)')

    await item(page, 1).getByRole('button', { name: 'Edit reference 1' }).click()
    const editor = page.getByRole('textbox', { name: 'Edit reference 1' })
    await expect(editor).toBeFocused()
    await expect(editor).toHaveValue(`${A} ${B}`)
    await editor.fill(`${A}\n\n${B}`)
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(summary(page)).toHaveText('Review how your list was split (3)')
    await expect(item(page, 1)).toContainText(A)
    await expect(item(page, 2)).toContainText(B)
    await expect(input(page)).toHaveValue(`${A}\n\n${B}\n\n${C}`)
    await expect(item(page, 1)).toBeFocused()
  })

  test('clearing the text of a reference removes it', async ({ page }) => {
    await openPreview(page, `${A}\n${B}\n${C}`)
    await item(page, 2).getByRole('button', { name: 'Edit reference 2' }).click()
    await page.getByRole('textbox', { name: 'Edit reference 2' }).fill('')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(summary(page)).toHaveText('Review how your list was split (2)')
    await expect(input(page)).toHaveValue(`${A}\n\n${C}`)
  })

  test('removing the last reference leaves focus on a reference that still exists', async ({
    page,
  }) => {
    await openPreview(page, `${A}\n${B}`)
    await item(page, 2).getByRole('button', { name: 'Edit reference 2' }).click()
    await page.getByRole('textbox', { name: 'Edit reference 2' }).fill('')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(item(page, 1)).toBeFocused()
  })

  test('cancel leaves the list and the box as they were', async ({ page }) => {
    await openPreview(page, `${A}\n\n${B}`)
    await item(page, 1).getByRole('button', { name: 'Edit reference 1' }).click()
    await page.getByRole('textbox', { name: 'Edit reference 1' }).fill('something else entirely')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(item(page, 1)).toContainText(A)
    await expect(input(page)).toHaveValue(`${A}\n\n${B}`)
    await expect(item(page, 1)).toBeFocused()
  })

  test('numbers are stripped on the first change, and the list reads the same afterwards', async ({
    page,
  }) => {
    await openPreview(page, `1. ${A}\n2. ${B}`)
    await item(page, 2).getByRole('button', { name: 'Edit reference 2' }).click()
    await page.getByRole('button', { name: 'Apply' }).click() // no change to the text
    await expect(input(page)).toHaveValue(`${A}\n\n${B}`)
    await expect(summary(page)).toHaveText('Review how your list was split (2)')
  })

  test('a list repaired in the preview is the list that gets checked', async ({ page }) => {
    // Two real example references stuck together as one.
    const [first, second] = EXAMPLES
    const stuck = `${first?.text} ${second?.text}`
    await openPreview(page, stuck)
    await expect(summary(page)).toHaveText('Review how your list was split (1)')

    await item(page, 1).getByRole('button', { name: 'Edit reference 1' }).click()
    await page
      .getByRole('textbox', { name: 'Edit reference 1' })
      .fill(`${first?.text}\n\n${second?.text}`)
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('2 found', { exact: true })).toBeVisible()

    await checkButton(page).click()
    await expect(page.getByText('2 of 2 checked')).toBeVisible()
    await expect(rows(page).nth(0).locator('.verdict')).toHaveText('Verified')
    await expect(rows(page).nth(1).locator('.verdict')).toHaveText('Mismatch')
  })

  test('merging two examples and splitting them again restores the count', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try an example' }).click()
    await summary(page).click()
    await expect(summary(page)).toHaveText('Review how your list was split (10)')
    // Merge then split back: the list is the same ten references.
    await item(page, 2)
      .getByRole('button', { name: /^Merge reference 2/ })
      .click()
    await expect(summary(page)).toHaveText('Review how your list was split (9)')
    await item(page, 1).getByRole('button', { name: 'Edit reference 1' }).click()
    const editor = page.getByRole('textbox', { name: 'Edit reference 1' })
    const [first, second] = EXAMPLES
    await editor.fill(`${first?.text}\n\n${second?.text}`)
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(summary(page)).toHaveText('Review how your list was split (10)')
  })

  test('has no accessibility violations while editing, and does not overflow on a phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await openPreview(page, `${A}\n${B}\n${C}`)
    await item(page, 2).getByRole('button', { name: 'Edit reference 2' }).click()
    await expectNoAxeViolations(page)
    await expectNoHorizontalScroll(page)
  })

  test('works in Indonesian', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Switch to Bahasa Indonesia' }).click()
    await page.getByRole('textbox', { name: 'Referensi' }).fill(`${A}\n${B}`)
    await page.getByText(/^Periksa cara daftarmu dipecah/).click()
    await page.getByRole('button', { name: 'Gabungkan referensi 2 dengan referensi 1' }).click()
    await expect(page.getByText('1 terdeteksi', { exact: true })).toBeVisible()
  })
})
