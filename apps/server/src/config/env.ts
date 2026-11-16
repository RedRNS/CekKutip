export interface Env {
  nodeEnv: string
  port: number
  geminiApiKey: string | undefined
  geminiModel: string
  /** Sent to Gemini. Default 0 (brief 6.2). `GEMINI_TEMPERATURE=off` stops sending it. */
  geminiTemperature: number | undefined
  crossrefMailto: string | undefined
  openalexApiKey: string | undefined
  enableExperimentModes: boolean
  retrievalCacheDir: string | undefined
  retrievalCacheReplayOnly: boolean
  publicSiteUrl: string
  /** Number of proxy hops to trust for the client IP (rate limiting). 0 means none. */
  trustProxy: number
  logLevel: string
}

const text = (v: string | undefined): string | undefined => {
  const t = v?.trim()
  return t === undefined || t === '' ? undefined : t
}

const flag = (v: string | undefined): boolean =>
  ['1', 'true', 'yes'].includes(text(v)?.toLowerCase() ?? '')

function int(v: string | undefined, fallback: number): number {
  const t = text(v)
  if (t === undefined) return fallback
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = text(env.NODE_ENV) ?? 'development'
  const temperature = text(env.GEMINI_TEMPERATURE)?.toLowerCase()
  return {
    nodeEnv,
    port: int(env.PORT, 8787),
    geminiApiKey: text(env.GEMINI_API_KEY),
    geminiModel: text(env.GEMINI_MODEL) ?? DEFAULT_GEMINI_MODEL,
    geminiTemperature:
      temperature === 'off'
        ? undefined
        : temperature === undefined || Number.isNaN(Number(temperature))
          ? 0
          : Number(temperature),
    crossrefMailto: text(env.CROSSREF_MAILTO),
    openalexApiKey: text(env.OPENALEX_API_KEY),
    // Never on in production, whatever the variable says.
    enableExperimentModes: nodeEnv !== 'production' && flag(env.ENABLE_EXPERIMENT_MODES),
    retrievalCacheDir: text(env.RETRIEVAL_CACHE_DIR),
    retrievalCacheReplayOnly: flag(env.RETRIEVAL_CACHE_REPLAY_ONLY),
    publicSiteUrl: text(env.PUBLIC_SITE_URL) ?? 'http://localhost:8787',
    trustProxy: int(env.TRUST_PROXY, nodeEnv === 'production' ? 1 : 0),
    logLevel: text(env.LOG_LEVEL) ?? 'info',
  }
}
