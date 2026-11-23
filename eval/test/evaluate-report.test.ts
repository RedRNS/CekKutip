import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Verdict } from '@cekkutip/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLDS } from '../../apps/server/src/config/thresholds.js'
import {
  FAKE_JOURNAL,
  REF_FAKE_DOI,
  REF_OK,
  REF_WITH_DOI,
  THESIS,
  world,
} from '../../apps/server/test/world.js'
import type { DatasetRow, SourceType } from '../lib/dataset.js'
import { evaluateRun, runName } from '../lib/evaluate.js'
import type { RunResult } from '../lib/evaluate.js'
import {
  DEFAULT_B2_THRESHOLD,
  OFFICIAL_RESULTS,
  REPO_ROOT,
  TEMPLATE_DATA,
  costPer1000,
  loadThresholds,
  parseArgs,
  pricePerMillion,
} from '../lib/harness.js'
import type { Clients } from '../lib/harness.js'
import { renderMarkdown, summarize } from '../lib/report.js'
import type { RunFile } from '../lib/report.js'

const NOW = new Date('2026-11-16')
const row = (
  id: string,
  text: string,
  gold: Verdict,
  sourceType: SourceType = 'real',
  split: 'dev' | 'test' = 'test',
): DatasetRow => ({
  id,
  split,
  text,
  gold,
  sourceType,
  labeler1: gold,
  labeler2: gold,
  notes: '',
})

const ROWS = [
  row('T1', REF_OK, 'verified'),
  row('T2', REF_WITH_DOI, 'verified'),
  row('T3', REF_FAKE_DOI, 'suspect', 'perturbed'),
  row('T4', THESIS, 'out_of_index'),
  row('T5', FAKE_JOURNAL, 'suspect', 'model_generated'),
]

const clientsFor = (w = world()): Clients => ({
  deps: w.deps,
  verdictModel: undefined,
  model: 'test-model',
  aiAvailable: false,
  toolVersion: '9.9.9',
  retrievalCacheDir: '',
  replayOnly: false,
})

const tuned = {
  thresholds: DEFAULT_THRESHOLDS,
  b2Threshold: DEFAULT_B2_THRESHOLD,
  source: 'defaults (not tuned)',
}
const dataset = { file: 'eval/data/test.csv', sha256: 'a'.repeat(64), sample: false }

const run = (over: Partial<Parameters<typeof evaluateRun>[0]> = {}) =>
  evaluateRun({
    spec: { system: 'cekkutip', split: 'test', parseMode: 'regex' },
    rows: ROWS,
    dataset,
    clients: clientsFor(),
    tuned,
    price: { input: null, output: null },
    now: () => NOW,
    ...over,
  })

