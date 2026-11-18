import type { CheckStatus, Verdict } from '@cekkutip/shared'
import { describe, expect, it } from 'vitest'
import {
  abstainRate,
  binaryVerified,
  bootstrapCI,
  classScores,
  cohenKappa,
  computeMetrics,
  confusion,
  falseAccusationRate,
  macroF1,
  median,
  mulberry32,
} from '../lib/metrics.js'
import type { Item } from '../lib/metrics.js'

const item = (gold: Verdict, pred: CheckStatus): Item => ({ gold, pred })
const many = (n: number, gold: Verdict, pred: CheckStatus): Item[] =>
  Array.from({ length: n }, () => item(gold, pred))

/**
 * A small confusion matrix worked out by hand.
 *   gold verified (4):      3 predicted verified, 1 predicted mismatch
 *   gold mismatch (3):      2 predicted mismatch, 1 predicted suspect
 *   gold suspect (2):       2 predicted suspect
 *   gold out_of_index (3):  1 predicted out_of_index, 1 predicted suspect, 1 predicted check_failed
 */
const HAND: Item[] = [
  ...many(3, 'verified', 'verified'),
  item('verified', 'mismatch'),
  ...many(2, 'mismatch', 'mismatch'),
  item('mismatch', 'suspect'),
  ...many(2, 'suspect', 'suspect'),
  item('out_of_index', 'out_of_index'),
  item('out_of_index', 'suspect'),
  item('out_of_index', 'check_failed'),
]

describe('confusion matrix and per-verdict scores', () => {
  it('counts every gold and predicted pair, including check_failed', () => {
    const m = confusion(HAND)
    expect(m.verified).toMatchObject({ verified: 3, mismatch: 1 })
    expect(m.mismatch).toMatchObject({ mismatch: 2, suspect: 1 })
    expect(m.suspect).toMatchObject({ suspect: 2 })
    expect(m.out_of_index).toMatchObject({ out_of_index: 1, suspect: 1, check_failed: 1 })
    const total = Object.values(m).reduce(
      (s, row) => s + Object.values(row).reduce((a, b) => a + b, 0),
      0,
    )
    expect(total).toBe(HAND.length)
  })

  it('computes precision, recall, and F1 by hand', () => {
    // verified: predicted 3, correct 3, gold 4
    expect(classScores(HAND, 'verified')).toMatchObject({ support: 4, predicted: 3 })
    expect(classScores(HAND, 'verified').precision).toBeCloseTo(1)
    expect(classScores(HAND, 'verified').recall).toBeCloseTo(0.75)
    expect(classScores(HAND, 'verified').f1).toBeCloseTo((2 * 1 * 0.75) / 1.75)
    // mismatch: predicted 3 (2 right), gold 3
    expect(classScores(HAND, 'mismatch').precision).toBeCloseTo(2 / 3)
    expect(classScores(HAND, 'mismatch').recall).toBeCloseTo(2 / 3)
    // suspect: predicted 4 (2 right), gold 2
    expect(classScores(HAND, 'suspect').precision).toBeCloseTo(0.5)
    expect(classScores(HAND, 'suspect').recall).toBeCloseTo(1)
    // out_of_index: predicted 1 (1 right), gold 3
    expect(classScores(HAND, 'out_of_index').precision).toBeCloseTo(1)
    expect(classScores(HAND, 'out_of_index').recall).toBeCloseTo(1 / 3)
  })

  it('macro-F1 is the plain mean of the four F1 scores', () => {
    const f = (l: Verdict) => classScores(HAND, l).f1
    expect(macroF1(HAND)).toBeCloseTo(
      (f('verified') + f('mismatch') + f('suspect') + f('out_of_index')) / 4,
    )
  })

  it('a perfect system scores 1, and a system that is always wrong scores 0', () => {
    const perfect = (['verified', 'mismatch', 'suspect', 'out_of_index'] as const).flatMap((l) =>
      many(2, l, l),
    )
    expect(macroF1(perfect)).toBe(1)
    expect(macroF1(many(5, 'verified', 'suspect'))).toBe(0)
  })

  it('leaves out verdicts that never occur in the gold labels instead of counting them as 0', () => {
    expect(macroF1([...many(2, 'verified', 'verified'), ...many(2, 'suspect', 'suspect')])).toBe(1)
  })

  it('handles an empty list', () => {
    expect(macroF1([])).toBe(0)
    expect(abstainRate([])).toBe(0)
    expect(falseAccusationRate([])).toBeNull()
  })
})

describe('false accusation rate and abstain rate', () => {
  it('counts suspect or mismatch on gold verified or out_of_index, among those items only', () => {
    const items = [
      ...many(4, 'verified', 'verified'),
      item('verified', 'suspect'), // accused
      item('out_of_index', 'mismatch'), // accused
      item('out_of_index', 'out_of_index'),
      item('out_of_index', 'check_failed'), // not an accusation
      ...many(5, 'suspect', 'suspect'), // gold suspect: not part of the rate
      ...many(3, 'mismatch', 'mismatch'), // gold mismatch: not part of the rate
    ]
    expect(falseAccusationRate(items)).toBeCloseTo(2 / 8)
  })

  it('is 0 for a system that never accuses, and 1 for one that always does', () => {
    expect(falseAccusationRate(many(3, 'verified', 'verified'))).toBe(0)
    expect(falseAccusationRate(many(3, 'verified', 'mismatch'))).toBe(1)
  })

  it('is undefined (null) when the data has no real or unindexed sources', () => {
    expect(falseAccusationRate(many(3, 'suspect', 'suspect'))).toBeNull()
  })

  it('abstain rate is the share of all answers that are out_of_index', () => {
    expect(abstainRate(HAND)).toBeCloseTo(1 / 12) // 12 items, one out_of_index answer
    expect(abstainRate(many(4, 'verified', 'out_of_index'))).toBe(1)
  })

  it('a check_failed answer is neither an accusation nor an abstention', () => {
    const items = many(4, 'verified', 'check_failed')
    expect(falseAccusationRate(items)).toBe(0)
    expect(abstainRate(items)).toBe(0)
    expect(computeMetrics(items).checkFailed).toBe(4)
  })
})

