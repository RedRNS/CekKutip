/**
 * Cohen's kappa between labeler1 and labeler2, with the agreement matrix.
 *   npm run eval:kappa
 * Options: --data FILE, --out DIR. Rows without two labels are left out and counted.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Verdict } from '@cekkutip/shared'
import { GOLD_LABELS, loadDataset } from '../lib/dataset.js'
import {
  DEFAULT_DATA,
  OFFICIAL_RESULTS,
  SAMPLE_RESULTS,
  TEMPLATE_DATA,
  parseArgs,
} from '../lib/harness.js'
import { cohenKappa } from '../lib/metrics.js'
import type { KappaFile } from '../lib/report.js'

const args = parseArgs(process.argv.slice(2), { data: 'value', out: 'value' })
const dataFile = path.resolve(
  (args.data as string | undefined) ?? (existsSync(DEFAULT_DATA) ? DEFAULT_DATA : TEMPLATE_DATA),
)
const dataset = loadDataset(dataFile)
const out = path.resolve(
  (args.out as string | undefined) ?? (dataset.sample ? SAMPLE_RESULTS : OFFICIAL_RESULTS),
)
if (dataset.sample && out === OFFICIAL_RESULTS) {
  throw new Error('Refusing to write kappa from the TEMPLATE data into eval/results.')
}

const pairs: [Verdict, Verdict][] = []
for (const r of dataset.rows) if (r.labeler1 && r.labeler2) pairs.push([r.labeler1, r.labeler2])
const k = cohenKappa(pairs)
const file: KappaFile = {
  n: k.n,
  skipped: dataset.rows.length - k.n,
  observed: k.observed,
  expected: k.expected,
  kappa: k.kappa,
  matrix: k.matrix,
  dataset: { sha256: dataset.sha256, sample: dataset.sample },
}

mkdirSync(out, { recursive: true })
writeFileSync(path.join(out, 'kappa.json'), JSON.stringify(file, null, 2) + '\n', 'utf8')

const f = (v: number | null) => (v === null ? 'n/a' : v.toFixed(3))
console.log(
  `Labeled by both: ${k.n} of ${dataset.rows.length}${dataset.sample ? '  [TEMPLATE DATA: sample only]' : ''}`,
)
console.log(
  `Observed agreement ${f(k.observed)}, expected by chance ${f(k.expected)}, Cohen kappa ${f(k.kappa)}`,
)
console.log('Rows are labeler 1, columns are labeler 2:')
console.log(['              ', ...GOLD_LABELS.map((l) => l.padStart(13))].join(' '))
for (const a of GOLD_LABELS)
  console.log(
    [a.padEnd(14), ...GOLD_LABELS.map((b) => String(k.matrix[a][b]).padStart(13))].join(' '),
  )
console.log(`Wrote ${path.relative(process.cwd(), path.join(out, 'kappa.json'))}`)
