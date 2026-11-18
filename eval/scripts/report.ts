/**
 * Combine every run in <out>/runs into summary.json and report.md.
 *   npm run eval:report
 * Options: --out DIR (default eval/results, or eval/results-sample when it holds sample data).
 *
 * eval/results/summary.json is what the Evaluation page shows. If it is missing, the page shows its
 * honest empty state. Summaries made from template data carry "sample": true and are not displayed.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { OFFICIAL_RESULTS, SAMPLE_RESULTS, parseArgs } from '../lib/harness.js'
import { renderMarkdown, summarize } from '../lib/report.js'
import type { KappaFile, RunFile } from '../lib/report.js'

const args = parseArgs(process.argv.slice(2), { out: 'value' })
const out = path.resolve(
  (args.out as string | undefined) ??
    (existsSync(path.join(SAMPLE_RESULTS, 'runs')) &&
    !existsSync(path.join(OFFICIAL_RESULTS, 'runs'))
      ? SAMPLE_RESULTS
      : OFFICIAL_RESULTS),
)
const runsDir = path.join(out, 'runs')
if (!existsSync(runsDir))
  throw new Error(
    `No runs found in ${path.relative(process.cwd(), runsDir)}. Run "npm run eval" first.`,
  )

const runs: RunFile[] = readdirSync(runsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const run = JSON.parse(readFileSync(path.join(runsDir, f), 'utf8')) as RunFile & {
      predictions?: unknown
    }
    delete run.predictions // the summary carries no per-reference data
    return run
  })
if (runs.length === 0) throw new Error('No run files to summarize')

const kappaFile = path.join(out, 'kappa.json')
const kappa = existsSync(kappaFile)
  ? (JSON.parse(readFileSync(kappaFile, 'utf8')) as KappaFile)
  : null

const summary = summarize(runs, kappa)
writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8')
writeFileSync(path.join(out, 'report.md'), renderMarkdown(summary) + '\n', 'utf8')

console.log(
  `Summarized ${runs.length} run(s)${summary.sample ? '  [SAMPLE DATA: not results]' : ''}`,
)
console.log(`Wrote ${path.relative(process.cwd(), path.join(out, 'summary.json'))} and report.md`)
