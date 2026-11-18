import { expect, EXPECTED, filters, input, rows, runExample, test } from './helpers'

test.describe('print stylesheet', () => {
  test('on screen, the print heading is not shown', async ({ page }) => {
    await runExample(page)
    await expect(page.locator('.print-head')).toBeHidden()
  })

  test('printing the results gives a dated heading with the totals and the cut-offs used', async ({
    page,
  }) => {
    await runExample(page)
    await page.emulateMedia({ media: 'print' })
    const head = page.locator('.print-head')
    await expect(head).toBeVisible()
    await expect(head.locator('.print-head__title')).toHaveText('CekKutip reference check')
    await expect(head).toContainText(/\d{4}-\d{2}-\d{2}/)
    await expect(head).toContainText(
      'Total 10. Verified 3. Mismatch 2. Suspect 2. Out-of-index 3. Could not check 0.',
    )
    await expect(head).toContainText(/CekKutip .*Cut-offs: title 0\.9/)
  })

  test('leaves out everything that is not a result', async ({ page }) => {
    await runExample(page)
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.site-header')).toBeHidden()
    await expect(page.locator('.site-footer')).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toBeHidden()
    await expect(input(page)).toBeHidden()
    await expect(page.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'The four verdicts' })).toBeHidden()
    await expect(page.getByRole('heading', { name: 'How a check works' })).toBeHidden()
    await expect(filters(page)).toBeHidden()
    // What stays: the printed heading, every row, and the disclaimer.
    await expect(page.locator('.print-head')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeHidden()
    await expect(rows(page)).toHaveCount(10)
    await expect(page.locator('.results-statement')).toContainText(
      'Verdicts are prompts for review',
    )
    await expect(page.locator('.results-statement')).toBeVisible()
  })

  test('every row keeps its verdict word, and shows the whole reference', async ({ page }) => {
    await runExample(page)
    await page.emulateMedia({ media: 'print' })
    for (const [i, verdict] of EXPECTED.entries()) {
      await expect(rows(page).nth(i).locator('.verdict')).toBeVisible()
      await expect(rows(page).nth(i).locator('.verdict')).toHaveText(verdict)
    }
    // On screen a reference is cut to two lines. On paper it is not.
    const raw = rows(page).nth(0).locator('.row__raw')
    expect(await raw.evaluate((el) => getComputedStyle(el).overflow)).toBe('visible')
    expect(await raw.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
  })

  test('a verdict frame keeps its style without color: solid, dashed, dotted', async ({ page }) => {
    await runExample(page)
    await page.emulateMedia({ media: 'print' })
    const style = (n: number) =>
      rows(page)
        .nth(n)
        .locator('.verdict')
        .evaluate((el) => getComputedStyle(el).borderTopStyle)
    expect(await style(0)).toBe('solid') // Verified
    expect(await style(4)).toBe('dashed') // Out-of-index
  })

  test('an open evidence panel prints the record link as an address', async ({ page }) => {
    await runExample(page)
    await page.getByRole('button', { name: 'Show details for reference 2' }).click()
    await page.emulateMedia({ media: 'print' })
    const link = rows(page)
      .nth(1)
      .locator('.evidence')
      .getByRole('link', { name: /Open record/ })
    await expect(link).toBeVisible()
    const after = await link.evaluate((el) => getComputedStyle(el, '::after').content)
    expect(after).toContain('https://doi.org/10.1038/s41598-023-41032-5')
    // The copy button is a screen control, so it is not printed.
    await expect(page.getByRole('button', { name: 'Copy reference' })).toHaveCount(0)
    await expect(rows(page).nth(1).locator('.corrected__text')).toBeVisible()
  })

  test('a filtered list says it is filtered', async ({ page }) => {
    await runExample(page)
    await filters(page)
      .getByRole('button', { name: /Mismatch/ })
      .click()
    await page.emulateMedia({ media: 'print' })
    await expect(rows(page)).toHaveCount(2)
    await expect(page.locator('.print-head')).toContainText(
      'Showing only Mismatch results: 2 of 10.',
    )
  })

  test('the printed report is a short PDF, not a long scroll', async ({ page }) => {
    await runExample(page)
    const pdf = await page.pdf({ format: 'A4', printBackground: false })
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []
    expect(pdf.length).toBeGreaterThan(1000)
    expect(pages.length).toBeGreaterThanOrEqual(1)
    expect(pages.length).toBeLessThanOrEqual(3)
  })

  test('another page prints its content without the site header and footer', async ({ page }) => {
    await page.goto('/privacy')
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible()
    await expect(page.locator('.site-header')).toBeHidden()
    await expect(page.locator('.site-footer')).toBeHidden()
  })

  test('the printed heading is in Indonesian when the page is', async ({ page }) => {
    await runExample(page)
    await page.getByRole('button', { name: 'Switch to Bahasa Indonesia' }).click()
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.print-head__title')).toHaveText('Pemeriksaan referensi CekKutip')
    await expect(page.locator('.print-head')).toContainText('Tidak bisa diperiksa 0.')
  })
})
