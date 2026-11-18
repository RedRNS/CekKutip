import type { CheckStatus, Verdict } from '@cekkutip/shared'
import { GOLD_LABELS } from './dataset.js'

export interface Item {
  gold: Verdict
  /** A system may also answer `check_failed`, which matches no gold label. */
  pred: CheckStatus
}

export const PRED_LABELS: readonly CheckStatus[] = [...GOLD_LABELS, 'check_failed']

export type Confusion = Record<Verdict, Record<CheckStatus, number>>

export function confusion(items: Item[]): Confusion {
  const m = Object.fromEntries(
    GOLD_LABELS.map((g) => [g, Object.fromEntries(PRED_LABELS.map((p) => [p, 0]))]),
  ) as Confusion
  for (const it of items) m[it.gold][it.pred] += 1
  return m
}

export interface ClassScores {
  precision: number
  recall: number
  f1: number
  /** Items whose gold label is this class. */
  support: number
  /** Items the system assigned to this class. */
  predicted: number
}

const f1Of = (p: number, r: number) => (p + r === 0 ? 0 : (2 * p * r) / (p + r))

export function classScores(items: Item[], label: Verdict): ClassScores {
  let tp = 0
  let support = 0
  let predicted = 0
  for (const it of items) {
    if (it.gold === label) support++
    if (it.pred === label) predicted++
    if (it.gold === label && it.pred === label) tp++
  }
  const precision = predicted === 0 ? 0 : tp / predicted
  const recall = support === 0 ? 0 : tp / support
  return { precision, recall, f1: f1Of(precision, recall), support, predicted }
}

/** Mean F1 over the verdicts that occur in the gold labels. The main metric. */
export function macroF1(items: Item[]): number {
  const scores = GOLD_LABELS.map((l) => classScores(items, l)).filter((s) => s.support > 0)
  return scores.length === 0 ? 0 : scores.reduce((a, s) => a + s.f1, 0) / scores.length
}

/**
 * False accusation rate: of the references whose gold label is `verified` or `out_of_index`
 * (the source is real), the share the system marked `suspect` or `mismatch`.
 * Null when there are no such references.
 */
export function falseAccusationRate(items: Item[]): number | null {
  const real = items.filter((it) => it.gold === 'verified' || it.gold === 'out_of_index')
  if (real.length === 0) return null
  return real.filter((it) => it.pred === 'suspect' || it.pred === 'mismatch').length / real.length
}

/** Share of all references the system answered with `out_of_index`. */
export function abstainRate(items: Item[]): number {
  return items.length === 0
    ? 0
    : items.filter((it) => it.pred === 'out_of_index').length / items.length
}

/** `verified` against everything else. Lets two-label baselines (B2, B3) be compared fairly. */
export function binaryVerified(items: Item[]) {
  let tp = 0
  let fp = 0
  let fn = 0
  let tn = 0
  for (const it of items) {
    const g = it.gold === 'verified'
    const p = it.pred === 'verified'
    if (g && p) tp++
    else if (!g && p) fp++
    else if (g && !p) fn++
    else tn++
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  return {
    precision,
    recall,
    f1: f1Of(precision, recall),
    accuracy: items.length === 0 ? 0 : (tp + tn) / items.length,
  }
}

/** Deterministic pseudo-random numbers in [0, 1). The same seed always gives the same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BootstrapOptions {
  resamples: number
  seed: number
}

export const DEFAULT_BOOTSTRAP: BootstrapOptions = { resamples: 1000, seed: 20261209 }

/**
 * Percentile bootstrap, 95% interval. Resamples the items with replacement.
 * Resamples for which the statistic is undefined (null) are left out.
 */
export function bootstrapCI(
  items: Item[],
  stat: (sample: Item[]) => number | null,
  opts: BootstrapOptions = DEFAULT_BOOTSTRAP,
): [number, number] | null {
  if (items.length === 0) return null
  const rand = mulberry32(opts.seed)
  const values: number[] = []
  for (let b = 0; b < opts.resamples; b++) {
    const sample: Item[] = []
    for (let i = 0; i < items.length; i++) {
      sample.push(items[Math.floor(rand() * items.length)] as Item)
    }
    const v = stat(sample)
    if (v !== null) values.push(v)
  }
  if (values.length === 0) return null
  values.sort((a, b) => a - b)
  const q = (p: number) =>
    values[Math.min(values.length - 1, Math.max(0, Math.floor(p * values.length)))] as number
  return [q(0.025), q(0.975)]
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2
}

export interface Metrics {
  n: number
  confusion: Confusion
  perVerdict: Record<Verdict, ClassScores>
  macroF1: { value: number; ci95: [number, number] | null }
  falseAccusationRate: { value: number | null; ci95: [number, number] | null; outOf: number }
  abstainRate: { value: number; ci95: [number, number] | null }
  binaryVerified: ReturnType<typeof binaryVerified>
  /** Items the system could not check. They count as wrong, and are never accusations or abstentions. */
  checkFailed: number
}

export function computeMetrics(items: Item[], opts: BootstrapOptions = DEFAULT_BOOTSTRAP): Metrics {
  return {
    n: items.length,
    confusion: confusion(items),
    perVerdict: Object.fromEntries(GOLD_LABELS.map((l) => [l, classScores(items, l)])) as Record<
      Verdict,
      ClassScores
    >,
    macroF1: { value: macroF1(items), ci95: bootstrapCI(items, macroF1, opts) },
    falseAccusationRate: {
      value: falseAccusationRate(items),
      ci95: bootstrapCI(items, falseAccusationRate, opts),
      outOf: items.filter((it) => it.gold === 'verified' || it.gold === 'out_of_index').length,
    },
    abstainRate: { value: abstainRate(items), ci95: bootstrapCI(items, abstainRate, opts) },
    binaryVerified: binaryVerified(items),
    checkFailed: items.filter((it) => it.pred === 'check_failed').length,
  }
}

/** Cohen's kappa between two labelers, with the agreement matrix. */
export function cohenKappa(pairs: [Verdict, Verdict][]) {
  const n = pairs.length
  const matrix = Object.fromEntries(
    GOLD_LABELS.map((a) => [a, Object.fromEntries(GOLD_LABELS.map((b) => [b, 0]))]),
  ) as Record<Verdict, Record<Verdict, number>>
  for (const [a, b] of pairs) matrix[a][b] += 1
  if (n === 0) return { n, observed: null, expected: null, kappa: null, matrix }
  const observed = GOLD_LABELS.reduce((s, l) => s + matrix[l][l], 0) / n
  const expected = GOLD_LABELS.reduce((s, l) => {
    const row = GOLD_LABELS.reduce((t, b) => t + matrix[l][b], 0) / n
    const col = GOLD_LABELS.reduce((t, a) => t + matrix[a][l], 0) / n
    return s + row * col
  }, 0)
  // When both labelers always give the same single label, chance agreement is 1 and kappa is undefined.
  const kappa = expected === 1 ? null : (observed - expected) / (1 - expected)
  return { n, observed, expected, kappa, matrix }
}