describe('binary verified against not verified', () => {
  it('compares two-label baselines fairly', () => {
    // tp 3, fp 0, fn 1, tn 8
    const b = binaryVerified(HAND)
    expect(b.precision).toBe(1)
    expect(b.recall).toBeCloseTo(0.75)
    expect(b.accuracy).toBeCloseTo(11 / 12)
  })
})

describe('bootstrap confidence intervals', () => {
  const items = [
    ...many(20, 'verified', 'verified'),
    ...many(10, 'verified', 'suspect'),
    ...many(30, 'suspect', 'suspect'),
  ]

  it('is repeatable: the same seed always gives the same interval', () => {
    const opts = { resamples: 300, seed: 7 }
    expect(bootstrapCI(items, macroF1, opts)).toEqual(bootstrapCI(items, macroF1, opts))
  })

  it('changes with the seed', () => {
    const a = bootstrapCI(items, macroF1, { resamples: 300, seed: 1 })
    const b = bootstrapCI(items, macroF1, { resamples: 300, seed: 2 })
    expect(a).not.toEqual(b)
  })

  it('brackets the observed value, with lower below upper', () => {
    const ci = bootstrapCI(items, macroF1, { resamples: 500, seed: 3 }) as [number, number]
    const value = macroF1(items)
    expect(ci[0]).toBeLessThan(ci[1])
    expect(ci[0]).toBeLessThanOrEqual(value)
    expect(ci[1]).toBeGreaterThanOrEqual(value)
  })

  it('is a point when every resample gives the same value', () => {
    expect(
      bootstrapCI(many(10, 'verified', 'verified'), () => 1, { resamples: 50, seed: 1 }),
    ).toEqual([1, 1])
  })

  it('leaves out resamples where the statistic is undefined, and is null when none are defined', () => {
    expect(
      bootstrapCI(many(5, 'suspect', 'suspect'), falseAccusationRate, { resamples: 50, seed: 1 }),
    ).toBeNull()
    expect(bootstrapCI([], macroF1)).toBeNull()
  })

  it('computeMetrics uses 1,000 resamples and a fixed seed by default, so a report can be reproduced', () => {
    const a = computeMetrics(items)
    const b = computeMetrics(items)
    expect(a.macroF1.ci95).toEqual(b.macroF1.ci95)
    expect(a.n).toBe(60)
  })

  it('the random generator is deterministic and stays in [0, 1)', () => {
    const r1 = mulberry32(42)
    const r2 = mulberry32(42)
    const seq = Array.from({ length: 100 }, () => r1())
    expect(seq).toEqual(Array.from({ length: 100 }, () => r2()))
    expect(seq.every((v) => v >= 0 && v < 1)).toBe(true)
    expect(new Set(seq).size).toBeGreaterThan(95)
  })
})

describe('Cohen kappa', () => {
  const pairs = (a: Verdict, b: Verdict, n: number): [Verdict, Verdict][] =>
    Array.from({ length: n }, () => [a, b])

  it('matches the textbook example: observed 0.7, expected 0.5, kappa 0.4', () => {
    // 20 both verified, 5 and 10 disagree, 15 both suspect
    const data = [
      ...pairs('verified', 'verified', 20),
      ...pairs('verified', 'suspect', 5),
      ...pairs('suspect', 'verified', 10),
      ...pairs('suspect', 'suspect', 15),
    ]
    const k = cohenKappa(data)
    expect(k.n).toBe(50)
    expect(k.observed).toBeCloseTo(0.7)
    expect(k.expected).toBeCloseTo(0.5)
    expect(k.kappa).toBeCloseTo(0.4)
    expect(k.matrix.verified.suspect).toBe(5)
    expect(k.matrix.suspect.verified).toBe(10)
  })

  it('is 1 for perfect agreement across labels, and below 0 for systematic disagreement', () => {
    const perfect = [...pairs('verified', 'verified', 5), ...pairs('mismatch', 'mismatch', 5)]
    expect(cohenKappa(perfect).kappa).toBeCloseTo(1)
    const opposite = [...pairs('verified', 'suspect', 5), ...pairs('suspect', 'verified', 5)]
    expect(cohenKappa(opposite).kappa).toBeLessThan(0)
  })

  it('is undefined when both labelers only ever use one label, and for no data', () => {
    expect(cohenKappa(pairs('verified', 'verified', 5)).kappa).toBeNull()
    expect(cohenKappa([]).kappa).toBeNull()
  })
})

describe('median', () => {
  it('handles odd, even, unsorted, and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})
