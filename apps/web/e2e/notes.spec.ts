import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import {
  checkButton,
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  input,
  rows,
  test,
} from './helpers'

/** A result as the server sends it, with only what a test changes. */
const result = (
  index: number,
  parsed: Record<string, unknown>,
  record: Record<string, unknown>,
) => ({
  index,
  raw: `Reference ${index + 1}, written out in full.`,
  status: 'verified',
  reasons: ['verified_all_match'],
  parsed: {
    raw: `Reference ${index + 1}`,
    authors: ['Wei', 'Wang'],
    hasEtAl: false,
    year: 2022,
    title: 'Chain-of-thought prompting',
    venue: null,
    volume: null,
    issue: null,
    pages: null,
    doi: null,
    type: 'journal_article',
    parseMode: 'regex',
    ...parsed,
  },
  record: {
    source: 'crossref',
    doi: `10.1000/own${index}`,
    url: null,
    title: 'Chain-of-thought prompting',
    authors: ['Wei', 'Wang'],
    year: 2022,
    venue: 'NeurIPS',
    volume: null,
    issue: null,
    pages: null,
    ...record,
  },
  comparison: [],
  scores: { title: 1, authors: 1, yearDiff: 0, venue: 0 },
  latencyMs: 5,
})

const SAME = '10.52202/068431-1800'
const RESULTS = [
  result(0, { year: 2023 }, { doi: SAME }),
  result(
    1,
    { authors: ['Wei'] },
    { authors: ['Wei', 'Wang', 'Schuurmans', 'Bosma', 'Ichter', 'Xia', 'Chi', 'Le', 'Zhou'] },
  ),
  result(2, {}, { doi: SAME }),
  result(3, {}, {}),
]

/** The server answers with these four results, whatever was pasted. */
async function answerWithNotes(page: Page) {
  await page.route('**/api/check', (route) => {
    const lines = [
      { type: 'started', total: RESULTS.length },
      ...RESULTS.map((r) => ({ type: 'result', result: r })),
      {
        type: 'done',
        summary: {
          total: RESULTS.length,
          verified: RESULTS.length,
          mismatch: 0,
          suspect: 0,
          outOfIndex: 0,
          checkFailed: 0,
          medianLatencyMs: 5,
          thresholds: { tauT: 0.9, tauA: 0.6, tauL: 0.6, tauV: 0.4 },
          toolVersion: 't',
        },
      },
    ]
    return route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
    })
  })
}

async function runChecks(page: Page) {
  await answerWithNotes(page)
  await page.goto('/')
  await input(page).fill(RESULTS.map((r) => r.raw).join('\n\n'))
  await checkButton(page).click()
  await expect(page.getByText('4 of 4 checked')).toBeVisible()
}

const notesOf = (page: Page, n: number) => rows(page).nth(n).locator('.row__notes li')

test.describe('notes next to a result', () => {
  test('say what the verdict does not: a year a year off, authors left out, the same record twice', async ({
    page,
  }) => {
    await runChecks(page)

    // Reference 1: the year, and the same record as 3.
    await expect(notesOf(page, 0)).toHaveCount(2)
    await expect(notesOf(page, 0).nth(0)).toContainText(
      'The year is one off: you wrote 2023, the record has 2022.',
    )
    await expect(notesOf(page, 0).nth(1)).toContainText('the same record as no. 3.')
    // The verdict is the same as without the notes.
    await expect(rows(page).nth(0).locator('.verdict')).toContainText('Verified')

    // Reference 2: the authors.
    await expect(notesOf(page, 1)).toHaveCount(1)
    await expect(notesOf(page, 1)).toContainText(
      'The record has 9 authors, and you wrote 1, with no "et al."',
    )

    // Reference 3: the other half of the pair. Reference 4: nothing to say.
    await expect(notesOf(page, 2)).toContainText('the same record as no. 1.')
    await expect(rows(page).nth(3).locator('.row__notes')).toHaveCount(0)
  })

  test('go into the CSV, in a column next to the explanation', async ({
    page,
  }) => {
    await runChecks(page)
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    const csv = readFileSync((await (await pending).path()) as string, 'utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    const header = (lines[0] as string).split(',')
    expect(header.indexOf('notes')).toBe(header.indexOf('explanation') + 1)
    expect(lines[1]).toContain('The year is one off: you wrote 2023, the record has 2022.')
    expect(lines[1]).toContain('the same record as no. 3.')
    expect(lines[4]).not.toContain('same record')
  })

  test('are written in Indonesian, with the same verdicts', async ({ page }) => {
    await runChecks(page)
    await page.getByRole('button', { name: 'Switch to Bahasa Indonesia' }).click()
    await expect(notesOf(page, 0).nth(0)).toContainText('Tahun berbeda satu: tertulis 2023, record mencatat 2022.')
    await expect(notesOf(page, 0).nth(1)).toContainText('record yang sama dengan no. 3.')
    await expect(notesOf(page, 1)).toContainText('Tertulis 1 penulis, sedangkan record mencatat 9')
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`have no accessibility violations and no sideways scroll at 375 px (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.setViewportSize({ width: 375, height: 800 })
      await runChecks(page)
      await expect(notesOf(page, 0).first()).toBeVisible()
      await expectNoAxeViolations(page)
      await expectNoHorizontalScroll(page)
    })
  }
})
