/**
 * Run one system on one split and write its predictions and metrics.
 *
 *   npm run eval -- --split test --system cekkutip --out eval/results
 *
 * Options:
 *   --split dev|test|all        which rows to run (default: dev)
 *   --system NAME               cekkutip | b1_llm_only | b2_crossref_top1 | b3_doi_check (default: cekkutip)
 *   --ablation a1|a2|a3|a4      cekkutip only
 *   --parse llm|regex           how references are read (default: llm when GEMINI_API_KEY is set, else regex)
 *   --out DIR                   output folder (default: eval/results, or eval/results-sample for template data)
 *   --data FILE                 dataset (default: eval/data/references.csv, else the template)
 *   --thresholds FILE           tuned thresholds (default: <out>/thresholds.json when it exists)
 *   --cache DIR                 retrieval and model caches (default: eval/cache)
 *   --replay-only               never use the network or the model: answer only from the caches
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ABLATIONS } from '../../apps/server/src/pipeline/types.js'
import type { AblationName } from '../../apps/server/src/pipeline/types.js'
import { toCsv } from '../lib/csv.js'
import { bySplit, loadDataset } from '../lib/dataset.js'
import type { Split } from '../lib/dataset.js'
import { evaluateRun } from '../lib/evaluate.js'
import type { RunSpec } from '../lib/evaluate.js'
import {
  DEFAULT_CACHE,
  DEFAULT_DATA,
  OFFICIAL_RESULTS,
  SAMPLE_RESULTS,
  TEMPLATE_DATA,
  buildClients,
  loadThresholds,
  parseArgs,
  pricePerMillion,
} from '../lib/harness.js'
import { SYSTEMS } from '../lib/systems.js'
import type { SystemName } from '../lib/systems.js'

const args = parseArgs(process.argv.slice(2), {
  split: 'value',
  system: 'value',
  ablation: 'value',
  parse: 'value',
  out: 'value',
  data: 'value',
  thresholds: 'value',
  cache: 'value',
  'replay-only': 'flag',
})

const split = (args.split as string | undefined) ?? 'dev'
if (!['dev', 'test', 'all'].includes(split)) throw new Error('--split must be dev, test, or all')
const system = ((args.system as string | undefined) ?? 'cekkutip') as SystemName
if (!SYSTEMS.includes(system)) throw new Error(`--system must be one of ${SYSTEMS.join(', ')}`)
const ablation = args.ablation as AblationName | undefined
if (ablation !== undefined && !ABLATIONS.includes(ablation)) {
  throw new Error(`--ablation must be one of ${ABLATIONS.join(', ')}`)
}

const dataFile = path.resolve(
  (args.data as string | undefined) ?? (existsSync(DEFAULT_DATA) ? DEFAULT_DATA : TEMPLATE_DATA),
)
const dataset = loadDataset(dataFile)
const out = path.resolve(
  (args.out as string | undefined) ?? (dataset.sample ? SAMPLE_RESULTS : OFFICIAL_RESULTS),
)
if (dataset.sample && out === OFFICIAL_RESULTS) {
  throw new Error(
    'Refusing to write results from the TEMPLATE data into eval/results. That folder feeds the Evaluation page. ' +
      'Use eval/results-sample, or fill in eval/data/references.csv.',
  )
}

const replayOnly = args['replay-only'] === true
const clients = buildClients({
  cacheDir: path.resolve((args.cache as string | undefined) ?? DEFAULT_CACHE),
  replayOnly,
})
const parseMode =
  (args.parse as 'llm' | 'regex' | undefined) ?? (clients.aiAvailable ? 'llm' : 'regex')
if (parseMode !== 'llm' && parseMode !== 'regex') throw new Error('--parse must be llm or regex')

const thresholdFile = path.resolve(
  (args.thresholds as string | undefined) ?? path.join(out, 'thresholds.json'),
)
const tuned = loadThresholds(thresholdFile)
if (split !== 'dev' && tuned.source.startsWith('defaults')) {
  console.warn(
    'Warning: running on a split other than dev with thresholds that were not tuned (provisional defaults).\n' +
      '         Run "npm run eval:tune" first, then freeze the values in docs/DECISIONS.md.',
  )
}

const rows = bySplit(dataset.rows, split as Split | 'all')
if (rows.length === 0)
  throw new Error(`No rows in split "${split}" of ${path.relative(process.cwd(), dataFile)}`)

const spec: RunSpec = { system, ablation, split: split as Split | 'all', parseMode }
console.log(
  `Running ${system}${ablation ? ` ${ablation}` : ''} on ${rows.length} reference(s), split ${split}` +
    `${dataset.sample ? '  [TEMPLATE DATA: sample only]' : ''}${replayOnly ? '  [replay only]' : ''}`,
)

const result = await evaluateRun({
  spec,
  rows,
  dataset: {
    file: path.relative(process.cwd(), dataFile),
    sha256: dataset.sha256,
    sample: dataset.sample,
  },
  clients,
  tuned,
  price: pricePerMillion(),
})

mkdirSync(path.join(out, 'runs'), { recursive: true })
writeFileSync(
  path.join(out, 'runs', `${result.name}.json`),
  JSON.stringify(result, null, 2) + '\n',
  'utf8',
)
writeFileSync(
  path.join(out, 'runs', `${result.name}.predictions.csv`),
  toCsv([
    ['id', 'gold_label', 'predicted', 'correct', 'source_type', 'reason_codes', 'latency_ms'],
    ...result.predictions.map((p) => [
      p.id,
      p.gold,
      p.predicted,
      p.correct ? 1 : 0,
      p.sourceType,
      p.reasons.join(' '),
      p.latencyMs,
    ]),
  ]),
  'utf8',
)

const m = result.subsets.all
const f = (v: number | null) => (v === null ? 'n/a' : v.toFixed(3))
console.log(
  `  macro-F1                ${f(m.macroF1.value)}  95% CI ${m.macroF1.ci95 ? `[${f(m.macroF1.ci95[0])}, ${f(m.macroF1.ci95[1])}]` : 'n/a'}`,
)
console.log(
  `  false accusation rate   ${f(m.falseAccusationRate.value)}  (of ${m.falseAccusationRate.outOf} real or unindexed)`,
)
console.log(`  abstain rate            ${f(m.abstainRate.value)}`)
console.log(`  could not check         ${m.checkFailed}`)
console.log(
  `  median latency          ${result.latency.medianMs} ms; tokens in ${result.tokens.input}, out ${result.tokens.output}`,
)
console.log(`Wrote ${path.relative(process.cwd(), path.join(out, 'runs', `${result.name}.json`))}`)
