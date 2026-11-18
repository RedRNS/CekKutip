import { fixtureRun, fixtureSummary } from '@cekkutip/shared/testing'
import { describe, expect, it } from 'vitest'
import {
  datasetSize,
  groupBySplit,
  numberFormatter,
  runOrder,
  signedChange,
} from './evaluationView'

describe('groupBySplit', () => {
  it('puts development before test, and the full pipeline, its ablations, then the baselines in each', () => {
    const groups = groupBySplit(fixtureSummary())
    expect(groups.map((g) => g.split)).toEqual(['dev', 'test'])
    expect(groups[1]?.runs.map((r) => r.name)).toEqual([
      'cekkutip.test',
      'cekkutip-a1.test',
      'b1_llm_only.test',
      'b3_doi_check.test',
    ])
  })

  it('finds the full pipeline as the base for ablations, and lists the ablations', () => {
    const test = groupBySplit(fixtureSummary()).find((g) => g.split === 'test')
    expect(test?.base?.name).toBe('cekkutip.test')
    expect(test?.ablations.map((r) => r.ablation)).toEqual(['a1'])
    expect(groupBySplit(fixtureSummary()).find((g) => g.split === 'dev')?.ablations).toEqual([])
  })

  it('has no base when the full pipeline was not run on a split', () => {
    const s = fixtureSummary({
      runs: [fixtureRun({ name: 'b3_doi_check.test', system: 'b3_doi_check' })],
    })
    expect(groupBySplit(s)[0]?.base).toBeNull()
  })

  it('orders ablations A1 to A4', () => {
    const mk = (a: string) =>
      fixtureRun({ name: `cekkutip-${a}.test`, system: 'cekkutip', ablation: a })
    expect([mk('a4'), mk('a2'), mk('a1'), mk('a3')].sort(runOrder).map((r) => r.ablation)).toEqual([
      'a1',
      'a2',
      'a3',
      'a4',
    ])
  })
})

describe('datasetSize', () => {
  it('adds the development and test splits (80 + 50), not just the largest run', () => {
    expect(datasetSize(fixtureSummary())).toBe(130)
  })

  it('uses the run over all references when there is one', () => {
    const s = fixtureSummary({
      runs: [
        fixtureRun({ name: 'a.all', system: 'cekkutip', split: 'all', n: 130 }),
        fixtureRun({ name: 'a.test', system: 'cekkutip', split: 'test', n: 50 }),
      ],
    })
    expect(datasetSize(s)).toBe(130)
  })

  it('does not count a split twice when several systems ran on it', () => {
    expect(datasetSize(fixtureSummary())).toBe(80 + 50)
  })
})

describe('number formatting', () => {
  it('uses a decimal point in English and a decimal comma in Indonesian, always with three digits', () => {
    expect(numberFormatter('en')(0.8125)).toBe('0.813')
    expect(numberFormatter('id')(0.8125)).toBe('0,813')
    expect(numberFormatter('en')(1)).toBe('1.000')
    expect(numberFormatter('en', 0)(2300)).toBe('2,300')
    expect(numberFormatter('id', 0)(2300)).toBe('2.300')
  })

  it('shows nothing for a missing value instead of inventing one', () => {
    expect(numberFormatter('en')(null)).toBe('')
    expect(numberFormatter('en')(undefined)).toBe('')
  })

  it('writes a signed change, a plain zero for no change, and nothing when a side is missing', () => {
    const f = numberFormatter('en')
    expect(signedChange(0.7, 0.8, f)).toBe('-0.100')
    expect(signedChange(0.9, 0.8, f)).toBe('+0.100')
    expect(signedChange(0.8, 0.8, f)).toBe('0.000')
    expect(signedChange(0.80001, 0.8, f)).toBe('0.000')
    expect(signedChange(null, 0.8, f)).toBe('')
    expect(signedChange(0.8, null, f)).toBe('')
  })
})
