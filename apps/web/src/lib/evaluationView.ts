import type { EvaluationRun, EvaluationSummary } from '@cekkutip/shared/evaluation'

const SYSTEM_ORDER = ['cekkutip', 'b1_llm_only', 'b2_crossref_top1', 'b3_doi_check']
const SPLIT_ORDER = ['dev', 'test', 'all']

/** Full pipeline first, then its ablations in order, then the baselines. */
export function runOrder(a: EvaluationRun, b: EvaluationRun): number {
  const rank = (r: EvaluationRun) =>
    SYSTEM_ORDER.indexOf(r.system) * 10 + (r.ablation ? Number(r.ablation.slice(1)) : 0)
  return rank(a) - rank(b) || a.name.localeCompare(b.name)
}

export interface SplitGroup {
  split: string
  runs: EvaluationRun[]
  /** The full pipeline, which the ablations are compared with. */
  base: EvaluationRun | null
  ablations: EvaluationRun[]
}

/** Runs grouped by split (development first, then test), each group in a fixed order. */
export function groupBySplit(summary: EvaluationSummary): SplitGroup[] {
  const splits = [...new Set(summary.runs.map((r) => r.split))].sort(
    (a, b) => (SPLIT_ORDER.indexOf(a) + 1 || 99) - (SPLIT_ORDER.indexOf(b) + 1 || 99),
  )
  return splits.map((split) => {
    const runs = summary.runs.filter((r) => r.split === split).sort(runOrder)
    return {
      split,
      runs,
      base: runs.find((r) => r.system === 'cekkutip' && r.ablation === null) ?? null,
      ablations: runs.filter((r) => r.system === 'cekkutip' && r.ablation !== null),
    }
  })
}

/**
 * How many references the data set holds. With an "all" run, that run's count. Otherwise the splits
 * add up (development plus test), taking the largest count seen in each split.
 */
export function datasetSize(summary: EvaluationSummary): number {
  const all = summary.runs.filter((r) => r.split === 'all')
  if (all.length > 0) return Math.max(...all.map((r) => r.n))
  const perSplit = new Map<string, number>()
  for (const r of summary.runs) perSplit.set(r.split, Math.max(perSplit.get(r.split) ?? 0, r.n))
  return [...perSplit.values()].reduce((a, b) => a + b, 0)
}

export function numberFormatter(
  lang: 'en' | 'id',
  digits = 3,
): (v: number | null | undefined) => string {
  const f = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return (v) => (v === null || v === undefined ? '' : f.format(v))
}

/** "+0.123" or "-0.123", or an empty string when either side is missing. */
export function signedChange(
  value: number | null,
  base: number | null,
  fmt: (v: number) => string,
): string {
  if (value === null || base === null) return ''
  const d = value - base
  if (Math.abs(d) < 0.0005) return fmt(0)
  return `${d > 0 ? '+' : '-'}${fmt(Math.abs(d))}`
}
