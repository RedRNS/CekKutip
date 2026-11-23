import { createCrossrefClient } from './clients/crossref.js'
import { createDataciteClient } from './clients/datacite.js'
import { createDoiClient } from './clients/doi.js'
import { createGeminiClient } from './clients/gemini.js'
import type { GeminiClient, GeminiOptions } from './clients/gemini.js'
import { createGeminiPool } from './clients/gemini-pool.js'
import { createOpenAlexClient } from './clients/openalex.js'
import type { Env } from './config/env.js'
import { GEMINI_KEY_COOLDOWN_MS } from './config/limits.js'
import type { Limits } from './config/limits.js'
import { RetrievalCache } from './lib/cache.js'
import { HttpClient } from './lib/http.js'
import type { PipelineDeps } from './pipeline/run.js'
import { TOOL_VERSION } from './version.js'

/** Builds a model client for one request from the person's own key. The model and temperature are the server's. */
export function buildGeminiFactory(env: Env): (apiKey: string) => GeminiClient {
  return (apiKey) =>
    createGeminiClient({ apiKey, model: env.geminiModel, temperature: env.geminiTemperature })
}

/**
 * The server's own model reader: none without keys, the client itself for one key (exactly as it
 * was before backup keys existed), and a pool that falls back from key to key for several.
 */
export function buildGeminiReader(
  env: Pick<Env, 'geminiApiKeys' | 'geminiModel' | 'geminiTemperature'>,
  create: (opts: GeminiOptions) => GeminiClient = createGeminiClient,
): GeminiClient | undefined {
  const clients = env.geminiApiKeys.map((apiKey) =>
    create({ apiKey, model: env.geminiModel, temperature: env.geminiTemperature }),
  )
  if (clients.length === 0) return undefined
  if (clients.length === 1) return clients[0]
  return createGeminiPool(clients, { cooldownMs: GEMINI_KEY_COOLDOWN_MS })
}

/** Build the real clients from the environment. */
export function buildPipelineDeps(env: Env, limits: Limits): PipelineDeps {
  const http = new HttpClient({
    userAgent: `CekKutip/${TOOL_VERSION}`,
    timeoutMs: limits.requestTimeoutMs,
  })
  const cache = new RetrievalCache({
    dir: env.retrievalCacheDir,
    replayOnly: env.retrievalCacheReplayOnly,
  })
  return {
    retrieve: {
      crossref: createCrossrefClient({ http, cache, mailto: env.crossrefMailto }),
      openalex: createOpenAlexClient({ http, cache, apiKey: env.openalexApiKey }),
      datacite: createDataciteClient({ http, cache, mailto: env.crossrefMailto }),
      doi: createDoiClient({ http, cache }),
    },
    gemini: buildGeminiReader(env),
  }
}
