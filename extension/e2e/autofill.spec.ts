import type { BrowserContext, Page } from '@playwright/test'
import { SITE, expect, openPanel, testAllSites } from './fixtures'

/*
 * The opt-in setting that fills the box from a selection on a web page.
 *
 * These tests use a build that may already read ordinary pages (a localhost-only test build): a test
 * cannot answer the browser's permission question. The question itself, and the permission being
 * given back when the setting is turned off, are not covered here. Everything else is the real thing:
 * the page script, the messages, and the side panel.
 */

const LABEL = 'Fill the box when I select text on a page'
const toggle = (page: Page) => page.getByRole('checkbox', { name: LABEL })
const references = (page: Page) => page.getByRole('textbox', { name: 'References' })

/** A page to select on: the website's About page, which has paragraphs and list items. */
async function openArticle(context: BrowserContext) {
  const article = await context.newPage()
  await article.goto(`${SITE}/about`)
  await article.bringToFront()
  return article
}

/** Selects the text of an element the way a person does: press, select, release. */
async function select(page: Page, selector: string) {
  return page.evaluate((css) => {
    const el = document.querySelector(css) as HTMLElement
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    const range = document.createRange()
    range.selectNodeContents(el)
    const selection = getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    return selection.toString().trim()
  }, selector)
}

async function turnOn(panel: Page) {
  await toggle(panel).click() // the box changes when the browser has answered, so no check()
  await expect(panel.getByText(/^On\. Select a sentence/)).toBeVisible()
}

testAllSites.describe('filling the box from a selection on a page', () => {
  testAllSites(
    'is off until the person turns it on, and then fills the box',
    async ({ page, context, extensionId }) => {
      await openPanel(page, extensionId)
      await expect(toggle(page)).not.toBeChecked()
      const article = await openArticle(context)

      const before = await select(article, 'main p')
      expect(before.split(/\s+/).length).toBeGreaterThan(3)
      await article.waitForTimeout(800)
      await expect(references(page)).toHaveValue('') // off: nothing was taken

      await turnOn(page)
      await article.bringToFront()
      // The page was already open when it was turned on, and it still gets the script.
      const text = await select(article, 'main p')
      await expect(references(page)).toHaveValue(text)
      // Nothing was sent: the person still chooses "Check references".
      await expect(page.locator('.progress')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Check references/ })).toBeEnabled()
    },
  )

  testAllSites(
    'follows what the person selects next, as long as the box holds the last selection',
    async ({ page, context, extensionId }) => {
      await openPanel(page, extensionId)
      await turnOn(page)
      const article = await openArticle(context)
      const first = await select(article, 'main p')
      await expect(references(page)).toHaveValue(first)
      const second = await select(article, 'main ul li')
      expect(second).not.toBe(first)
      await expect(references(page)).toHaveValue(second)
      await expect(page.locator('.selection-offer')).toHaveCount(0)
    },
  )

  testAllSites(
    "never puts a selection over the person's own text: it offers it, and the person chooses",
    async ({ page, context, extensionId }) => {
      await openPanel(page, extensionId)
      await turnOn(page)
      await references(page).fill('My own list of references')
      const article = await openArticle(context)

      const first = await select(article, 'main p')
      const offer = page.locator('.selection-offer')
      await expect(offer).toContainText('Your own text is in the box')
      await expect(offer).toContainText(first.slice(0, 20))
      await expect(references(page)).toHaveValue('My own list of references')

      await page.getByRole('button', { name: 'Ignore' }).click()
      await expect(offer).toHaveCount(0)
      await expect(references(page)).toHaveValue('My own list of references')

      const second = await select(article, 'main ul li')
      await page.getByRole('button', { name: 'Add to the box' }).click()
      await expect(references(page)).toHaveValue(`My own list of references\n\n${second}`)

      const third = await select(article, 'main p')
      await page.getByRole('button', { name: 'Replace the box' }).click()
      await expect(references(page)).toHaveValue(third)
    },
  )

  testAllSites(
    'ignores a word picked by a double click, and text selected inside a form field',
    async ({ page, context, extensionId }) => {
      await openPanel(page, extensionId)
      await turnOn(page)
      const article = await openArticle(context)

      await select(article, 'h1') // two words
      // A form field holds what the person typed, not what they are reading.
      await article.evaluate(() => {
        const field = document.createElement('textarea')
        field.value = 'Doe, J. (2020). Something the person typed in a form.'
        document.body.append(field)
        field.focus()
        field.select()
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      })
      await article.waitForTimeout(800)
      await expect(references(page)).toHaveValue('')
    },
  )

  testAllSites(
    'stops at once when it is turned off, even on a page that already has the script',
    async ({ page, context, extensionId, worker }) => {
      await openPanel(page, extensionId)
      await turnOn(page)
      const article = await openArticle(context)
      await select(article, 'main p')
      await expect(references(page)).not.toHaveValue('')

      await page.bringToFront()
      await toggle(page).click()
      await expect(toggle(page)).not.toBeChecked()
      await expect(page.getByText(/^On\./)).toHaveCount(0)
      await expect
        .poll(() => worker.evaluate(() => chrome.scripting.getRegisteredContentScripts()))
        .toEqual([])
      await references(page).fill('')
      await article.bringToFront()
      await select(article, 'main ul li')
      await article.waitForTimeout(800)
      await expect(references(page)).toHaveValue('')
    },
  )

  testAllSites(
    'remembers the choice when the panel is closed and opened again',
    async ({ page, extensionId }) => {
      await openPanel(page, extensionId)
      await turnOn(page)
      await openPanel(page, extensionId)
      await expect(toggle(page)).toBeChecked()
    },
  )

  testAllSites(
    'says what it needs, in both languages, before it is turned on',
    async ({ page, extensionId }) => {
      await openPanel(page, extensionId)
      await expect(page.getByText(/Off by default\. Turning it on asks your browser/)).toBeVisible()
      await page.getByRole('button', { name: /Switch to Bahasa Indonesia/ }).click()
      await expect(
        page.getByRole('checkbox', { name: 'Isi kotak saat aku memilih teks di halaman' }),
      ).toBeVisible()
      await expect(page.getByText(/Mati secara bawaan/)).toBeVisible()
    },
  )
})
