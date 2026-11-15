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
    retrievalConcurrency: 4,
    requestTimeoutMs: 8000,
    parseBatchSize: 8,
  }
}
