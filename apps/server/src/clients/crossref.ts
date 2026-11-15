import type { MatchedRecord } from '@cekkutip/shared'
import { RetrievalCache, hashKey } from '../lib/cache.js'
import { HttpClient, ServiceUnavailableError } from '../lib/http.js'
import { normalizeText } from '../lib/normalize.js'
import { Scheduler } from '../lib/scheduler.js'
import { asText, cleanMarkup, firstString } from '../lib/text.js'

const BASE = 'https://api.crossref.org'
const SELECT =
  'DOI,title,subtitle,author,issued,container-title,volume,issue,page,article-number,type,URL,score'

/** Crossref's published polite-pool ceiling: 10 requests per second, 3 at a time. */
const POLITE = { maxConcurrent: 3, minIntervalMs: 100 }
/** Public pool: 5 requests per second, 1 at a time. */
const PUBLIC = { maxConcurrent: 1, minIntervalMs: 200 }

export type DoiLookup = { found: true; record: MatchedRecord } | { found: false }

export interface SearchQuery {
  title: string
  firstAuthor?: string | null
  year?: number | null
}

export interface CrossrefClient {
  /** Fetch one work by DOI. 404 resolves to `{ found: false }`. Throws ServiceUnavailableError on outage. */
  getByDoi(doi: string): Promise<DoiLookup>
  /** Bibliographic search (title, first author, year). Up to 5 candidates, best first. */
  search(query: SearchQuery): Promise<MatchedRecord[]>
}

export interface CrossrefOptions {
  http: HttpClient
  /** Contact address for the polite pool. Sent as `mailto` and in the User-Agent. Optional. */
  mailto?: string
  cache?: RetrievalCache
  scheduler?: Scheduler
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

function yearOf(item: Json): number | null {
  const issued = item.issued
  if (!isObject(issued) || !Array.isArray(issued['date-parts'])) return null
  const first = (issued['date-parts'] as unknown[])[0]
  const y = Array.isArray(first) ? first[0] : null
  return typeof y === 'number' && Number.isInteger(y) ? y : null
}

/** Convert one Crossref work to our record shape. Returns null when there is no usable title. */
export function mapCrossrefItem(item: unknown): MatchedRecord | null {
  if (!isObject(item)) return null
  let title = firstString(item.title)
  if (title === null) return null
  const subtitle = firstString(item.subtitle)
  if (subtitle !== null && !normalizeText(title).includes(normalizeText(subtitle))) {
    title = `${title}: ${subtitle}`
  }

  const authors: string[] = []
  const authorsFull: string[] = []
  if (Array.isArray(item.author)) {
    for (const a of item.author) {
      if (!isObject(a)) continue
      const family = asText(a.family)
      const given = asText(a.given)
      const name = asText(a.name) // organisations
      const surname = family ?? name ?? given
      if (surname === null) continue
      authors.push(cleanMarkup(surname))
      authorsFull.push(cleanMarkup([given, family ?? name].filter(Boolean).join(' ') || surname))
    }
  }

  const doi = asText(item.DOI)
  return {
    source: 'crossref',
    doi,
    url: asText(item.URL) ?? (doi ? `https://doi.org/${doi}` : null),
    title,
    authors,
    authorsFull,
    year: yearOf(item),
    venue: firstString(item['container-title']),
    volume: asText(item.volume),
    issue: asText(item.issue),
    pages: asText(item.page) ?? asText(item['article-number']),
  }
}

function parseInterval(value: string | null): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m)?$/.exec((value ?? '').trim())
  if (!m) return null
  const n = Number(m[1])
  return m[2] === 'ms' ? n : m[2] === 'm' ? n * 60_000 : n * 1000
}

export function createCrossrefClient(opts: CrossrefOptions): CrossrefClient {
  const { http, mailto, cache = new RetrievalCache() } = opts
  const ceiling = mailto ? POLITE : PUBLIC
  const scheduler = opts.scheduler ?? new Scheduler(ceiling)
  const headers: Record<string, string> = mailto
    ? { 'user-agent': `CekKutip/0.1 (mailto:${mailto})` }
    : {}

  /** Follow the limits Crossref advertises, but never go above the pool ceiling. */
  const adapt = (h: Headers) => {
    const limit = Number(h.get('x-rate-limit-limit'))
    const interval = parseInterval(h.get('x-rate-limit-interval'))
    const concurrency = Number(h.get('x-concurrency-limit'))
    const update: { maxConcurrent?: number; minIntervalMs?: number } = {}
    if (limit > 0 && interval !== null) {
      update.minIntervalMs = Math.max(ceiling.minIntervalMs, Math.ceil(interval / limit))
    }
    if (concurrency > 0) update.maxConcurrent = Math.min(concurrency, ceiling.maxConcurrent)
    if (update.maxConcurrent !== undefined || update.minIntervalMs !== undefined)
      scheduler.configure(update)
  }

  const call = (url: string) =>
    http.getJson(url, { service: 'crossref', scheduler, headers, onResponse: adapt })

  const withMailto = (params: URLSearchParams) => {
    if (mailto) params.set('mailto', mailto)
    return params
  }

  return {
    async getByDoi(doi) {
      const key = hashKey('crossref', 'doi', doi.toLowerCase())
      return cache.wrap<DoiLookup>(key, async () => {
        const path = doi.split('/').map(encodeURIComponent).join('/')
        const qs = withMailto(new URLSearchParams()).toString()
        const res = await call(`${BASE}/works/${path}${qs ? `?${qs}` : ''}`)
        if (res.status === 404) return { found: false }
        const message = isObject(res.json) ? res.json.message : null
        const record = mapCrossrefItem(message)
        if (record === null)
          throw new ServiceUnavailableError('crossref', 'bad_response', res.status)
        return { found: true, record }
      })
    },

    async search(query) {
      const key = hashKey('crossref', 'search', query.title, query.firstAuthor, query.year)
      return cache.wrap<MatchedRecord[]>(key, async () => {
        const bibliographic = [query.title, query.firstAuthor, query.year].filter(Boolean).join(' ')
        const params = withMailto(
          new URLSearchParams({ 'query.bibliographic': bibliographic, rows: '5', select: SELECT }),
        )
        const res = await call(`${BASE}/works?${params.toString()}`)
        const items =
          isObject(res.json) && isObject(res.json.message) ? res.json.message.items : null
        if (!Array.isArray(items))
          throw new ServiceUnavailableError('crossref', 'bad_response', res.status)
        return items.map(mapCrossrefItem).filter((r): r is MatchedRecord => r !== null)
      })
    },
  }
}
