/**
 * Run Lighthouse (mobile profile) on every page and print one line per page.
 *
 *   npx tsx scripts/lighthouse.ts [baseUrl] [--default]
 *
 * baseUrl defaults to http://localhost:8799 (the replay server: npm run e2e:server).
 * Lighthouse is fetched with npx and is not a dependency of the project.
 *
 * Throttling: by default the CPU multiplier is 1, because Lighthouse measures this computer's speed
 * ("benchmarkIndex") and the stock 4x CPU slowdown assumes a fast desktop. On a slower computer the
 * stock setting double-counts and gives a score that is too low. Pass --default for the stock settings.
 * The benchmark of the run is printed so a reader can judge. For the final number, run PageSpeed
 * Insights on the deployed URL.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:8799').replace(/\/$/, '')
const stock = args.includes('--default')
const pages = ['', 'how-it-works', 'evaluation', 'about', 'privacy']
const dir = mkdtempSync(path.join(tmpdir(), 'cekkutip-lh-'))
const chrome = chromium.executablePath()

interface LhReport {
  runtimeError?: unknown
  environment: { benchmarkIndex: number }
  categories: Record<string, { score: number }>
  audits: Record<string, { displayValue?: string }>
}

const rows: string[] = []
let bench: number | null = null
for (const p of pages) {
  const out = path.join(dir, `${p || 'home'}.json`)
  let report: LhReport | null = null
  for (let attempt = 0; attempt < 3 && !report; attempt++) {
    spawnSync(
      'npx',
      [
        '-y',
        'lighthouse@13.6.0',
        `${base}/${p}`,
        '--quiet',
        '--output=json',
        `--output-path=${out}`,
        '--only-categories=performance,accessibility,best-practices,seo',
        ...(stock ? [] : ['--throttling.cpuSlowdownMultiplier=1']),
        '--chrome-flags=--headless=old',
      ],
      { shell: true, env: { ...process.env, CHROME_PATH: chrome }, stdio: 'ignore' },
    )
    try {
      const r = JSON.parse(readFileSync(out, 'utf8')) as LhReport
      if (!r.runtimeError) report = r // Lighthouse sometimes fails to record a trace: just run it again
    } catch {
      /* no report written */
    }
  }
  if (!report) {
    rows.push(`${(p || 'home').padEnd(13)} FAILED to measure`)
    continue
  }
  bench = report.environment.benchmarkIndex
  const c = report.categories
  const a = report.audits
  const s = (k: string) => Math.round(c[k].score * 100)
  rows.push(
    `${(p || 'home').padEnd(13)} Performance ${s('performance')}  Accessibility ${s('accessibility')}  Best Practices ${s('best-practices')}  SEO ${s('seo')}` +
      `   FCP ${a['first-contentful-paint'].displayValue}  LCP ${a['largest-contentful-paint'].displayValue}  TBT ${a['total-blocking-time'].displayValue}  CLS ${a['cumulative-layout-shift'].displayValue}`,
  )
}
rmSync(dir, { recursive: true, force: true })
console.log(
  `Lighthouse mobile profile, ${stock ? 'stock throttling' : 'CPU multiplier 1'}, host benchmarkIndex ${bench} (a typical desktop is 1000 or more)`,
)
console.log(rows.join('\n'))
