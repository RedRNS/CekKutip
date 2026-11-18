import type { Verdict } from '@cekkutip/shared'
import { GOLD_LABELS } from './dataset.js'
import type { RunResult } from './evaluate.js'
import type { Metrics } from './metrics.js'

export type RunFile = Omit<RunResult, 'predictions'>

export interface KappaFile {
  n: number
  skipped: number
  observed: number | null
  expected: number | null
  kappa: number | null
  matrix: Record<Verdict, Record<Verdict, number>>
  dataset: { sha256: string; sample: boolean }
}

interface Scored {
  value: number
  ci95: [number, number] | null
}

export interface SummaryRun {
  name: string
  system: string
  ablation: string | null
  split: string
  parseMode: string
  n: number
  macroF1: Scored
  f1: Record<Verdict, number>
  precision: Record<Verdict, number>
  recall: Record<Verdict, number>
  falseAccusationRate: { value: number | null; ci95: [number, number] | null; outOf: number }
  abstainRate: Scored
  binaryVerified: Metrics['binaryVerified']
  checkFailed: number
  medianLatencyMs: number
  costPer1000Usd: number | null
  tokens: { input: number; output: number }
  /** The same headline figures without synthetic items, when the split has any. */
  withoutPerturbed: {
    n: number
    macroF1: Scored
    falseAccusationRate: number | null
    abstainRate: number
  } | null
  perturbedItems: number
}

export interface Summary {
  /** True when any run used the template data. A sample summary must never be shown as results. */
  sample: boolean
  generatedAt: string
  toolVersion: string | null
  commit: string | null
  uncommittedChanges: boolean
  model: string | null
  thresholds: RunFile['meta']['thresholds'] | null
  thresholdsSource: string | null
  datasetSha256: string[]
  bootstrap: RunFile['meta']['bootstrap'] | null
  runs: SummaryRun[]
  kappa: KappaFile | null
}

const pick = <T>(m: Metrics, f: (s: Metrics['perVerdict'][Verdict]) => T) =>
  Object.fromEntries(GOLD_LABELS.map((l) => [l, f(m.perVerdict[l])])) as Record<Verdict, T>

export function summarize(runs: RunFile[], kappa: KappaFile | null, now = new Date()): Summary {
  const sorted = [...runs].sort((a, b) => a.name.localeCompare(b.name))
  const main = sorted.find((r) => r.meta.system === 'cekkutip' && !r.meta.ablation) ?? sorted[0]
  return {
    sample: sorted.some((r) => r.meta.dataset.sample) || (kappa?.dataset.sample ?? false),
    generatedAt: now.toISOString(),
    toolVersion: main?.meta.toolVersion ?? null,
    commit: main?.meta.commit ?? null,
    uncommittedChanges: sorted.some((r) => r.meta.uncommittedChanges === true),
    model: sorted.find((r) => r.meta.model)?.meta.model ?? null,
    thresholds: main?.meta.thresholds ?? null,
    thresholdsSource: main?.meta.thresholdsSource ?? null,
    datasetSha256: [...new Set(sorted.map((r) => r.meta.dataset.sha256))],
    bootstrap: main?.meta.bootstrap ?? null,
    kappa,
    runs: sorted.map((r) => {
      const m = r.subsets.all
      const w = r.subsets.without_perturbed
      return {
        name: r.name,
        system: r.meta.system,
        ablation: r.meta.ablation,
        split: r.meta.split,
        parseMode: r.meta.parseMode,
        n: m.n,
        macroF1: m.macroF1,
        f1: pick(m, (s) => s.f1),
        precision: pick(m, (s) => s.precision),
        recall: pick(m, (s) => s.recall),
        falseAccusationRate: m.falseAccusationRate,
        abstainRate: m.abstainRate,
        binaryVerified: m.binaryVerified,
        checkFailed: m.checkFailed,
        medianLatencyMs: r.latency.medianMs,
        costPer1000Usd: r.cost.per1000Usd,
        tokens: r.tokens,
        withoutPerturbed: w
          ? {
              n: w.n,
              macroF1: w.macroF1,
              falseAccusationRate: w.falseAccusationRate.value,
              abstainRate: w.abstainRate.value,
            }
          : null,
        perturbedItems: r.sourceTypes.perturbed,
      }
    }),
  }
}

const num = (v: number | null | undefined, digits = 3) =>
  v === null || v === undefined ? 'n/a' : v.toFixed(digits)
const ci = (s: { value: number | null; ci95: [number, number] | null }) =>
  s.value === null
    ? 'n/a'
    : s.ci95
      ? `${num(s.value)} [${num(s.ci95[0])}, ${num(s.ci95[1])}]`
      : num(s.value)
const table = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')

