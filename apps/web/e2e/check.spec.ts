import { readFile } from 'node:fs/promises'
import {
  checkButton,
  expect,
  EXPECTED,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  filters,
  input,
  rows,
  runExample,
  test,
  UNRECORDED,
} from './helpers'

test.describe('checking a list', () => {
  test('the first screen is the tool, with a useful empty state', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Check a reference list before you submit it.',
    )
    await expect(input(page)).toBeVisible()
    await expect(checkButton(page)).toBeDisabled()
    await expect(page.getByText('0 found')).toBeVisible()
    // The empty results panel explains the four verdicts instead of showing an illustration.
    const results = page.getByRole('region', { name: 'Results' })
    for (const v of ['Verified', 'Mismatch', 'Suspect', 'Out-of-index']) {
      await expect(results.getByText(v, { exact: true })).toBeVisible()
    }
    await expect(results.getByText('Verdicts are prompts for review')).toBeVisible()
  })

  test('example flow: paste, check, one verdict per reference', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try an example' }).click()
    await expect(page.getByText('10 found')).toBeVisible()
    await checkButton(page).click()

    await expect(page.getByText('10 of 10 checked')).toBeVisible()
    await expect(rows(page)).toHaveCount(10)
    for (const [i, verdict] of EXPECTED.entries()) {
      await expect(rows(page).nth(i).locator('.verdict')).toHaveText(verdict)
    }
    await expect(rows(page).nth(0)).toContainText(
      'Found in Crossref. Title, authors, and year agree.',
    )
    await expect(rows(page).nth(1)).toContainText('the year differs by 2 years')
    await expect(rows(page).nth(2)).toContainText('This DOI is not registered')
    await expect(rows(page).nth(4)).toContainText('This looks like a thesis')
    await expect(rows(page).nth(5)).toContainText('This DOI leads to a different work')

    await expect(filters(page).getByRole('button', { name: /Verified/ })).toContainText('3')
    await expect(filters(page).getByRole('button', { name: /Mismatch/ })).toContainText('2')
    await expect(filters(page).getByRole('button', { name: /Suspect/ })).toContainText('2')
    await expect(filters(page).getByRole('button', { name: /Out-of-index/ })).toContainText('3')
    // No "Could not check" filter when nothing failed.
    await expect(filters(page).getByRole('button', { name: /Could not check/ })).toHaveCount(0)
  })

  test('Ctrl+Enter in the text area starts the check', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try an example' }).click()
    await input(page).press('Control+Enter')
    await expect(page.getByText('10 of 10 checked')).toBeVisible()
  })

  test('the count follows the text, for numbered and unnumbered lists', async ({ page }) => {
    await page.goto('/')
    await input(page).fill(
      '1. Alpha, A. (2020). One.\n2. Beta, B. (2021). Two.\n3. Gamma, C. (2022). Three.',
    )
    await expect(page.getByText('3 found')).toBeVisible()
    await input(page).fill('Alpha, A. (2020). One.\n\nBeta, B. (2021). Two.')
    await expect(page.getByText('2 found')).toBeVisible()
  })

  test('filters narrow the ledger, from the buttons and from the bar', async ({ page }) => {
    await runExample(page)
    const mismatch = filters(page).getByRole('button', { name: /Mismatch/ })
    await mismatch.click()
    await expect(mismatch).toHaveAttribute('aria-pressed', 'true')
    await expect(rows(page)).toHaveCount(2)
    for (const row of await rows(page).all())
      await expect(row.locator('.verdict')).toHaveText('Mismatch')

    await mismatch.click() // pressing the active filter again shows everything
    await expect(rows(page)).toHaveCount(10)

    await filters(page)
      .getByRole('button', { name: /Out-of-index/ })
      .click()
    await expect(rows(page)).toHaveCount(3)
    await filters(page).getByRole('button', { name: /^All/ }).click()
    await expect(rows(page)).toHaveCount(10)

    await page.locator('.sb-seg').first().click() // the Verified segment of the bar
    await expect(rows(page)).toHaveCount(3)
  })

  test('the evidence panel compares the reference with the record', async ({ page }) => {
    await runExample(page)
    const toggle = page.getByRole('button', { name: 'Show details for reference 2' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(
      page.getByRole('button', { name: 'Hide details for reference 2' }),
    ).toHaveAttribute('aria-expanded', 'true')

    const table = page.getByRole('table', { name: 'Reference 2 compared with the record' })
    await expect(table.getByRole('columnheader', { name: 'Record found (Crossref)' })).toBeVisible()
    const year = table.getByRole('row', { name: /^Year/ })
    await expect(year).toContainText('2021')
    await expect(year).toContainText('2023')
    await expect(year).toContainText('differs by 2')
    const venue = table.getByRole('row', { name: /^Venue/ })
    await expect(venue).toContainText('Nature Communications')
    await expect(venue).toContainText('Scientific Reports')
    await expect(venue.locator('.diff')).toHaveCount(4) // every word of both venues differs
    await expect(table.getByRole('row', { name: /^Title/ })).toContainText('agree')
    await expect(table.getByRole('row', { name: /^Title/ }).locator('.diff')).toHaveCount(0)

    const evidence = rows(page).nth(1).locator('.evidence')
    await expect(evidence).toContainText('Open the record and correct the details you cited.')
    const open = evidence.getByRole('link', { name: /Open record/ })
    await expect(open).toHaveAttribute('href', 'https://doi.org/10.1038/s41598-023-41032-5')
    await expect(open).toHaveAttribute('target', '_blank')
    await expect(open).toHaveAttribute('rel', /noopener/)

    await evidence.getByText('Details', { exact: true }).click()
    await expect(evidence).toContainText('mismatch_year, mismatch_venue')
    await expect(evidence).toContainText('pattern reader, no AI')
  })

  test('an Out-of-index result offers a Google Scholar search and shows no record', async ({
    page,
  }) => {
    await runExample(page)
    await page.getByRole('button', { name: 'Show details for reference 5' }).click()
    const evidence = rows(page).nth(4).locator('.evidence')
    await expect(evidence).toContainText('No record is shown')
    await expect(evidence.getByRole('link', { name: /Open record/ })).toHaveCount(0)
    const scholar = evidence.getByRole('link', { name: /Search on Google Scholar/ })
    await expect(scholar).toHaveAttribute(
      'href',
      /^https:\/\/scholar\.google\.com\/scholar\?q=Dampak/,
    )
    await expect(scholar).toHaveAttribute('target', '_blank')
  })

  test('Export CSV downloads every result', async ({ page }) => {
    await runExample(page)
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(/^cekkutip-report-\d{4}-\d{2}-\d{2}\.csv$/)
    const csv = await readFile(await download.path(), 'utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(11)
    expect(lines[0]).toContain('no,verdict,reason_codes,explanation,reference')
    expect(lines[2]).toContain('Mismatch,mismatch_year mismatch_venue')
    expect(lines[1]).toContain('10.1038/s41598-023-41032-5')
  })

  test('Copy report puts a plain-text report on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await runExample(page)
    await page.getByRole('button', { name: 'Copy report' }).click()
    await expect(page.getByText('Copied')).toBeVisible()
    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text).toContain('CekKutip reference check')
    expect(text).toContain('2. [Mismatch] Walters, W. H., & Wilder, E. I. (2021)')
    expect(text).toContain(
      'Total 10. Verified 3. Mismatch 2. Suspect 2. Out-of-index 3. Could not check 0.',
    )
    expect(text).toContain('Verdicts are prompts for review, not findings of misconduct.')
  })

  test('Clear empties the input and the results', async ({ page }) => {
    await runExample(page)
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(input(page)).toHaveValue('')
    await expect(rows(page)).toHaveCount(0)
    await expect(page.getByText('What the four verdicts mean')).toBeVisible()
  })
})

