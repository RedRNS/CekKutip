/**
 * Render the site icon (apps/web/public/favicon.svg) to the PNG sizes a browser extension needs.
 * Run once; the PNGs are committed in extension/icons.   npx tsx scripts/make-extension-icons.ts
 */
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const svg = readFileSync(path.join(root, 'apps/web/public/favicon.svg'), 'utf8')
const outDir = path.join(root, 'extension/icons')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  )
  await page.screenshot({
    path: path.join(outDir, `${size}.png`),
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  })
  await page.close()
}
await browser.close()
console.log('icons written to extension/icons')
