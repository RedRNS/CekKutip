import type { CheckStatus, Thresholds, Verdict } from '@cekkutip/shared'
import { DEFAULT_OPTIONS, applyAblation } from '../../apps/server/src/pipeline/types.js'
import type { AblationName } from '../../apps/server/src/pipeline/types.js'
import { toInputs } from './dataset.js'
import type { DatasetRow, SourceType, Split } from './dataset.js'
import { costPer1000, gitInfo } from './harness.js'
import type { Clients, TunedThresholds } from './harness.js'
import { DEFAULT_BOOTSTRAP, computeMetrics, median } from './metrics.js'
import type { BootstrapOptions, Metrics } from './metrics.js'
import { runSystem } from './systems.js'
import type { SystemName } from './systems.js'

export interface RunSpec {
  system: SystemName
  ablation?: AblationName
  split: Split | 'all'
  parseMode: 'llm' | 'regex'
}

export const runName = (s: Pick<RunSpec, 'system' | 'ablation' | 'split'>) =>
  `${s.system}${s.ablation ? `-${s.ablation}` : ''}.${s.split}`

export interface PredictionRow {
  id: string
  gold: Verdict
  predicted: CheckStatus
  correct: boolean
  sourceType: SourceType
  reasons: string[]
  latencyMs: number
}

export interface RunResult {
  name: string
  meta: {
    system: SystemName
    ablation: AblationName | null
    split: Split | 'all'
    parseMode: 'llm' | 'regex' | 'none'
    model: string | null
    toolVersion: string
    commit: string | null
    uncommittedChanges: boolean | null
    thresholds: Thresholds
    thresholdsSource: string
    b2Threshold: number | null
    /** Date of this run. Lookups may have been replayed from a cache recorded earlier. */
    date: string
    replayOnly: boolean
    dataset: { file: string; sha256: string; n: number; sample: boolean }
    bootstrap: BootstrapOptions
  }
  subsets: { all: Metrics; without_perturbed: Metrics | null }
  sourceTypes: Record<SourceType, number>
  latency: { medianMs: number }
  tokens: { input: number; output: number }
  cost: { per1000Usd: number | null; priceInputPerM: number | null; priceOutputPerM: number | null }
  predictions: PredictionRow[]
}

export interface EvaluateArgs {
  spec: RunSpec
  /** Rows of the chosen split only. */
  rows: DatasetRow[]
  dataset: { file: string; sha256: string; sample: boolean }
  clients: Clients
  tuned: TunedThresholds & { source: string }
  price: { input: number | null; output: number | null }
  bootstrap?: BootstrapOptions
  now?: () => Date
}

/** Run one system on one split and score it. The system only ever sees ids and reference text. */
export async function evaluateRun(args: EvaluateArgs): Promise<RunResult> {
  const { spec, rows, clients, tuned } = args
  const bootstrap = args.bootstrap ?? DEFAULT_BOOTSTRAP
  if (spec.ablation && spec.system !== 'cekkutip') {
    throw new Error('Ablations apply to the cekkutip system only')
  }

  let options = { ...DEFAULT_OPTIONS, parseMode: spec.parseMode, thresholds: tuned.thresholds }
  if (spec.ablation) options = applyAblation(options, spec.ablation)
  const usesParser = spec.system === 'cekkutip'
  const usesModel = (usesParser && options.parseMode === 'llm') || spec.system === 'b1_llm_only'
  if (usesParser && options.parseMode === 'llm' && !clients.aiAvailable) {
    throw new Error('Parse mode "llm" needs GEMINI_API_KEY. Set it, or pass --parse regex.')
  }

  const run = await runSystem(spec.system, toInputs(rows), {
    deps: clients.deps,
    options,
    verdictModel: clients.verdictModel,
    b2Threshold: tuned.b2Threshold,
    toolVersion: clients.toolVersion,
    now: args.now,
  })

  const byId = new Map(rows.map((r) => [r.id, r]))
  const predictions: PredictionRow[] = run.predictions.map((p) => {
    const row = byId.get(p.id)
    if (!row) throw new Error(`Prediction for unknown id ${p.id}`)
    return {
      id: p.id,
      gold: row.gold,
      predicted: p.predicted,
      correct: p.predicted === row.gold,
      sourceType: row.sourceType,
      reasons: p.reasons,
      latencyMs: p.latencyMs,
    }
  })
  if (predictions.length !== rows.length)
    throw new Error('A system returned fewer predictions than inputs')

  const items = predictions.map((p) => ({ gold: p.gold, pred: p.predicted }))
  const natural = predictions.filter((p) => p.sourceType !== 'perturbed')
  const hasPerturbed = natural.length !== predictions.length
  const git = gitInfo()
  const sourceTypes = { real: 0, model_generated: 0, perturbed: 0 }
  for (const p of predictions) sourceTypes[p.sourceType] += 1

  return {
    name: runName(spec),
    meta: {
      system: spec.system,
      ablation: spec.ablation ?? null,
      split: spec.split,
      parseMode: usesParser ? options.parseMode : 'none',
      model: usesModel ? clients.model : null,
      toolVersion: clients.toolVersion,
      commit: git.commit,
      uncommittedChanges: git.dirty,
      thresholds: tuned.thresholds,
      thresholdsSource: tuned.source,
      b2Threshold: spec.system === 'b2_crossref_top1' ? tuned.b2Threshold : null,
      date: (args.now?.() ?? new Date()).toISOString(),
      replayOnly: clients.replayOnly,
      dataset: { ...args.dataset, n: rows.length },
      bootstrap,
    },
    subsets: {
      all: computeMetrics(items, bootstrap),
      // The same figures without synthetic items, when the split has any.
      without_perturbed: hasPerturbed
        ? computeMetrics(
            natural.map((p) => ({ gold: p.gold, pred: p.predicted })),
            bootstrap,
          )
        : null,
    },
    sourceTypes,
    latency: { medianMs: Math.round(median(predictions.map((p) => p.latencyMs))) },
    tokens: {
      input: Math.round(run.usage.inputTokens),
      output: Math.round(run.usage.outputTokens),
    },
    cost: {
      per1000Usd: costPer1000(run.usage, rows.length, args.price),
      priceInputPerM: args.price.input,
      priceOutputPerM: args.price.output,
    },
    predictions,
  }
}
