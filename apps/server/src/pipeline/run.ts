import type {
  CheckSummary,
  ParsedReference,
  ReferenceResult,
  Scores,
  StreamEvent,
} from '@cekkutip/shared'
import type { GeminiClient, GeminiUsage } from '../clients/gemini.js'
import { Scheduler } from '../lib/scheduler.js'
import { buildComparison } from './format.js'
import { decide } from './decide.js'
import { pickBest, scoreCandidate } from './match.js'
import { parseBatch } from './parse.js'
import { retrieve } from './retrieve.js'
import type { RetrieveDeps } from './retrieve.js'
import type { PipelineOptions, Retrieval, Scored } from './types.js'

export interface PipelineDeps {
  retrieve: RetrieveDeps
  /** Absent when no API key is configured: every reference is then read by the regex parser. */
  gemini?: GeminiClient
  now?: () => Date
  /** Called with a short error code (never text) when a lookup fails. For logging. */
  onError?: (code: string) => void
  onUsage?: (usage: GeminiUsage) => void
}

export interface RunParams {
  references: string[]
  options: PipelineOptions
  parseBatchSize: number
  retrievalConcurrency: number
  toolVersion: string
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void | Promise<void>
}

const NO_SCORES: Scores = { title: 0, authors: 0, yearDiff: null, venue: 0 }

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2
}

/** How many batches the model reads at the same time. */
const PARSE_CONCURRENCY = 3

/**
 * Split `total` references into the fewest batches of at most `maxSize`, with sizes as equal as possible.
 * Ten references with a maximum of eight become 5 + 5, not 8 + 2: a model call takes a fixed time plus
 * a little per reference, so even batches finish sooner.
 */
export function planBatches(total: number, maxSize: number): { start: number; size: number }[] {
  if (total <= 0) return []
  const count = Math.ceil(total / Math.max(1, maxSize))
  const base = Math.floor(total / count)
  const extra = total % count
  const out: { start: number; size: number }[] = []
  let start = 0
  for (let i = 0; i < count; i++) {
    const size = base + (i < extra ? 1 : 0)
    out.push({ start, size })
    start += size
  }
  return out
}

/** Look up, match, and decide one parsed reference. Never throws: a failure becomes `check_failed`. */
export async function checkOne(
  index: number,
  parsed: ParsedReference,
  options: PipelineOptions,
  deps: PipelineDeps,
  parseMs = 0,
): Promise<ReferenceResult> {
  const t0 = performance.now()
  let retrieval: Retrieval
  let best: Scored | null = null
  const matchOpts = { checkAuthors: options.checkAuthors }

  try {
    retrieval = await retrieve(parsed, deps.retrieve, options)
    if (retrieval.kind === 'doi_record') best = scoreCandidate(parsed, retrieval.record, matchOpts)
    else if (retrieval.kind === 'candidates')
      best = pickBest(parsed, retrieval.candidates, matchOpts)
  } catch (err) {
    // A lookup service failed, or something unexpected broke. Either way this is not evidence
    // about the reference, so it must never become a verdict.
    deps.onError?.(
      err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : 'internal',
    )
    retrieval = { kind: 'service_failed' }
    best = null
  }

  const decision = decide({ parsed, retrieval, best, options })

  // Show the record only when the verdict is about that record.
  const showRecord =
    (decision.status === 'verified' || decision.status === 'mismatch') && best !== null
  const shown = showRecord ? best : null

  return {
    index,
    raw: parsed.raw,
    status: decision.status,
    reasons: decision.reasons,
    parsed,
    record: shown?.record ?? null,
    comparison: buildComparison(parsed, shown, options.thresholds, retrieval.kind === 'doi_record'),
    scores: best?.scores ?? NO_SCORES,
    latencyMs: Math.round(parseMs + (performance.now() - t0)),
  }
}

export function summarize(
  results: ReferenceResult[],
  options: PipelineOptions,
  toolVersion: string,
): CheckSummary {
  const count = (s: ReferenceResult['status']) => results.filter((r) => r.status === s).length
  return {
    total: results.length,
    verified: count('verified'),
    mismatch: count('mismatch'),
    suspect: count('suspect'),
    outOfIndex: count('out_of_index'),
    checkFailed: count('check_failed'),
    medianLatencyMs: Math.round(median(results.map((r) => r.latencyMs))),
    thresholds: options.thresholds,
    toolVersion,
  }
}

/**
 * Run a whole check: parse in batches, then look up each reference as soon as its batch is read.
 * Results are emitted one by one, in completion order, followed by a summary.
 */
export async function runPipeline(params: RunParams, deps: PipelineDeps): Promise<CheckSummary> {
  const { references, options, signal } = params
  const results: ReferenceResult[] = []

  // Events are written one at a time, in the order they happen.
  let chain: Promise<void> = Promise.resolve()
  const emit = (event: StreamEvent) => {
    chain = chain.then(() => params.onEvent(event))
    return chain
  }

  await emit({ type: 'started', total: references.length })

  const lookups = new Scheduler({ maxConcurrent: params.retrievalConcurrency, minIntervalMs: 0 })
  const tasks: Promise<void>[] = []

  // Batches are read by the model in parallel, and lookups start as soon as a batch is read.
  const parsers = new Scheduler({ maxConcurrent: PARSE_CONCURRENCY, minIntervalMs: 0 })
  await Promise.all(
    planBatches(references.length, params.parseBatchSize).map(({ start, size }) =>
      parsers.run(async () => {
        if (signal?.aborted) return
        const batch = references.slice(start, start + size)
        const t0 = performance.now()
        const parsedBatch = await parseBatch(batch, options.parseMode, {
          gemini: deps.gemini,
          batchSize: params.parseBatchSize,
          now: deps.now,
          onUsage: deps.onUsage,
          onError: deps.onError,
        })
        // Each reference carries an equal share of its batch's reading time.
        const parseShare = (performance.now() - t0) / batch.length

        parsedBatch.forEach((parsed, k) => {
          const index = start + k
          tasks.push(
            lookups.run(async () => {
              if (signal?.aborted) return
              const result = await checkOne(index, parsed, options, deps, parseShare)
              results.push(result)
              await emit({ type: 'result', result })
            }),
          )
        })
      }),
    ),
  )

  await Promise.all(tasks)
  await chain

  const summary = summarize(results, options, params.toolVersion)
  if (!signal?.aborted) await emit({ type: 'done', summary })
  await chain
  return summary
}
