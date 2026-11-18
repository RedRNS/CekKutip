/**
 * TEST FIXTURE. Every number below is INVENTED so that tests can check that the Evaluation page
 * shows exactly what a summary file contains. These are not results and must never be copied into
 * eval/results, the README, or any page.
 */
import type {
  EvaluationKappa,
  EvaluationRun,
  EvaluationSummary,
  VerdictName,
} from './evaluation.js'

const V: VerdictName[] = ['verified', 'mismatch', 'suspect', 'out_of_index']
const perVerdict = (a: number, b: number, c: number, d: number): Record<VerdictName, number> => ({
  verified: a,
  mismatch: b,
  suspect: c,
  out_of_index: d,
})

export function fixtureRun(
  over: Partial<EvaluationRun> & Pick<EvaluationRun, 'name' | 'system'>,
): EvaluationRun {
  return {
    ablation: null,
    split: 'test',
    parseMode: 'llm',
    n: 50,
    macroF1: { value: 0.8125, ci95: [0.7, 0.9] },
    f1: perVerdict(0.9, 0.75, 0.8, 0.7),
    precision: perVerdict(0.91, 0.76, 0.81, 0.71),
    recall: perVerdict(0.89, 0.74, 0.79, 0.69),
    falseAccusationRate: { value: 0.0625, ci95: [0.02, 0.12], outOf: 32 },
    abstainRate: { value: 0.25, ci95: [0.15, 0.35] },
    binaryVerified: { precision: 0.95, recall: 0.9, f1: 0.925, accuracy: 0.94 },
    checkFailed: 2,
    medianLatencyMs: 2300,
    costPer1000Usd: 0.4,
    tokens: { input: 12000, output: 9000 },
    withoutPerturbed: {
      n: 40,
      macroF1: { value: 0.8625, ci95: [0.75, 0.95] },
      falseAccusationRate: 0.05,
      abstainRate: 0.3,
    },
    perturbedItems: 10,
    ...over,
  }
}

export const FIXTURE_KAPPA: EvaluationKappa = {
  n: 130,
  skipped: 0,
  observed: 0.9,
  expected: 0.3,
  kappa: 0.857,
  matrix: {
    verified: { verified: 40, mismatch: 1, suspect: 0, out_of_index: 0 },
    mismatch: { verified: 1, mismatch: 25, suspect: 2, out_of_index: 0 },
    suspect: { verified: 0, mismatch: 1, suspect: 24, out_of_index: 1 },
    out_of_index: { verified: 0, mismatch: 0, suspect: 2, out_of_index: 32 },
  },
  dataset: { sha256: 'c'.repeat(64), sample: false },
}

export function fixtureSummary(over: Partial<EvaluationSummary> = {}): EvaluationSummary {
  const runs: EvaluationRun[] = [
    fixtureRun({
      name: 'b3_doi_check.test',
      system: 'b3_doi_check',
      parseMode: 'none',
      macroF1: { value: 0.2, ci95: [0.1, 0.3] },
      abstainRate: { value: 0, ci95: [0, 0] },
      costPer1000Usd: null,
    }),
    fixtureRun({
      name: 'cekkutip-a1.test',
      system: 'cekkutip',
      ablation: 'a1',
      macroF1: { value: 0.7125, ci95: [0.6, 0.8] },
      falseAccusationRate: { value: 0.3125, ci95: [0.2, 0.4], outOf: 32 },
      abstainRate: { value: 0, ci95: [0, 0] },
    }),
    fixtureRun({ name: 'cekkutip.test', system: 'cekkutip' }),
    fixtureRun({
      name: 'b1_llm_only.test',
      system: 'b1_llm_only',
      parseMode: 'none',
      macroF1: { value: 0.5, ci95: [0.4, 0.6] },
      falseAccusationRate: { value: 0.25, ci95: [0.15, 0.35], outOf: 32 },
    }),
    fixtureRun({
      name: 'cekkutip.dev',
      system: 'cekkutip',
      split: 'dev',
      n: 80,
      macroF1: { value: 0.8375, ci95: null },
    }),
  ]
  return {
    sample: false,
    generatedAt: '2026-12-10T08:00:00.000Z',
    toolVersion: '0.1.0',
    commit: 'abc1234',
    uncommittedChanges: false,
    model: 'gemini-test-model',
    thresholds: { tauT: 0.9, tauA: 0.6, tauL: 0.6, tauV: 0.4 },
    thresholdsSource: 'eval/results/thresholds.json',
    datasetSha256: ['d'.repeat(64)],
    bootstrap: { resamples: 1000, seed: 20261209 },
    runs,
    kappa: FIXTURE_KAPPA,
    ...over,
  }
}

export const VERDICT_LIST = V