test.describe('limits and failures', () => {
  test('more references than the limit is refused with a clear message, nothing is cut', async ({
    page,
  }) => {
    await page.goto('/')
    const many = Array.from(
      { length: 13 },
      (_, i) => `${i + 1}. Author, A. (2020). Title number ${i + 1}.`,
    )
    await input(page).fill(many.join('\n'))
    await expect(page.getByText('13 found')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveText(
      'You can check up to 12 references at a time. Split your list and check it in parts.',
    )
    await expect(checkButton(page)).toBeDisabled()
    await expect(input(page)).toHaveAttribute('aria-invalid', 'true')
  })

  test('an over-long reference is named', async ({ page }) => {
    await page.goto('/')
    await input(page).fill(`Short, A. (2020). Fine.\n\n${'x'.repeat(601)}`)
    await expect(page.getByRole('alert')).toContainText('Reference 2 is longer than 600 characters')
    await expect(checkButton(page)).toBeDisabled()
  })

  test('a lookup that cannot be answered is "Could not check", never a verdict', async ({
    page,
  }) => {
    await page.goto('/')
    await input(page).fill(UNRECORDED)
    await checkButton(page).click()
    await expect(page.getByText('1 of 1 checked')).toBeVisible()
    await expect(rows(page).first().locator('.verdict')).toHaveText('Could not check')
    await expect(rows(page).first()).toContainText('This is not a verdict. Try again.')
    await expect(filters(page).getByRole('button', { name: /Could not check/ })).toContainText('1')
    await expect(filters(page).getByRole('button', { name: /Suspect/ })).toContainText('0')
  })

  test('a network failure shows a banner that does not blame the user, and Try again works', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try an example' }).click()
    await page.route('**/api/check', (route) => route.abort('connectionfailed'))
    await checkButton(page).click()
    const banner = page.getByRole('alert')
    await expect(banner).toContainText('We could not reach the server. Your text was not stored.')
    await expectNoAxeViolations(page)

    await page.unroute('**/api/check')
    await banner.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText('10 of 10 checked')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('a stream that stops early keeps what arrived and says it is incomplete', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try an example' }).click()
    await page.route('**/api/check', async (route) => {
      const res = await route.fetch()
      const lines = (await res.text()).split('\n').filter(Boolean)
      await route.fulfill({ response: res, body: `${lines.slice(0, 4).join('\n')}\n` })
    })
    await checkButton(page).click()
    await expect(page.getByRole('alert')).toContainText('The check stopped before it finished')
    await expect(page.getByText('3 of 10 checked')).toBeVisible()
    await expect(rows(page).locator('.verdict')).toHaveCount(3)
  })

  test('a rate limit answer is explained', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try an example' }).click()
    await page.route('**/api/check', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'rate_limited', message: 'x' } }),
      }),
    )
    await checkButton(page).click()
    await expect(page.getByRole('alert')).toContainText(
      'You have reached the limit of checks for now.',
    )
  })
})

