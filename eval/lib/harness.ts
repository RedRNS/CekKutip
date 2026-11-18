import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Thresholds } from '@cekkutip/shared'
import { loadEnv } from '../../apps/server/src/config/env.js'
import { loadLimits } from '../../apps/server/src/config/limits.js'
import { DEFAULT_THRESHOLDS } from '../../apps/server/src/config/thresholds.js'
import type { PipelineDeps } from '../../apps/server/src/pipeline/run.js'
import { TOOL_VERSION } from '../../apps/server/src/version.js'
import { buildPipelineDeps } from '../../apps/server/src/wiring.js'
import { cachedGemini, cachedVerdictModel, createVerdictModel } from './model-cache.js'
import type { VerdictModel } from './model-cache.js'

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const OFFICIAL_RESULTS = path.join(REPO_ROOT, 'eval', 'results')
export const SAMPLE_RESULTS = path.join(REPO_ROOT, 'eval', 'results-sample')
export const DEFAULT_DATA = path.join(REPO_ROOT, 'eval', 'data', 'references.csv')
export const TEMPLATE_DATA = path.join(REPO_ROOT, 'eval', 'data', 'references.template.csv')
export const DEFAULT_CACHE = path.join(REPO_ROOT, 'eval', 'cache')

/** Minimal "--name value" and "--flag" parser. Unknown options are an error, to catch typos. */
export function parseArgs(
  argv: string[],
  known: Record<string, 'value' | 'flag'>,
): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string
    if (!a.startsWith('--')) throw new Error(`Unexpected argument "${a}"`)
    const name = a.slice(2)
    const kind = known[name]
    if (!kind)
      throw new Error(
        `Unknown option --${name}. Known: ${Object.keys(known)
          .map((k) => `--${k}`)
          .join(', ')}`,
      )
    if (kind === 'flag') out[name] = true
    else {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`Option --${name} needs a value`)
      out[name] = v
    }
  }
  return out
}

export function gitInfo(): { commit: string | null; dirty: boolean | null } {
  try {
    const run = (cmd: string) =>
      execSync(cmd, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
    return {
      commit: run('git rev-parse --short HEAD'),
      dirty: run('git status --porcelain') !== '',
    }
  } catch {
    return { commit: null, dirty: null }
  }
}

export interface TunedThresholds {
  thresholds: Thresholds
  b2Threshold: number
}

export const DEFAULT_B2_THRESHOLD = 0.9

/** Thresholds from a tuning run when the file exists, else the provisional defaults. */
export function loadThresholds(file: string): TunedThresholds & { source: string } {
  if (existsSync(file)) {
    const j = JSON.parse(readFileSync(file, 'utf8')) as Partial<TunedThresholds>
    if (j.thresholds && typeof j.b2Threshold === 'number') {
      return {
        thresholds: j.thresholds,
        b2Threshold: j.b2Threshold,
        source: path.relative(REPO_ROOT, file).split(path.sep).join('/'),
      }
    }
  }
  return {
    thresholds: DEFAULT_THRESHOLDS,
    b2Threshold: DEFAULT_B2_THRESHOLD,
    source: 'defaults (not tuned)',
  }
}

export interface Clients {
  deps: PipelineDeps
  verdictModel: VerdictModel | undefined
  model: string
  aiAvailable: boolean
  toolVersion: string
  retrievalCacheDir: string
  replayOnly: boolean
}

/**
 * Real clients for the harness, all behind file caches so a run can be repeated exactly:
 * lookups in <cache>/retrieval, model answers in <cache>/model.
 */
export function buildClients(opts: {
  cacheDir: string
  replayOnly: boolean
  env?: NodeJS.ProcessEnv
}): Clients {
  const retrievalCacheDir = path.join(opts.cacheDir, 'retrieval')
  const env = {
    ...loadEnv(opts.env ?? process.env),
    retrievalCacheDir,
    retrievalCacheReplayOnly: opts.replayOnly,
  }
  const deps = buildPipelineDeps(env, loadLimits(opts.env ?? process.env))
  const modelCache = {
    dir: path.join(opts.cacheDir, 'model'),
    model: env.geminiModel,
    replayOnly: opts.replayOnly,
  }
  if (deps.gemini) deps.gemini = cachedGemini(deps.gemini, modelCache)
  const verdictModel = env.geminiApiKey
    ? cachedVerdictModel(
        createVerdictModel({
          apiKey: env.geminiApiKey,
          model: env.geminiModel,
          temperature: env.geminiTemperature,
        }),
        modelCache,
      )
    : undefined
  return {
    deps,
    verdictModel,
    model: env.geminiModel,
    aiAvailable: deps.gemini !== undefined,
    toolVersion: TOOL_VERSION,
    retrievalCacheDir,
    replayOnly: opts.replayOnly,
  }
}

export function pricePerMillion(env: NodeJS.ProcessEnv = process.env) {
  const num = (v: string | undefined) => {
    const n = Number(v)
    return v !== undefined && v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null
  }
  return { input: num(env.PRICE_INPUT_PER_M), output: num(env.PRICE_OUTPUT_PER_M) }
}

/** Cost per 1,000 references from measured tokens and the prices in the environment. Null without prices. */
export function costPer1000(
  tokens: { inputTokens: number; outputTokens: number },
  n: number,
  price: { input: number | null; output: number | null },
): number | null {
  if (price.input === null || price.output === null || n === 0) return null
  const total = (tokens.inputTokens * price.input + tokens.outputTokens * price.output) / 1_000_000
  return (total / n) * 1000
}
