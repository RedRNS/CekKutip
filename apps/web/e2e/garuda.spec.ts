import { checkButton, expect, expectNoAxeViolations, input, rows, test } from './helpers'

/**
 * A journal article that Crossref and OpenAlex do not hold but Garuda does: Jurnal Informatika Polinema
 * 11(3), 2025. The answers of all three services were recorded once into apps/web/e2e/cache.
 */
const WANTORO =
  'Wantoro, A., et al. (2025). Evaluasi Kinerja Algoritma Machine Learning (ML) Menggunakan Seleksi Fitur Pada Klasifikasi Diabetes. JIP (Jurnal Inform. Polinema), 11(3).'

const GARUDA_PAGE = 'https://garuda.kemdiktisaintek.go.id/documents/detail/5105249'

test.describe('Garuda, the national index of Indonesian journals', () => {
  test('an article only Garuda holds is Verified, and the record says Garuda', async ({ page }) => {
    await page.goto('/')
    await input(page).fill(WANTORO)
    await checkButton(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    await expect(rows(page).nth(0).locator('.verdict')).toHaveText('Verified')

    await page.getByRole('button', { name: 'Show details for reference 1' }).click()
    const table = page.getByRole('table', { name: 'Reference 1 compared with the record' })
    await expect(table.getByRole('columnheader', { name: 'Record found (Garuda)' })).toBeVisible()
    await expect(table.getByRole('row', { name: /^Venue/ })).toContainText('Jurnal Informatika Polinema')
    await expect(table.getByRole('row', { name: /^Year/ })).toContainText('2025')

    const open = rows(page).nth(0).locator('.evidence').getByRole('link', { name: /Open record/ })
    await expect(open).toHaveAttribute('href', GARUDA_PAGE)
    await expect(open).toHaveAttribute('target', '_blank')
    await expect(open).toHaveAttribute('rel', /noopener/)
  })

  test('the pages that name the services mention Garuda, in English and Indonesian', async ({
    page,
  }) => {
    await page.goto('/about')
    await expect(page.getByRole('link', { name: 'Garuda' })).toHaveAttribute(
      'href',
      'https://garuda.kemdiktisaintek.go.id/',
    )
    await page.goto('/privacy')
    await expect(page.getByText('is also sent, alone, to Garuda')).toBeVisible()
    await page.getByRole('button', { name: 'Switch to Bahasa Indonesia' }).click()
    await expect(page.getByText('dikirim juga, sendirian, ke Garuda')).toBeVisible()
    await expectNoAxeViolations(page)
  })
})