test.describe('the no-AI choice', () => {
  test('without an AI key the page says so and uses the no-AI reader', async ({ page }) => {
    await page.goto('/')
    const box = page.getByRole('checkbox', { name: /Do not send my text to an AI service/ })
    await expect(box).toBeChecked()
    await expect(box).toBeDisabled()
    await expect(page.getByText('The AI reader is not set up on this server.')).toBeVisible()
  })

  test('with AI available, the checkbox decides what is sent', async ({ page }) => {
    await page.route('**/api/config', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          maxReferences: 12,
          maxReferenceChars: 600,
          toolVersion: 't',
          aiAvailable: true,
        }),
      }),
    )
    await page.goto('/')
    const box = page.getByRole('checkbox', { name: /Do not send my text to an AI service/ })
    await expect(box).toBeEnabled()
    await expect(box).not.toBeChecked()
    await expect(page.getByText('Your text goes to Google Gemini')).toBeVisible()
    await page.getByRole('button', { name: 'Try an example' }).click()

    const modeOf = async () => {
      const request = page.waitForRequest('**/api/check')
      await checkButton(page).click()
      const body = (await request).postDataJSON() as {
        references: string[]
        options: { parseMode: string }
      }
      await expect(page.getByText('10 of 10 checked')).toBeVisible()
      expect(body.references).toHaveLength(10)
      return body.options.parseMode
    }
    expect(await modeOf()).toBe('llm')
    await box.check()
    expect(await modeOf()).toBe('regex')
  })
})

test.describe('keyboard and small screens', () => {
  test('the whole flow works with the keyboard alone, with visible focus', async ({ page }) => {
    await page.goto('/')
    const tabTo = async (name: RegExp | string, role: 'button' | 'textbox' | 'link' = 'button') => {
      const target = page.getByRole(role, { name })
      for (let i = 0; i < 40; i++) {
        if (await target.evaluate((el) => el === document.activeElement).catch(() => false))
          return target
        await page.keyboard.press('Tab')
      }
      throw new Error(`could not reach ${String(name)} with Tab`)
    }

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()

    const example = await tabTo('Try an example')
    await page.keyboard.press('Enter')
    await expect(page.getByText('10 found')).toBeVisible()
    const outline = await example.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')

    await tabTo(/^Check references/)
    await page.keyboard.press('Enter')
    await expect(page.getByText('10 of 10 checked')).toBeVisible()

    await tabTo(/Mismatch/)
    await page.keyboard.press('Space')
    await expect(rows(page)).toHaveCount(2)

    await tabTo('Show details for reference 2')
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('table', { name: 'Reference 2 compared with the record' }),
    ).toBeVisible()

    await tabTo(/Open record/, 'link')
    await tabTo('Export CSV')
  })

  test('at 375 px there is no sideways scrolling and Check stays within reach', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/')
    await expectNoHorizontalScroll(page)
    await page.getByRole('button', { name: 'Try an example' }).click()
    // With text in the box, the Check button sticks to the bottom of the screen.
    await input(page).scrollIntoViewIfNeeded()
    await expect(checkButton(page)).toBeInViewport()
    const box = await checkButton(page).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)

    await checkButton(page).click()
    await expect(page.getByText('10 of 10 checked')).toBeVisible()
    await page.getByRole('button', { name: 'Show details for reference 2' }).click()
    await expectNoHorizontalScroll(page)
    await expectNoAxeViolations(page)
  })
})

test.describe('accessibility of the results', () => {
  test('progress is announced politely and the finished state is announced once', async ({
    page,
  }) => {
    await runExample(page)
    const live = page.locator('[aria-live="polite"]').first()
    await expect(live).toHaveText('Check finished. 10 references checked.')
  })

  test('no axe violations with results and an open evidence panel', async ({ page }) => {
    await runExample(page)
    await page.getByRole('button', { name: 'Show details for reference 2' }).click()
    await page.getByRole('button', { name: 'Show details for reference 5' }).click()
    await expectNoAxeViolations(page)
  })
})
