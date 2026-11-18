import {
  checkButton,
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  rows,
  test,
} from './helpers'

const PAGES = [
  {
    path: '/',
    title: 'Check a reference list',
    h1: 'Check a reference list before you submit it.',
  },
  { path: '/how-it-works', title: 'How it works', h1: 'How a check works' },
  { path: '/evaluation', title: 'Evaluation', h1: 'Evaluation' },
  { path: '/about', title: 'About', h1: 'About CekKutip' },
  { path: '/privacy', title: 'Privacy', h1: 'Privacy' },
]

for (const p of PAGES) {
  test(`${p.path} loads directly, has one h1, the right title, and no axe violations`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto(p.path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1)
    await expect(page).toHaveTitle(`${p.title} · CekKutip`)
    await expectNoAxeViolations(page)
    await page.setViewportSize({ width: 375, height: 700 })
    await expectNoHorizontalScroll(page)
    expect(errors).toEqual([]) // nothing blocked by the Content Security Policy, no script errors
  })
}

test('navigation reaches every page, and Privacy is in the footer', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'How it works' }).click()
  await expect(page).toHaveURL(/\/how-it-works$/)
  await expect(nav.getByRole('link', { name: 'How it works' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await nav.getByRole('link', { name: 'Evaluation' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Evaluation')
  await nav.getByRole('link', { name: 'About' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About CekKutip')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy')
  await nav.getByRole('link', { name: 'Check' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('the Evaluation page shows no numbers before there are results', async ({ page }) => {
  await page.goto('/evaluation')
  await expect(
    page.getByText('Results will be published after data lock on 9 December 2026.'),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  const main = await page.getByRole('main').innerText()
  // The plan of metrics may name a confidence level, but there must be no measured values:
  // no decimal numbers anywhere, and no chart.
  expect(main).not.toMatch(/\d\.\d/)
  await expect(page.getByRole('main').locator('svg, canvas, img')).toHaveCount(0)
})

test('an unknown address shows the not-found page', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')
})

test.describe('language', () => {
  test('switching to Bahasa Indonesia changes text, lang, and title, but not verdict names', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByRole('button', { name: 'Switch to Bahasa Indonesia' }).click()

    await expect(page.locator('html')).toHaveAttribute('lang', 'id')
    await expect(page).toHaveTitle('Periksa daftar pustaka · CekKutip')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Periksa daftar pustaka sebelum kamu mengumpulkannya.',
    )

    await page.getByRole('button', { name: 'Coba contoh' }).click()
    await expect(page.getByText('10 terdeteksi')).toBeVisible()
    await page.getByRole('button', { name: /^Periksa referensi/ }).click()
    await expect(page.getByText('10 dari 10 diperiksa')).toBeVisible()
    await expect(rows(page).nth(1).locator('.verdict')).toHaveText('Mismatch') // not translated
    await expect(rows(page).nth(1)).toContainText('tahunnya berbeda 2 tahun')
    await expect(rows(page).nth(4)).toContainText('Ini tampaknya berupa skripsi atau tesis')
    await expectNoAxeViolations(page)

    // The choice survives a reload.
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'id')
    await page.getByRole('button', { name: 'Ganti ke English' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(checkButton(page)).toBeVisible()
  })

  test('the first visit follows the browser language', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'id-ID' })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'id')
    await context.close()
  })
})
