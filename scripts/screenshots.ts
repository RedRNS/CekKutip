/**
 * Take screenshots at 375, 768, and 1280 px and run axe on each state.
 * Usage: npx tsx scripts/screenshots.ts [baseUrl] [lang] [stateName...]
 * Output: docs/screenshots/<state>-<width>[-id].png
 * Also reports horizontal overflow and axe violations, so a screenshot run doubles as a smoke test.
 */
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AxeBuilder } from '@axe-core/playwright'
import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const lang = process.argv[3] ?? 'en'
const only = process.argv.slice(4)
const widths = [375, 768, 1280]
const outDir = fileURLToPath(new URL('../docs/screenshots/', import.meta.url))

interface State {
  name: string
  path: string
  prepare?: (page: Page) => Promise<void>
}

const states: State[] = [
  { name: 'home-empty', path: '/' },
  {
    name: 'home-typed',
    path: '/',
    prepare: async (page) => {
      await page.getByRole('button', { name: /try an example|coba contoh/i }).click()
    },
  },
  { name: 'how-it-works', path: '/how-it-works' },
  { name: 'evaluation-empty', path: '/evaluation' },
  { name: 'about', path: '/about' },
  { name: 'privacy', path: '/privacy' },
]

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
let problems = 0

for (const state of states.filter((s) => only.length === 0 || only.includes(s.name))) {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: lang === 'id' ? 'id-ID' : 'en-US',
      reducedMotion: 'reduce',
    })
    await context.addInitScript(`try { localStorage.setItem('cekkutip.lang', '${lang}') } catch {}`)
    const page = await context.newPage()
    await page.goto(baseUrl + state.path, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    if (state.prepare) await state.prepare(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const suffix = lang === 'en' ? '' : `-${lang}`
    await page.screenshot({ path: `${outDir}${state.name}-${width}${suffix}.png`, fullPage: true })

    const flags: string[] = []
    if (overflow > 0) flags.push(`horizontal overflow ${overflow}px`)
    for (const v of axe.violations) flags.push(`axe ${v.impact}: ${v.id} (${v.nodes.length})`)
    if (flags.length) problems += flags.length
    console.log(`${state.name} @${width}: ${flags.length ? flags.join('; ') : 'ok'}`)
    await context.close()
  }
}

await browser.close()
console.log(problems ? `\n${problems} problem(s)` : '\nno problems')
