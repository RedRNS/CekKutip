import { extractDoi, normalizeText } from '@cekkutip/shared'
import type { CheckStatus } from '@cekkutip/shared'
import type { GeminiUsage } from '../../apps/server/src/clients/gemini.js'
import { Scheduler } from '../../apps/server/src/lib/scheduler.js'
import { titleSimilarity } from '../../apps/server/src/lib/similarity.js'
import { parseWithRegex } from '../../apps/server/src/pipeline/regex-parse.js'
import { runPipeline } from '../../apps/server/src/pipeline/run.js'
import type { PipelineDeps } from '../../apps/server/src/pipeline/run.js'
import type { PipelineOptions } from '../../apps/server/src/pipeline/types.js'
import type { EvalInput } from './dataset.js'
import type { VerdictModel } from './model-cache.js'

export const SYSTEMS = ['cekkutip', 'b1_llm_only', 'b2_crossref_top1', 'b3_doi_check'] as const
export type SystemName = (typeof SYSTEMS)[number]

export interface Prediction {
  id: string
  predicted: CheckStatus
  reasons: string[]
  latencyMs: number
}

export interface SystemContext {
  /** Lookup clients, and the field reader for the full pipeline. */
  deps: PipelineDeps
  /** Pipeline switches (ablations) and thresholds. Used by `cekkutip` only. */
  options: PipelineOptions
  /** B1 only. */
  verdictModel?: VerdictModel
  /** B2 only: title score at or above which the top Crossref hit counts as verified. Tuned on dev. */
  b2Threshold: number
  toolVersion: string
  parseBatchSize?: number
  concurrency?: number
  now?: () => Date
}

export interface SystemRun {
  predictions: Prediction[]
  usage: GeminiUsage
}

/**
 * B2's title score: how well the top hit's title matches the reference. The title is read with the
 * regex parser (no model). If that finds no title, the score is 1 when the reference text contains
 * the hit's title word for word, else 0.
 */
export function b2Score(referenceText: string, hitTitle: string, now?: Date): number {
  const parsed = parseWithRegex(referenceText, { now })
  if (parsed.title) return titleSimilarity(parsed.title, hitTitle)
  const title = normalizeText(hitTitle)
  return title !== '' && ` ${normalizeText(referenceText)} `.includes(` ${title} `) ? 1 : 0
}

/**
 * Run one system over the inputs. Inputs carry an id and the text only: no label reaches a system.
 * Predictions come back in input order.
 */
export async function runSystem(
  name: SystemName,
  inputs: EvalInput[],
  ctx: SystemContext,
): Promise<SystemRun> {
  const usage: GeminiUsage = { inputTokens: 0, outputTokens: 0 }
  const addUsage = (u: GeminiUsage) => {
    usage.inputTokens += u.inputTokens
    usage.outputTokens += u.outputTokens
  }
  const concurrency = ctx.concurrency ?? 3
  const batchSize = ctx.parseBatchSize ?? 8

  if (name === 'cekkutip') {
    const predictions: Prediction[] = new Array<Prediction>(inputs.length)
    await runPipeline(
      {
        references: inputs.map((i) => i.text),
        options: ctx.options,
        parseBatchSize: batchSize,
        retrievalConcurrency: concurrency,
        toolVersion: ctx.toolVersion,
        onEvent: (e) => {
          if (e.type !== 'result') return
          const r = e.result
          predictions[r.index] = {
            id: (inputs[r.index] as EvalInput).id,
            predicted: r.status,
            reasons: r.reasons,
            latencyMs: r.latencyMs,
          }
        },
      },
      { ...ctx.deps, now: ctx.now, onUsage: addUsage },
    )
    return { predictions, usage }
  }

  if (name === 'b1_llm_only') {
    if (!ctx.verdictModel) throw new Error('b1_llm_only needs a model (set GEMINI_API_KEY)')
    const predictions: Prediction[] = []
    for (let start = 0; start < inputs.length; start += batchSize) {
      const batch = inputs.slice(start, start + batchSize)
      const t0 = performance.now()
      let verdicts = new Map<number, CheckStatus>()
      try {
        const res = await ctx.verdictModel.classify(batch.map((b, k) => ({ i: k, text: b.text })))
        verdicts = res.verdicts
        addUsage(res.usage)
      } catch {
        /* the model could not be reached: every item of the batch is check_failed */
      }
      const share = Math.round((performance.now() - t0) / batch.length)
      batch.forEach((b, k) =>
        predictions.push({
          id: b.id,
          predicted: verdicts.get(k) ?? 'check_failed',
          reasons: [],
          latencyMs: share,
        }),
      )
    }
    return { predictions, usage }
  }

  const pool = new Scheduler({ maxConcurrent: concurrency, minIntervalMs: 0 })
  const one = async (input: EvalInput): Promise<Prediction> => {
    const t0 = performance.now()
    let predicted: CheckStatus
    try {
      if (name === 'b2_crossref_top1') {
        // The whole reference is the query, as in a plain bibliographic search box.
        const top = (await ctx.deps.retrieve.crossref.search({ title: input.text }))[0]
        predicted =
          top && b2Score(input.text, top.title, ctx.now?.()) >= ctx.b2Threshold
            ? 'verified'
            : 'suspect'
      } else {
        const doi = extractDoi(input.text)
        predicted =
          doi !== null && (await ctx.deps.retrieve.crossref.getByDoi(doi)).found
            ? 'verified'
            : 'suspect'
      }
    } catch {
      predicted = 'check_failed' // a service failure is not an answer, for baselines too
    }
    return { id: input.id, predicted, reasons: [], latencyMs: Math.round(performance.now() - t0) }
  }
  const predictions = await Promise.all(inputs.map((i) => pool.run(() => one(i))))
  return { predictions, usage }
}
