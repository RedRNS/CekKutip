/* eslint-disable @typescript-eslint/no-explicit-any -- these tests mutate arbitrary JSON on purpose */
import { describe, expect, it } from 'vitest'
import { parseEvaluationSummary } from './evaluation.js'
import { FIXTURE_KAPPA, fixtureRun, fixtureSummary } from './evaluation.fixture.js'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const break_ = (mutate: (s: Record<string, any>) => void) => {
  const s = clone(fixtureSummary()) as unknown as Record<string, any>
  mutate(s)
  return s
}

describe('parseEvaluationSummary', () => {
  it('accepts a complete summary of real results, unchanged', () => {
    const s = fixtureSummary()
    expect(parseEvaluationSummary(clone(s))).toEqual(s)
  })

  it('accepts a summary without a labeler agreement, thresholds, or bootstrap note', () => {
    expect(
      parseEvaluationSummary(
        clone(fixtureSummary({ kappa: null, thresholds: null, bootstrap: null, model: null })),
      ),
    ).not.toBeNull()
  })

  it('rejects a summary made from the template data: it is never shown', () => {
    expect(parseEvaluationSummary(clone(fixtureSummary({ sample: true })))).toBeNull()
    expect(parseEvaluationSummary(break_((s) => delete s.sample))).toBeNull()
    expect(parseEvaluationSummary(break_((s) => (s.sample = 'false')))).toBeNull()
    expect(parseEvaluationSummary(break_((s) => (s.kappa.dataset.sample = true)))).toBeNull()
  })

  it.each([null, undefined, 'text', 42, [], {}])('rejects %j', (v) => {
    expect(parseEvaluationSummary(v)).toBeNull()
  })

  it('rejects a summary with no runs', () => {
    expect(parseEvaluationSummary(clone(fixtureSummary({ runs: [] })))).toBeNull()
  })

  it.each([
    ['a missing headline number', (s: Record<string, any>) => delete s.runs[0].macroF1.value],
    ['a number sent as text', (s: Record<string, any>) => (s.runs[0].macroF1.value = '0.8')],
    ['a missing verdict in the F1 table', (s: Record<string, any>) => delete s.runs[1].f1.suspect],
    ['a non-numeric interval', (s: Record<string, any>) => (s.runs[0].macroF1.ci95 = ['a', 'b'])],
    [
      'an interval of the wrong length',
      (s: Record<string, any>) => (s.runs[0].macroF1.ci95 = [0.1]),
    ],
    ['missing token counts', (s: Record<string, any>) => delete s.runs[0].tokens],
    ['a missing binary table', (s: Record<string, any>) => delete s.runs[0].binaryVerified],
    [
      'an incomplete altered-items block',
      (s: Record<string, any>) => (s.runs[0].withoutPerturbed = { n: 3 }),
    ],
    [
      'a kappa matrix with a missing cell',
      (s: Record<string, any>) => delete s.kappa.matrix.verified.mismatch,
    ],
    ['thresholds with a missing value', (s: Record<string, any>) => delete s.thresholds.tauV],
    ['a dataset hash that is not text', (s: Record<string, any>) => (s.datasetSha256 = [1])],
  ])('rejects %s', (_name, mutate) => {
    expect(parseEvaluationSummary(break_(mutate))).toBeNull()
  })

  it('treats a rate that is genuinely undefined (null) as valid, not as missing', () => {
    const s = fixtureSummary({
      runs: [
        fixtureRun({
          name: 'x.test',
          system: 'cekkutip',
          falseAccusationRate: { value: null, ci95: null, outOf: 0 },
        }),
      ],
    })
    expect(parseEvaluationSummary(clone(s))).not.toBeNull()
    expect(FIXTURE_KAPPA.kappa).not.toBeNull()
  })
})
