import type { MatchedRecord } from '@cekkutip/shared'
import { RetrievalCache, hashKey } from '../lib/cache.js'
import { HttpClient, ServiceUnavailableError } from '../lib/http.js'
import { Scheduler } from '../lib/scheduler.js'
import { asText, cleanMarkup, firstString } from '../lib/text.js'

const BASE = 'https://api.openalex.org'
const SELECT = 'id,doi,title,display_name,publication_year,authorships,primary_location,biblio,type'

/**
 * OpenAlex bills each search at about $0.001. Without a key the free budget is $0.10 per day,
 * shared by everyone on the same IP address. A free key gives $1 per day. This client never
 * goes beyond the free budget: when OpenAlex answers 429 with a long Retry-After the lookup
 * fails fast with ServiceUnavailableError, which the pipeline reports as `check_failed`.
 */
export interface OpenAlexClient {
  /** Search works by title. Up to 5 candidates, best first. Throws ServiceUnavailableError on outage. */
  searchTitle(title: string): Promise<MatchedRecord[]>
}

export interface OpenAlexOptions {
  http: HttpClient
  /** Free API key (OPENALEX_API_KEY). Sent as a bearer token, never in the URL. */
  apiKey?: string
  cache?: RetrievalCache
  scheduler?: Scheduler
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

const stripDoiUrl = (doi: string | null) =>
  doi ? doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '') : null

/** OpenAlex gives only display names. The family name is taken as the last word. */
const surnameOf = (displayName: string) => displayName.trim().split(/\s+/).pop() ?? displayName

export function mapOpenAlexWork(work: unknown): MatchedRecord | null {
  if (!isObject(work)) return null
  const title = firstString(work.title) ?? firstString(work.display_name)
  if (title === null) return null

  const authorsFull: string[] = []
  if (Array.isArray(work.authorships)) {
    for (const a of work.authorships) {
      const author = isObject(a) && isObject(a.author) ? a.author : null
      const name = author ? asText(author.display_name) : null
      if (name !== null) authorsFull.push(cleanMarkup(name))
    }
  }

  const loc = isObject(work.primary_location) ? work.primary_location : null
  const source = loc && isObject(loc.source) ? loc.source : null
  const biblio = isObject(work.biblio) ? work.biblio : null
  const first = biblio ? asText(biblio.first_page) : null
  const last = biblio ? asText(biblio.last_page) : null
  const doi = stripDoiUrl(asText(work.doi))

  return {
    source: 'openalex',
    doi,
    url: doi
      ? `https://doi.org/${doi}`
      : ((loc ? asText(loc.landing_page_url) : null) ?? asText(work.id)),
    title,
    authors: authorsFull.map(surnameOf),
    authorsFull,
    year: typeof work.publication_year === 'number' ? work.publication_year : null,
    venue: source ? firstString(source.display_name) : null,
    volume: biblio ? asText(biblio.volume) : null,
    issue: biblio ? asText(biblio.issue) : null,
    pages: first && last && first !== last ? `${first}-${last}` : first,
  }
}

export function createOpenAlexClient(opts: OpenAlexOptions): OpenAlexClient {
  const { http, apiKey, cache = new RetrievalCache() } = opts
  // Documented ceilings: 10 requests per second without a key, 30 with one.
  const scheduler =
    opts.scheduler ?? new Scheduler({ maxConcurrent: 3, minIntervalMs: apiKey ? 40 : 110 })
  const headers: Record<string, string> = apiKey ? { authorization: `Bearer ${apiKey}` } : {}

  return {
    async searchTitle(title) {
      const key = hashKey('openalex', 'title', title)
      return cache.wrap<MatchedRecord[]>(key, async () => {
        const params = new URLSearchParams({ 'search.title': title, per_page: '5', select: SELECT })
        const res = await http.getJson(`${BASE}/works?${params.toString()}`, {
          service: 'openalex',
          scheduler,
          headers,
        })
        const results = isObject(res.json) ? res.json.results : null
        if (!Array.isArray(results))
          throw new ServiceUnavailableError('openalex', 'bad_response', res.status)
        return results.map(mapOpenAlexWork).filter((r): r is MatchedRecord => r !== null)
      })
    },
  }
}