/** Markdown tables, ready to paste into the paper. */
export function renderMarkdown(s: Summary): string {
  const out: string[] = ['# CekKutip evaluation report', '']
  if (s.sample) {
    out.push(
      '> **SAMPLE DATA.** These tables come from the template file. They show that the harness runs.',
      '> They are not results and must not be published or quoted.',
      '',
    )
  }
  out.push(
    `Generated ${s.generatedAt}. Tool ${s.toolVersion ?? 'n/a'}, commit ${s.commit ?? 'n/a'}${s.uncommittedChanges ? ' (with uncommitted changes)' : ''}. Model: ${s.model ?? 'none'}.`,
  )
  if (s.thresholds) {
    const t = s.thresholds
    out.push(
      `Thresholds: TAU_T ${t.tauT}, TAU_A ${t.tauA}, TAU_L ${t.tauL}, TAU_V ${t.tauV} (${s.thresholdsSource ?? 'n/a'}).`,
    )
  }
  if (s.bootstrap) {
    out.push(
      `Intervals: 95% percentile bootstrap, ${s.bootstrap.resamples} resamples, seed ${s.bootstrap.seed}.`,
    )
  }
  out.push('')

  const splits = [...new Set(s.runs.map((r) => r.split))]
  for (const split of splits) {
    const runs = s.runs.filter((r) => r.split === split)
    out.push(`## Split: ${split}`, '')
    out.push('### Main comparison', '')
    out.push(
      table(
        [
          'Run',
          'n',
          'Macro-F1 [95% CI]',
          'False accusation rate [95% CI]',
          'Abstain rate [95% CI]',
          'Median latency (ms)',
          'Cost per 1,000 (USD)',
          'Could not check',
        ],
        runs.map((r) => [
          r.name,
          String(r.n),
          ci(r.macroF1),
          ci(r.falseAccusationRate),
          ci(r.abstainRate),
          String(r.medianLatencyMs),
          r.costPer1000Usd === null ? 'n/a' : r.costPer1000Usd.toFixed(4),
          String(r.checkFailed),
        ]),
      ),
      '',
    )
    out.push(
      '_Latency is meaningful only for a run that made its own requests (an empty cache). A run that replays cached lookups and model answers shows much lower latency. Token counts and cost are replayed from the cache and stay valid._',
      '',
    )
    out.push('### F1 per verdict', '')
    out.push(
      table(
        ['Run', ...GOLD_LABELS],
        runs.map((r) => [r.name, ...GOLD_LABELS.map((l) => num(r.f1[l]))]),
      ),
      '',
    )
    out.push('### Verified against not verified (binary)', '')
    out.push(
      table(
        ['Run', 'Precision', 'Recall', 'F1', 'Accuracy'],
        runs.map((r) => [
          r.name,
          num(r.binaryVerified.precision),
          num(r.binaryVerified.recall),
          num(r.binaryVerified.f1),
          num(r.binaryVerified.accuracy),
        ]),
      ),
      '',
    )
    const base = runs.find((r) => r.system === 'cekkutip' && !r.ablation)
    const ablations = runs.filter((r) => r.system === 'cekkutip' && r.ablation)
    if (base && ablations.length > 0) {
      out.push('### Ablations (change against the full pipeline)', '')
      const d = (v: number | null, b: number | null) =>
        v === null || b === null ? 'n/a' : `${v - b >= 0 ? '+' : ''}${(v - b).toFixed(3)}`
      out.push(
        table(
          [
            'Run',
            'Macro-F1',
            'Change',
            'False accusation rate',
            'Change',
            'Abstain rate',
            'Change',
          ],
          [base, ...ablations].map((r) => [
            r.name,
            num(r.macroF1.value),
            r === base ? '' : d(r.macroF1.value, base.macroF1.value),
            num(r.falseAccusationRate.value),
            r === base ? '' : d(r.falseAccusationRate.value, base.falseAccusationRate.value),
            num(r.abstainRate.value),
            r === base ? '' : d(r.abstainRate.value, base.abstainRate.value),
          ]),
        ),
        '',
      )
    }
    const withSynthetic = runs.filter((r) => r.withoutPerturbed)
    if (withSynthetic.length > 0) {
      out.push('### With and without synthetic (perturbed) items', '')
      out.push(
        table(
          [
            'Run',
            'Perturbed items',
            'Macro-F1, all',
            'Macro-F1, without',
            'False accusation rate, all',
            'Without',
          ],
          withSynthetic.map((r) => [
            r.name,
            String(r.perturbedItems),
            ci(r.macroF1),
            ci(r.withoutPerturbed!.macroF1),
            num(r.falseAccusationRate.value),
            num(r.withoutPerturbed!.falseAccusationRate),
          ]),
        ),
        '',
      )
    }
  }

  if (s.kappa) {
    const k = s.kappa
    out.push('## Agreement between labelers', '')
    out.push(
      `Cohen kappa ${num(k.kappa)} on ${k.n} references (observed agreement ${num(k.observed)}, expected by chance ${num(k.expected)}). ${k.skipped} without two labels were left out.`,
      '',
    )
    out.push(
      table(
        ['Labeler 1 \\ Labeler 2', ...GOLD_LABELS],
        GOLD_LABELS.map((a) => [a, ...GOLD_LABELS.map((b) => String(k.matrix[a][b]))]),
      ),
      '',
    )
  }
  return out.join('\n')
}
