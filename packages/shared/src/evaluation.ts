/**
 * The shape of eval/results/summary.json, written by `npm run eval:report` and shown on the Evaluation page.
 * Types only, plus a hand-written validator, so the browser does not need a schema library.
 */

export type VerdictName = 'verified' | 'mismatch' | 'suspect' | 'out_of_index'
export const VERDICT_NAMES: readonly VerdictName[] = [
  'verified',
  'mismatch',
  'suspect',
  'out_of_index',
]

export interface ScoredValue {
  value: number
  ci95: [number, number] | null
}

export interface EvaluationRun {
  /** For example "cekkutip.test" or "cekkutip-a1.test". */
  name: string
  system: string
  ablation: string | null
  split: string
  parseMode: string
  n: number
  macroF1: ScoredValue
  f1: Record<VerdictName, number>
  precision: Record<VerdictName, number>
  recall: Record<VerdictName, number>
  falseAccusationRate: { value: number | null; ci95: [number, number] | null; outOf: number }
  abstainRate: ScoredValue
  binaryVerified: { precision: number; recall: number; f1: number; accuracy: number }
  checkFailed: number
  medianLatencyMs: number
  costPer1000Usd: number | null
  tokens: { input: number; output: number }
  withoutPerturbed: {
    n: number
    macroF1: ScoredValue
    falseAccusationRate: number | null
    abstainRate: number
  } | null
  perturbedItems: number
}

export interface EvaluationKappa {
  n: number
  skipped: number
  observed: number | null
  expected: number | null
  kappa: number | null
  matrix: Record<VerdictName, Record<VerdictName, number>>
  dataset: { sha256: string; sample: boolean }
}

export interface EvaluationSummary {
  /** True when the numbers came from the template data. Such a summary is never shown. */
  sample: boolean
  generatedAt: string
  toolVersion: string | null
  commit: string | null
  uncommittedChanges: boolean
  model: string | null
  thresholds: { tauT: number; tauA: number; tauL: number; tauV: number } | null
  thresholdsSource: string | null
  datasetSha256: string[]
  bootstrap: { resamples: number; seed: number } | null
  runs: EvaluationRun[]
  kappa: EvaluationKappa | null
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const nullableFinite = (v: unknown): v is number | null => v === null || finite(v)
const nullableString = (v: unknown): v is string | null => v === null || typeof v === 'string'

function isInterval(v: unknown): v is [number, number] | null {
  return v === null || (Array.isArray(v) && v.length === 2 && finite(v[0]) && finite(v[1]))
}

function byVerdict(v: unknown): v is Record<VerdictName, number> {
  return isObj(v) && VERDICT_NAMES.every((k) => finite(v[k]))
}

function isScored(v: unknown): v is ScoredValue {
  return isObj(v) && finite(v.value) && isInterval(v.ci95)
}

function isRun(r: unknown): r is EvaluationRun {
  if (!isObj(r)) return false
  const fa = r.falseAccusationRate
  const bv = r.binaryVerified
  const tk = r.tokens
  const wp = r.withoutPerturbed
  return (
    typeof r.name === 'string' &&
    typeof r.system === 'string' &&
    nullableString(r.ablation) &&
    typeof r.split === 'string' &&
    typeof r.parseMode === 'string' &&
    finite(r.n) &&
    isScored(r.macroF1) &&
    byVerdict(r.f1) &&
    byVerdict(r.precision) &&
    byVerdict(r.recall) &&
    isObj(fa) &&
    nullableFinite(fa.value) &&
    isInterval(fa.ci95) &&
    finite(fa.outOf) &&
    isScored(r.abstainRate) &&
    isObj(bv) &&
    finite(bv.precision) &&
    finite(bv.recall) &&
    finite(bv.f1) &&
    finite(bv.accuracy) &&
    finite(r.checkFailed) &&
    finite(r.medianLatencyMs) &&
    nullableFinite(r.costPer1000Usd) &&
    isObj(tk) &&
    finite(tk.input) &&
    finite(tk.output) &&
    finite(r.perturbedItems) &&
    (wp === null ||
      (isObj(wp) &&
        finite(wp.n) &&
        isScored(wp.macroF1) &&
        nullableFinite(wp.falseAccusationRate) &&
        finite(wp.abstainRate)))
  )
}

function isKappa(k: unknown): k is EvaluationKappa {
  return (
    isObj(k) &&
    finite(k.n) &&
    finite(k.skipped) &&
    nullableFinite(k.observed) &&
    nullableFinite(k.expected) &&
    nullableFinite(k.kappa) &&
    isObj(k.matrix) &&
    VERDICT_NAMES.every(
      (a) =>
        isObj((k.matrix as Obj)[a]) &&
        VERDICT_NAMES.every((b) => finite(((k.matrix as Obj)[a] as Obj)[b])),
    )
  )
}

/**
 * Returns the summary when it is complete and shows real results. Returns null for anything else,
 * including a summary made from the template data (`sample: true`), and any missing or non-numeric value.
 * The Evaluation page shows its honest empty state whenever this returns null.
 */
export function parseEvaluationSummary(value: unknown): EvaluationSummary | null {
  if (!isObj(value)) return null
  if (value.sample !== false) return null // true, missing, or anything else: not real results
  const t = value.thresholds
  const b = value.bootstrap
  const ok =
    typeof value.generatedAt === 'string' &&
    nullableString(value.toolVersion) &&
    nullableString(value.commit) &&
    typeof value.uncommittedChanges === 'boolean' &&
    nullableString(value.model) &&
    nullableString(value.thresholdsSource) &&
    Array.isArray(value.datasetSha256) &&
    value.datasetSha256.every((h) => typeof h === 'string') &&
    (t === null ||
      (isObj(t) && finite(t.tauT) && finite(t.tauA) && finite(t.tauL) && finite(t.tauV))) &&
    (b === null || (isObj(b) && finite(b.resamples) && finite(b.seed))) &&
    Array.isArray(value.runs) &&
    value.runs.length > 0 &&
    value.runs.every(isRun) &&
    (value.kappa === null || (isKappa(value.kappa) && value.kappa.dataset.sample === false))
  return ok ? (value as unknown as EvaluationSummary) : null
}
