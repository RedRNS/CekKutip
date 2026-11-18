import type { ParsedReference, Thresholds, Verdict } from '@cekkutip/shared'
import { DEFAULT_THRESHOLDS } from '../../apps/server/src/config/thresholds.js'
import { Scheduler } from '../../apps/server/src/lib/scheduler.js'
import { parseBatch } from '../../apps/server/src/pipeline/parse.js'
import { checkOne } from '../../apps/server/src/pipeline/run.js'
import { DEFAULT_OPTIONS } from '../../apps/server/src/pipeline/types.js'
import type { DatasetRow } from './dataset.js'
import { DEFAULT_B2_THRESHOLD } from './harness.js'
import type { Clients } from './harness.js'
import { macroF1 } from './metrics.js'
import type { Item } from './metrics.js'
import { b2Score } from './systems.js'

export const GRID = {
  tauT: [0.8, 0.85, 0.9, 0.95],
  tauA: [0.4, 0.5, 0.6, 0.7, 0.8],
  tauL: [0.5, 0.6, 0.7],
  tauV: [0.3, 0.4, 0.5],
}
export const B2_GRID = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]

/** Tuning may only ever see the dev split. Called before anything else touches the rows. */
export function assertDevOnly(rows: Pick<DatasetRow, 'id' | 'split'>[]): void {
  const leaked = rows.filter((r) => r.split !== 'dev')
  if (leaked.length > 0) {
    throw new Error(
      `Refusing to tune: ${leaked.length} row(s) are not from the dev split (first: ${leaked[0]?.id}). ` +
        'Thresholds are tuned on dev only.',
    )
  }
}

export function gridCombos(grid = GRID): Thresholds[] {
  const out: Thresholds[] = []
  for (const tauT of grid.tauT)
    for (const tauA of grid.tauA)
      for (const tauL of grid.tauL)
        for (const tauV of grid.tauV) if (tauL < tauT) out.push({ tauT, tauA, tauL, tauV })
  return out
}

const distance = (a: Thresholds, b: Thresholds) =>
  Math.abs(a.tauT - b.tauT) +
  Math.abs(a.tauA - b.tauA) +
  Math.abs(a.tauL - b.tauL) +
  Math.abs(a.tauV - b.tauV)

/**
 * Highest score wins. Ties go to the candidate closest to the starting values, so that tuning on a
 * small dev set does not move a threshold without evidence.
 */
export function pickBest<T>(
  scored: { candidate: T; score: number }[],
  distanceToDefault: (c: T) => number,
): { candidate: T; score: number } {
  if (scored.length === 0) throw new Error('Nothing to choose from')
  const EPS = 1e-12
  return scored.reduce((best, cur) => {
    if (cur.score > best.score + EPS) return cur
    if (Math.abs(cur.score - best.score) <= EPS) {
      return distanceToDefault(cur.candidate) < distanceToDefault(best.candidate) - EPS ? cur : best
    }
    return best
  })
}

export interface TuneResult {
  thresholds: Thresholds
  b2Threshold: number
  macroF1Dev: number
  macroF1DevAtDefaults: number
  b2MacroF1Dev: number
  combosEvaluated: number
  grid: typeof GRID
  b2Grid: number[]
  nDev: number
  parseMode: 'llm' | 'regex'
}

/**
 * Grid search on the dev split. References are read once; each threshold combination then re-runs
 * lookup, matching, and the decision rules, with lookups answered from the retrieval cache.
 */
export async function tune(
  devRows: DatasetRow[],
  clients: Clients,
  parseMode: 'llm' | 'regex',
  now?: () => Date,
): Promise<TuneResult> {
  assertDevOnly(devRows)
  if (devRows.length === 0) throw new Error('The dev split is empty')
  if (parseMode === 'llm' && !clients.aiAvailable) {
    throw new Error('Parse mode "llm" needs GEMINI_API_KEY. Set it, or pass --parse regex.')
  }
  const gold: Verdict[] = devRows.map((r) => r.gold)
  const texts = devRows.map((r) => r.text)

  const parsed: ParsedReference[] = []
  for (let i = 0; i < texts.length; i += 8) {
    parsed.push(
      ...(await parseBatch(texts.slice(i, i + 8), parseMode, {
        gemini: clients.deps.gemini,
        batchSize: 8,
        now,
      })),
    )
  }

  const pool = new Scheduler({ maxConcurrent: 3, minIntervalMs: 0 })
  const scoreOf = async (thresholds: Thresholds): Promise<number> => {
    const options = { ...DEFAULT_OPTIONS, parseMode, thresholds }
    const results = await Promise.all(
      parsed.map((p, i) => pool.run(() => checkOne(i, p, options, clients.deps))),
    )
    const items: Item[] = results.map((r, i) => ({ gold: gold[i] as Verdict, pred: r.status }))
    return macroF1(items)
  }

  const combos = gridCombos()
  const scored: { candidate: Thresholds; score: number }[] = []
  for (const candidate of combos) scored.push({ candidate, score: await scoreOf(candidate) })
  const best = pickBest(scored, (c) => distance(c, DEFAULT_THRESHOLDS))

  // B2: one Crossref query per reference, then every cut-off is scored on the same hits.
  const b2Scores = await Promise.all(
    texts.map((text) =>
      pool.run(async () => {
        try {
          const top = (await clients.deps.retrieve.crossref.search({ title: text }))[0]
          return top ? b2Score(text, top.title, now?.()) : 0
        } catch {
          return null // service failure: check_failed at every cut-off
        }
      }),
    ),
  )
  const b2Best = pickBest(
    B2_GRID.map((thr) => ({
      candidate: thr,
      score: macroF1(
        b2Scores.map((s, i) => ({
          gold: gold[i] as Verdict,
          pred: s === null ? 'check_failed' : s >= thr ? 'verified' : 'suspect',
        })),
      ),
    })),
    (thr) => Math.abs(thr - DEFAULT_B2_THRESHOLD),
  )

  return {
    thresholds: best.candidate,
    b2Threshold: b2Best.candidate,
    macroF1Dev: best.score,
    macroF1DevAtDefaults: await scoreOf(DEFAULT_THRESHOLDS),
    b2MacroF1Dev: b2Best.score,
    combosEvaluated: combos.length,
    grid: GRID,
    b2Grid: B2_GRID,
    nDev: devRows.length,
    parseMode,
  }
}
