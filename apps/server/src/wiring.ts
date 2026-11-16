import { createCrossrefClient } from './clients/crossref.js'
import { createDoiClient } from './clients/doi.js'
import { createGeminiClient } from './clients/gemini.js'
import { createOpenAlexClient } from './clients/openalex.js'
import type { Env } from './config/env.js'
import type { Limits } from './config/limits.js'
import { RetrievalCache } from './lib/cache.js'
import { HttpClient } from './lib/http.js'
import type { PipelineDeps } from './pipeline/run.js'
import { TOOL_VERSION } from './version.js'

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
      doi: createDoiClient({ http, cache }),
    },
    gemini: env.geminiApiKey
      ? createGeminiClient({
          apiKey: env.geminiApiKey,
          model: env.geminiModel,
          temperature: env.geminiTemperature,
        })
      : undefined,
  }
}
