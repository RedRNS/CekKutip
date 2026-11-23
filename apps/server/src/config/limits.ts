/** How long a server Gemini key is skipped after it hit its limit or was refused (DECISIONS 138). */
export const GEMINI_KEY_COOLDOWN_MS = 5 * 60 * 1000

export interface Limits {
  maxReferences: number
  maxReferenceChars: number
  maxBodyBytes: number
  rateLimitWindowMs: number
  rateLimitMax: number
  retrievalConcurrency: number
  requestTimeoutMs: number
  parseBatchSize: number
}

function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function loadLimits(env: NodeJS.ProcessEnv = process.env): Limits {
  return {
    maxReferences: intFromEnv(env.MAX_REFERENCES, 40),
    maxReferenceChars: intFromEnv(env.MAX_REFERENCE_CHARS, 600),
    maxBodyBytes: 64 * 1024,
    rateLimitWindowMs: intFromEnv(env.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    rateLimitMax: intFromEnv(env.RATE_LIMIT_MAX, 10),
    retrievalConcurrency: 3, // Crossref polite pool allows 3 at a time
    requestTimeoutMs: 8000,
    parseBatchSize: 8,
  }
}
