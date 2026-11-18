/**
 * Choose TAU_T, TAU_A, TAU_L, TAU_V (and B2's cut-off) by grid search on the DEV split only.
 * The script refuses to run on the test split.
 *
 *   npm run eval:tune
 *
 * Options: --data FILE, --out DIR, --cache DIR, --parse llm|regex, --replay-only, --split dev
 * (--split exists only so that asking for "test" gives a clear refusal.)
 * Writes <out>/thresholds.json. Freeze the chosen values in docs/DECISIONS.md with the commit hash.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { bySplit, loadDataset } from '../lib/dataset.js'
import {
  DEFAULT_CACHE,
  DEFAULT_DATA,
  OFFICIAL_RESULTS,
  SAMPLE_RESULTS,
  TEMPLATE_DATA,
  buildClients,
  gitInfo,
  parseArgs,
} from '../lib/harness.js'
import { assertDevOnly, tune } from '../lib/tune.js'

const args = parseArgs(process.argv.slice(2), {
  split: 'value',
  data: 'value',
  out: 'value',
  cache: 'value',
  parse: 'value',
  'replay-only': 'flag',
})

if (args.split !== undefined && args.split !== 'dev') {
  console.error('Refusing to run: thresholds are tuned on the dev split only. Never on test.')
  process.exit(2)
}

const dataFile = path.resolve(
  (args.data as string | undefined) ?? (existsSync(DEFAULT_DATA) ? DEFAULT_DATA : TEMPLATE_DATA),
)
const dataset = loadDataset(dataFile)
const out = path.resolve(
  (args.out as string | undefined) ?? (dataset.sample ? SAMPLE_RESULTS : OFFICIAL_RESULTS),
)
if (dataset.sample && out === OFFICIAL_RESULTS) {
  throw new Error('Refusing to write tuning results from the TEMPLATE data into eval/results.')
}

// Only dev rows are ever selected, and the guard checks it again before anything is read.
const dev = bySplit(dataset.rows, 'dev')
assertDevOnly(dev)

const clients = buildClients({
  cacheDir: path.resolve((args.cache as string | undefined) ?? DEFAULT_CACHE),
  replayOnly: args['replay-only'] === true,
})
const parseMode =
  (args.parse as 'llm' | 'regex' | undefined) ?? (clients.aiAvailable ? 'llm' : 'regex')

console.log(
  `Tuning on ${dev.length} dev reference(s)${dataset.sample ? '  [TEMPLATE DATA: sample only]' : ''}; the test split is not read.`,
)
const result = await tune(dev, clients, parseMode)

const git = gitInfo()
mkdirSync(out, { recursive: true })
const file = path.join(out, 'thresholds.json')
writeFileSync(
  file,
  JSON.stringify(
    {
      ...result,
      tunedOn: 'dev',
      dataset: {
        file: path.relative(process.cwd(), dataFile),
        sha256: dataset.sha256,
        sample: dataset.sample,
      },
      model: clients.aiAvailable && parseMode === 'llm' ? clients.model : null,
      toolVersion: clients.toolVersion,
      commit: git.commit,
      uncommittedChanges: git.dirty,
      date: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
  'utf8',
)

const t = result.thresholds
console.log(
  `Best of ${result.combosEvaluated} combinations (dev macro-F1 ${result.macroF1Dev.toFixed(3)}; at the starting values ${result.macroF1DevAtDefaults.toFixed(3)}):`,
)
console.log(`  TAU_T ${t.tauT}   TAU_A ${t.tauA}   TAU_L ${t.tauL}   TAU_V ${t.tauV}`)
console.log(
  `  B2 title cut-off ${result.b2Threshold} (dev macro-F1 ${result.b2MacroF1Dev.toFixed(3)})`,
)
console.log(`Wrote ${path.relative(process.cwd(), file)}`)
