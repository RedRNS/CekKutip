import { RetrievalCache, hashKey } from '../lib/cache.js'
import { HttpClient, ServiceUnavailableError } from '../lib/http.js'
import { Scheduler } from '../lib/scheduler.js'

/**
 * Result of asking doi.org which agency registered a DOI.
 * `not_registered` covers "DOI does not exist" and "Invalid DOI".
 */
export type RegistrationAgency = { kind: 'registered'; agency: string } | { kind: 'not_registered' }

export interface DoiClient {
  /** Which registration agency (Crossref, DataCite, ...) holds this DOI. */
  getAgency(doi: string): Promise<RegistrationAgency>
}

export interface DoiClientOptions {
  http: HttpClient
  cache?: RetrievalCache
  scheduler?: Scheduler
}

const NOT_REGISTERED = new Set(['doi does not exist', 'invalid doi'])

/** Exported for tests. Anything doi.org says that we do not understand is a bad response, never a verdict. */
export function interpretDoiRa(json: unknown): RegistrationAgency {
  const entry = Array.isArray(json) ? json[0] : null
  if (typeof entry === 'object' && entry !== null) {
    const { RA, status } = entry as { RA?: unknown; status?: unknown }
    if (typeof RA === 'string' && RA.trim() !== '') return { kind: 'registered', agency: RA.trim() }
    if (typeof status === 'string' && NOT_REGISTERED.has(status.trim().toLowerCase())) {
      return { kind: 'not_registered' }
    }
  }
  throw new ServiceUnavailableError('doi.org', 'bad_response')
}

export function createDoiClient(opts: DoiClientOptions): DoiClient {
  const { http, cache = new RetrievalCache() } = opts
  const scheduler = opts.scheduler ?? new Scheduler({ maxConcurrent: 3, minIntervalMs: 100 })

  return {
    async getAgency(doi) {
      const key = hashKey('doira', doi.toLowerCase())
      return cache.wrap<RegistrationAgency>(key, async () => {
        const path = doi.split('/').map(encodeURIComponent).join('/')
        const res = await http.getJson(`https://doi.org/doiRA/${path}`, {
          service: 'doi.org',
          scheduler,
        })
        return interpretDoiRa(res.json)
      })
    },
  }
}