describe('evaluateRun', () => {
  it('scores every reference, in order, and records how the run was made', async () => {
    const r = await run()
    expect(r.name).toBe('cekkutip.test')
    expect(r.predictions.map((p) => p.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
    expect(r.predictions.map((p) => p.predicted)).toEqual([
      'verified',
      'verified',
      'suspect',
      'out_of_index',
      'suspect',
    ])
    expect(r.predictions.every((p) => p.correct)).toBe(true)
    expect(r.subsets.all.macroF1.value).toBe(1)
    expect(r.subsets.all.n).toBe(5)

    expect(r.meta).toMatchObject({
      system: 'cekkutip',
      ablation: null,
      split: 'test',
      parseMode: 'regex',
      model: null, // no model was used, so none is claimed
      toolVersion: '9.9.9',
      thresholds: DEFAULT_THRESHOLDS,
      thresholdsSource: 'defaults (not tuned)',
      date: NOW.toISOString(),
      replayOnly: false,
      dataset: { file: 'eval/data/test.csv', n: 5, sample: false },
      bootstrap: { resamples: 1000 },
    })
    expect(r.sourceTypes).toEqual({ real: 3, model_generated: 1, perturbed: 1 })
    expect(r.latency.medianMs).toBeGreaterThanOrEqual(0)
  })

  it('reports the same figures without the perturbed items', async () => {
    const r = await run()
    expect(r.subsets.without_perturbed?.n).toBe(4)
    const none = await run({ rows: ROWS.filter((x) => x.sourceType !== 'perturbed') })
    expect(none.subsets.without_perturbed).toBeNull() // nothing to leave out
  })

  it('is repeatable: two runs give identical metrics and intervals', async () => {
    const a = await run()
    const b = await run()
    expect(b.subsets).toEqual(a.subsets)
    expect(b.predictions.map((p) => p.predicted)).toEqual(a.predictions.map((p) => p.predicted))
  })

  it('applies an ablation and names the run after it', async () => {
    const r = await run({
      spec: { system: 'cekkutip', ablation: 'a1', split: 'test', parseMode: 'regex' },
    })
    expect(r.name).toBe('cekkutip-a1.test')
    expect(r.meta.ablation).toBe('a1')
    expect(r.predictions.find((p) => p.id === 'T4')?.predicted).toBe('suspect') // no abstain: the thesis becomes Suspect
    expect(r.subsets.all.abstainRate.value).toBe(0)
    expect(r.subsets.all.falseAccusationRate.value).toBeGreaterThan(0) // and is now an accusation
  })

  it('A3 reads references without the model, A2 never calls OpenAlex, A4 ignores authors', async () => {
    const a3 = await run({
      spec: { system: 'cekkutip', ablation: 'a3', split: 'test', parseMode: 'regex' },
    })
    expect(a3.meta.parseMode).toBe('regex')
    const w = world()
    await run({
      spec: { system: 'cekkutip', ablation: 'a2', split: 'test', parseMode: 'regex' },
      clients: clientsFor(w),
    })
    expect(w.calls.some((c) => c.url.includes('openalex'))).toBe(false)
    const a4 = await run({
      spec: { system: 'cekkutip', ablation: 'a4', split: 'test', parseMode: 'regex' },
    })
    expect(a4.meta.ablation).toBe('a4')
  })

  it('refuses an ablation on a baseline, and model parsing without a key', async () => {
    await expect(
      run({ spec: { system: 'b3_doi_check', ablation: 'a1', split: 'test', parseMode: 'regex' } }),
    ).rejects.toThrow(/Ablations apply to the cekkutip system only/)
    await expect(
      run({ spec: { system: 'cekkutip', split: 'test', parseMode: 'llm' } }),
    ).rejects.toThrow(/GEMINI_API_KEY/)
  })

  it('runs the baselines on the same rows', async () => {
    const b3 = await run({ spec: { system: 'b3_doi_check', split: 'test', parseMode: 'regex' } })
    expect(b3.meta.parseMode).toBe('none')
    // Only T2 carries a registered DOI; the rest have none, or have one that is not registered.
    expect(b3.predictions.map((p) => p.predicted)).toEqual([
      'suspect',
      'verified',
      'suspect',
      'suspect',
      'suspect',
    ])
    expect(b3.subsets.all.macroF1.value).toBeLessThan(1)
    const b2 = await run({
      spec: { system: 'b2_crossref_top1', split: 'test', parseMode: 'regex' },
    })
    expect(b2.meta.b2Threshold).toBe(0.9)
    expect(b2.meta.model).toBeNull()
  })

  it('a service failure is counted as "could not check" and as wrong, never as an accusation', async () => {
    const r = await run({
      clients: clientsFor(
        world([
          { repeat: true, match: () => true, respond: () => new Response('', { status: 503 }) },
        ]),
      ),
    })
    expect(r.subsets.all.checkFailed).toBe(5)
    expect(r.subsets.all.falseAccusationRate.value).toBe(0)
    expect(r.predictions.every((p) => !p.correct)).toBe(true)
  })

  it('marks template data as sample in every run it makes', async () => {
    const r = await run({ dataset: { ...dataset, sample: true } })
    expect(r.meta.dataset.sample).toBe(true)
  })

  it('turns tokens and prices into a cost per 1,000 references, and says n/a without prices', async () => {
    expect((await run()).cost.per1000Usd).toBeNull()
    expect(
      costPer1000({ inputTokens: 1_000_000, outputTokens: 500_000 }, 100, {
        input: 0.1,
        output: 0.4,
      }),
    ).toBeCloseTo(((0.1 + 0.2) / 100) * 1000)
    expect(costPer1000({ inputTokens: 5, outputTokens: 5 }, 0, { input: 1, output: 1 })).toBeNull()
    expect(
      costPer1000({ inputTokens: 5, outputTokens: 5 }, 10, { input: null, output: 1 }),
    ).toBeNull()
  })

  it('names a run after its system, ablation, and split', () => {
    expect(runName({ system: 'cekkutip', ablation: 'a2', split: 'dev' })).toBe('cekkutip-a2.dev')
  })
})

describe('harness helpers', () => {
  it('parseArgs reads values and flags and rejects typos', () => {
    const known = { split: 'value', 'replay-only': 'flag' } as const
    expect(parseArgs(['--split', 'dev', '--replay-only'], known)).toEqual({
      split: 'dev',
      'replay-only': true,
    })
    expect(() => parseArgs(['--splt', 'dev'], known)).toThrow(/Unknown option --splt/)
    expect(() => parseArgs(['--split'], known)).toThrow(/needs a value/)
    expect(() => parseArgs(['--split', '--replay-only'], known)).toThrow(/needs a value/)
    expect(() => parseArgs(['dev'], known)).toThrow(/Unexpected argument/)
  })

  it('reads prices from the environment and ignores junk', () => {
    expect(pricePerMillion({ PRICE_INPUT_PER_M: '0.1', PRICE_OUTPUT_PER_M: '0.4' })).toEqual({
      input: 0.1,
      output: 0.4,
    })
    expect(pricePerMillion({ PRICE_INPUT_PER_M: '', PRICE_OUTPUT_PER_M: 'abc' })).toEqual({
      input: null,
      output: null,
    })
    expect(pricePerMillion({})).toEqual({ input: null, output: null })
  })

  it('reads tuned thresholds from a file and reports a repository-relative source', () => {
    const dir = mkdtempSync(path.join(REPO_ROOT, 'eval', 'cache-test-'))
    try {
      const file = path.join(dir, 'thresholds.json')
      writeFileSync(
        file,
        JSON.stringify({
          thresholds: { tauT: 0.85, tauA: 0.5, tauL: 0.6, tauV: 0.3 },
          b2Threshold: 0.7,
        }),
      )
      const t = loadThresholds(file)
      expect(t.thresholds).toEqual({ tauT: 0.85, tauA: 0.5, tauL: 0.6, tauV: 0.3 })
      expect(t.b2Threshold).toBe(0.7)
      expect(t.source).toMatch(/^eval\/cache-test-[^/]+\/thresholds\.json$/)
      expect(t.source).not.toMatch(/[A-Za-z]:|\\/) // no drive letter, no backslashes
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ignores a thresholds file that is incomplete', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cekkutip-thr-'))
    try {
      const file = path.join(dir, 'thresholds.json')
      writeFileSync(file, JSON.stringify({ thresholds: { tauT: 0.85 } }))
      expect(loadThresholds(file).source).toMatch(/not tuned/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('uses the provisional defaults, and says so, when nothing has been tuned', () => {
    const t = loadThresholds(path.join(tmpdir(), 'no-such-thresholds.json'))
    expect(t.thresholds).toEqual(DEFAULT_THRESHOLDS)
    expect(t.b2Threshold).toBe(DEFAULT_B2_THRESHOLD)
    expect(t.source).toMatch(/not tuned/)
  })
})

describe('summary and report', () => {
  const asFile = (r: RunResult): RunFile => {
    const { predictions: _predictions, ...rest } = r
    void _predictions
    return rest
  }

  it('summarizes runs without any per-reference data, and flags sample data', async () => {
    const sample = await run({ dataset: { ...dataset, sample: true } })
    const s = summarize([asFile(sample)], null, NOW)
    expect(s.sample).toBe(true)
    expect(s.runs).toHaveLength(1)
    expect(s.runs[0]).toMatchObject({ name: 'cekkutip.test', n: 5 })
    expect(JSON.stringify(s)).not.toContain('Walters') // no reference text
    expect(JSON.stringify(s)).not.toContain('"T1"') // no ids
    const real = summarize([asFile(await run())], null, NOW)
    expect(real.sample).toBe(false)
  })

  it('a sample summary says so in the report, in plain words', async () => {
    const sample = await run({ dataset: { ...dataset, sample: true } })
    const md = renderMarkdown(summarize([asFile(sample)], null, NOW))
    expect(md).toMatch(/SAMPLE DATA/)
    expect(md).toMatch(/must not be published/)
    const real = renderMarkdown(summarize([asFile(await run())], null, NOW))
    expect(real).not.toMatch(/SAMPLE DATA/)
  })

  it('writes the tables for the paper: main comparison, per-verdict F1, binary, ablations, synthetic items', async () => {
    const runs = await Promise.all([
      run(),
      run({ spec: { system: 'cekkutip', ablation: 'a1', split: 'test', parseMode: 'regex' } }),
      run({ spec: { system: 'b3_doi_check', split: 'test', parseMode: 'regex' } }),
      run({ spec: { system: 'b2_crossref_top1', split: 'test', parseMode: 'regex' } }),
    ])
    const s = summarize(runs.map(asFile), null, NOW)
    const md = renderMarkdown(s)
    for (const heading of [
      '## Split: test',
      '### Main comparison',
      '### F1 per verdict',
      '### Verified against not verified (binary)',
      '### Ablations (change against the full pipeline)',
      '### With and without synthetic (perturbed) items',
    ]) {
      expect(md).toContain(heading)
    }
    expect(md).toContain('| cekkutip.test | 5 | 1.000 [')
    expect(md).toContain('cekkutip-a1.test')
    expect(md).toContain('b2_crossref_top1.test')
    expect(md).toMatch(/Intervals: 95% percentile bootstrap, 1000 resamples, seed \d+/)
    expect(md).toMatch(/Latency is meaningful only for a run that made its own requests/)
    expect(md).toContain(
      'Thresholds: TAU_T 0.9, TAU_A 0.6, TAU_L 0.6, TAU_V 0.4 (defaults (not tuned))',
    )
    // the full pipeline is the first row of the ablation table and the others show a change against it
    expect(md).toMatch(/\| cekkutip-a1\.test \| [0-9.]+ \| -[0-9.]+ \|/)
  })

  it('includes the labeler agreement when it was computed', async () => {
    const kappa = {
      n: 4,
      skipped: 1,
      observed: 0.75,
      expected: 0.5,
      kappa: 0.5,
      matrix: {
        verified: { verified: 2, mismatch: 0, suspect: 0, out_of_index: 0 },
        mismatch: { verified: 1, mismatch: 0, suspect: 0, out_of_index: 0 },
        suspect: { verified: 0, mismatch: 0, suspect: 1, out_of_index: 0 },
        out_of_index: { verified: 0, mismatch: 0, suspect: 0, out_of_index: 0 },
      },
      dataset: { sha256: 'b'.repeat(64), sample: false },
    }
    const md = renderMarkdown(summarize([asFile(await run())], kappa, NOW))
    expect(md).toContain('## Agreement between labelers')
    expect(md).toContain('Cohen kappa 0.500 on 4 references')
  })
})

describe('the scripts, end to end, on the template data with no network', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })
  const tsx = (script: string, args: string[]) =>
    spawnSync('npx', ['tsx', `eval/scripts/${script}`, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: true,
      env: {
        ...process.env,
        GEMINI_API_KEY: '',
        GEMINI_API_KEY_2: '',
        GEMINI_API_KEY_3: '',
        CROSSREF_MAILTO: '',
        OPENALEX_API_KEY: '',
      },
    })

  it('refuses to write results made from the template into eval/results', () => {
    const before = existsSync(OFFICIAL_RESULTS) ? readdirSync(OFFICIAL_RESULTS) : []
    const res = tsx('run.ts', [
      '--system',
      'b3_doi_check',
      '--out',
      'eval/results',
      '--replay-only',
      '--cache',
      os(),
    ])
    expect(res.status).not.toBe(0)
    expect(res.stderr).toMatch(/TEMPLATE data/)
    expect(existsSync(OFFICIAL_RESULTS) ? readdirSync(OFFICIAL_RESULTS) : []).toEqual(before)

    expect(tsx('kappa.ts', ['--out', 'eval/results']).status).not.toBe(0)
    expect(tsx('tune.ts', ['--out', 'eval/results']).status).not.toBe(0)
  }, 90_000)

  function os() {
    const d = mkdtempSync(path.join(tmpdir(), 'cekkutip-evalcache-'))
    dirs.push(d)
    return d
  }

  it('kappa and report work on the template, and the report is stamped as a sample', () => {
    const out = os()
    const kappa = tsx('kappa.ts', ['--out', out])
    expect(kappa.status).toBe(0)
    expect(kappa.stdout).toMatch(/Labeled by both: 12 of 12/)
    expect(kappa.stdout).toMatch(/TEMPLATE DATA/)
    const k = JSON.parse(readFileSync(path.join(out, 'kappa.json'), 'utf8')) as {
      n: number
      kappa: number
      dataset: { sample: boolean }
    }
    expect(k.n).toBe(12)
    expect(k.dataset.sample).toBe(true)
    expect(k.kappa).toBeGreaterThan(0.5) // the labelers disagree on one row only
    expect(k.kappa).toBeLessThan(1)
  }, 60_000)

  it('the template is the file the scripts read when no data file exists', () => {
    expect(existsSync(TEMPLATE_DATA)).toBe(true)
    expect(existsSync(path.join(REPO_ROOT, 'eval', 'data', 'references.csv'))).toBe(false)
  })
})
