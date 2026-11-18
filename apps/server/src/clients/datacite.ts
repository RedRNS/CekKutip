import type { MatchedRecord } from '@cekkutip/shared'
import { RetrievalCache, hashKey } from '../lib/cache.js'
import { HttpClient, ServiceUnavailableError } from '../lib/http.js'
import { Scheduler } from '../lib/scheduler.js'
import { asText, cleanMarkup, firstString } from '../lib/text.js'
import type { DoiLookup } from './crossref.js'

const BASE = 'https://api.datacite.org'

/**
 * DataCite does not publish a numeric limit on its metadata pages, so we stay well under
 * Crossref's ceiling: two at a time, five per second. A 429 is still honoured by the HTTP client.
 */
const CEILING = { maxConcurrent: 2, minIntervalMs: 200 }

export interface DataciteClient {
  /** Fetch one DOI. 404 resolves to `{ found: false }`. Throws ServiceUnavailableError on outage. */
  getByDoi(doi: string): Promise<DoiLookup>
}

export interface DataciteOptions {
  http: HttpClient
  /** Contact address, sent only inside the User-Agent as DataCite asks. Optional. */
  mailto?: string
  cache?: RetrievalCache
  scheduler?: Scheduler
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

function yearOf(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= 1000 && n <= 3000 ? n : null
}

/**
 * Convert one DataCite DOI document (JSON:API) to our record shape.
 * Returns null when there is no usable title.
 * The publisher ("Zenodo", "arXiv") is a repository, not a venue, so it is not used as one.
 */
export function mapDataciteDoc(doc: unknown): MatchedRecord | null {
  if (!isObject(doc) || !isObject(doc.data) || !isObject(doc.data.attributes)) return null
  const a = doc.data.attributes

  const first = Array.isArray(a.titles) ? a.titles.find(isObject) : undefined
  const title = first ? firstString(first.title) : null
  if (title === null) return null

  const authors: string[] = []
  const authorsFull: string[] = []
  if (Array.isArray(a.creators)) {
    for (const c of a.creators) {
      if (!isObject(c)) continue
      const family = asText(c.familyName)
      const given = asText(c.givenName)
      const name = asText(c.name)
      const surname = family ?? name ?? given
      if (surname === null) continue
      authors.push(cleanMarkup(surname))
      authorsFull.push(cleanMarkup([given, family ?? name].filter(Boolean).join(' ') || surname))
    }
  }

  const container = isObject(a.container) ? a.container : {}
  const firstPage = asText(container.firstPage)
  const lastPage = asText(container.lastPage)
  const pages = firstPage && lastPage ? `${firstPage}-${lastPage}` : firstPage

  const doi = asText(a.doi)
  return {
    source: 'datacite',
    doi,
    url: asText(a.url) ?? (doi ? `https://doi.org/${doi}` : null),
    title,
    authors,
    authorsFull,
    year: yearOf(a.publicationYear),
    venue: firstString(container.title),
    volume: asText(container.volume),
    issue: asText(container.issue),
    pages,
  }
}

export function createDataciteClient(opts: DataciteOptions): DataciteClient {
  const { http, mailto, cache = new RetrievalCache() } = opts
  const scheduler = opts.scheduler ?? new Scheduler(CEILING)
  const headers: Record<string, string> = mailto
    ? { 'user-agent': `CekKutip/0.1 (mailto:${mailto})` }
    : {}

  return {
    async getByDoi(doi) {
      const key = hashKey('datacite', 'doi', doi.toLowerCase())
      return cache.wrap<DoiLookup>(key, async () => {
        const path = doi.split('/').map(encodeURIComponent).join('/')
        const res = await http.getJson(`${BASE}/dois/${path}`, {
          service: 'datacite',
          scheduler,
          headers,
        })
        if (res.status === 404) return { found: false }
        const record = mapDataciteDoc(res.json)
        if (record === null)
          throw new ServiceUnavailableError('datacite', 'bad_response', res.status)
        return { found: true, record }
      })
    },
  }
}
