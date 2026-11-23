import type { MatchedRecord } from '@cekkutip/shared'
import { RetrievalCache, hashKey } from '../lib/cache.js'
import { HttpClient, ServiceUnavailableError } from '../lib/http.js'
import type { ServiceErrorCode } from '../lib/http.js'
import { tokenize } from '../lib/normalize.js'
import { Scheduler } from '../lib/scheduler.js'

const ORIGIN = 'https://garuda.kemdiktisaintek.go.id'

/**
 * Garuda is the national index of Indonesian journals (Kemdiktisaintek). It has no API: `/api`,
 * `/oai`, and `/documents.json` all answer 404. Its search page is read as HTML instead, so this
 * client is deliberately strict about what it accepts. A page that does not look like a Garuda result
 * page is a failure (`bad_response`), never "no results": a changed layout must not turn every
 * reference into a suspect (DECISIONS 140).
 *
 * What Garuda does, found by trying it on 23 Nov 2026:
 * - `GET /documents?q=...&select=title` searches titles. Every word must be present, in any order and
 *   any case, so one misspelt word gives zero results. A page holds at most 10 results.
 * - Each result gives a title, the authors, one journal line ("Jurnal X Vol. 11 No. 3 (2025): ..."),
 *   and the publisher. There is no DOI on the list page.
 * - The page always says "Found N documents", also when N is 0.
 */
export interface GarudaClient {
  /** Search by title. Up to 10 hits on one page. Throws ServiceUnavailableError when Garuda cannot answer. */
  searchTitle(title: string): Promise<MatchedRecord[]>
}

export interface GarudaOptions {
  http: HttpClient
  cache?: RetrievalCache
  scheduler?: Scheduler
  now?: () => number
  /** After a failure Garuda is not asked again for this long. Default 60 seconds. */
  pauseMs?: number
}

const bad = () => new ServiceUnavailableError('garuda', 'bad_response')

/** Words that tell little about which work a title is. Left out when a long title is shortened. */
const JOINING_WORDS = new Set([
  'dan',
  'yang',
  'pada',
  'untuk',
  'dengan',
  'dari',
  'dalam',
  'antara',
  'atau',
  'oleh',
  'serta',
  'sebagai',
  'secara',
  'bagi',
  'the',
  'and',
  'for',
  'with',
  'from',
])

/** How many words the second, shorter search uses. */
const SHORT_QUERY_WORDS = 6
/** A title longer than this is cut before it goes into a URL. */
const MAX_QUERY_CHARS = 300

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * A Garuda author. Names come as "Family, Given" or in plain order. For Indonesian names the split is
 * often arbitrary ("Fitria Yulia, Aviv"), so the full name is kept for matching as well.
 */
export function parseGarudaAuthor(name: string): { family: string; full: string } | null {
  const n = collapse(name)
  if (n === '') return null
  if (n.includes(',')) {
    const [family = '', ...rest] = n.split(',')
    const given = collapse(rest.join(' '))
    const fam = collapse(family)
    if (fam === '') return null
    return { family: fam, full: given === '' ? fam : `${given} ${fam}` }
  }
  const words = n.split(' ')
  return { family: words[words.length - 1] as string, full: n }
}

export interface JournalLine {
  venue: string | null
  volume: string | null
  issue: string | null
  year: number | null
}

const VOLUME = /\bVol(?:ume)?\.?\s*(\d[\w-]*)/i
const ISSUE = /\bNo(?:mor)?\.?\s*(\d[\w-]*)/i
const PAREN_YEAR = /\((\d{4})\)/
const BARE_YEAR = /\b((?:19|20)\d{2})\b/

/**
 * Read a journal line such as "Jurnal Informatika Polinema Vol. 11 No. 3 (2025): Vol. 11 No. 3 (2025)".
 * Anything after " || " is a repeat of the journal name. The year is usually in brackets, but not
 * always ("Vol 5 No 4: Desember 2024").
 */
export function parseJournalLine(line: string): JournalLine {
  const text = collapse(line.split('||')[0] ?? '')
  if (text === '') return { venue: null, volume: null, issue: null, year: null }

  const vol = VOLUME.exec(text)
  const iss = ISSUE.exec(text)
  const marker = Math.min(vol?.index ?? Infinity, iss?.index ?? Infinity)
  const hasMarker = Number.isFinite(marker)

  const venueText = hasMarker ? text.slice(0, marker) : text.replace(PAREN_YEAR, '')
  const venue = venueText.replace(/[\s,:;|-]+$/, '').trim()
  const tail = hasMarker ? text.slice(marker) : text
  const year = PAREN_YEAR.exec(tail)?.[1] ?? (hasMarker ? BARE_YEAR.exec(tail)?.[1] : undefined)

  return {
    venue: venue === '' ? null : venue,
    volume: vol?.[1] ?? null,
    issue: iss?.[1] ?? null,
    year: year === undefined ? null : Number(year),
  }
}

/** Does `needle` occur in `hay` as consecutive words? */
function containsRun(hay: string[], needle: string[]): boolean {
  if (needle.length === 0) return false
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((w, k) => hay[i + k] === w)) return true
  }
  return false
}

/**
 * Garuda sometimes puts a keyword in front of the title: "Analisis Sentimen Analisis Sentimen E-Wallet
 * Pada ..." or "sistem pakar APLIKASI SISTEM PAKAR DIAGNOSA ...". Such a title scores about 0.81 against
 * the real one, below the threshold for "the same work", so the work would be called not found while it
 * sits in Garuda.
 *
 * When the first two or three words come back later in the title, and are not followed by punctuation
 * (a keyword list such as "Analisis Sentimen, Text Mining ..." is left alone), they are taken as a
 * keyword and dropped. The title as written is kept as the second variant, so a real title that repeats
 * its own opening words still matches.
 */
export function garudaTitleVariants(raw: string): string[] {
  const title = collapse(raw)
  const words = title.split(' ')
  for (const k of [3, 2]) {
    const lead = words.slice(0, k)
    const rest = words.slice(k)
    if (rest.length < 3) continue
    if (lead.some((w) => /[,:;.!?]$/.test(w))) continue
    if (containsRun(tokenize(rest.join(' ')), tokenize(lead.join(' ')))) {
      return [rest.join(' '), title]
    }
  }
  return [title]
}

const decodeHref = (href: string | undefined): string => {
  try {
    const url = new URL(href ?? '', ORIGIN)
    // Only a link on Garuda itself is shown to the person. Anything else falls back to the search page.
    return url.origin === ORIGIN ? url.toString() : `${ORIGIN}/documents`
  } catch {
    return `${ORIGIN}/documents`
  }
}

export interface GarudaPage {
  /** The number in "Found N documents". The page holds at most 10 of them. */
  total: number
  records: MatchedRecord[]
}

/**
 * Read a Garuda result page. Throws `bad_response` when the page is not one: no "Found N documents"
 * marker, a count with nothing readable under it, or a result without a title. Zero results is a normal
 * answer and gives an empty list.
 */
export function parseGarudaPage(html: string): GarudaPage {
  const marker = /Found\s+([\d.,]+)\s+documents/.exec(html)
  if (marker === null) throw bad()
  const total = Number((marker[1] as string).replace(/\D/g, ''))
  if (!Number.isFinite(total)) throw bad()

  const items = html.split('<div class="article-item">').slice(1)
  if (total > 0 && items.length === 0) throw bad()

  const records: MatchedRecord[] = []
  for (const item of items) {
    const head = /(<a\b[^>]*class="[^"]*\btitle-article\b[^"]*"[^>]*>)\s*<xmp>([\s\S]*?)<\/xmp>/.exec(
      item,
    )
    if (head === null) throw bad()
    const url = decodeHref(/href="([^"]*)"/.exec(head[1] as string)?.[1])
    const titles = garudaTitleVariants(head[2] as string)

    const authors = [...item.matchAll(/class="author-article"[^>]*><xmp>([\s\S]*?)<\/xmp>/g)]
      .map((m) => parseGarudaAuthor(m[1] as string))
      .filter((a): a is { family: string; full: string } => a !== null)
    const line = parseJournalLine(
      /<xmp class="subtitle-article">([\s\S]*?)<\/xmp>/.exec(item)?.[1] ?? '',
    )

    for (const title of titles) {
      if (title === '') continue
      records.push({
        source: 'garuda',
        doi: null,
        url,
        title,
        authors: authors.map((a) => a.family),
        authorsFull: authors.map((a) => a.full),
        year: line.year,
        venue: line.venue,
        volume: line.volume,
        issue: line.issue,
        pages: null,
      })
    }
  }
  return { total, records }
}

/** The first words of a long title, without joining words, for a second search. Null when no shorter. */
function shortQuery(title: string): string | null {
  const words = tokenize(title).filter((w) => w.length >= 3 && !JOINING_WORDS.has(w))
  return words.length > SHORT_QUERY_WORDS ? words.slice(0, SHORT_QUERY_WORDS).join(' ') : null
}

export function createGarudaClient(opts: GarudaOptions): GarudaClient {
  const { http, cache = new RetrievalCache(), now = Date.now, pauseMs = 60_000 } = opts
  // One request at a time and at most about 1.6 per second: this is a public service with no stated limit.
  const scheduler = opts.scheduler ?? new Scheduler({ maxConcurrent: 1, minIntervalMs: 600 })

  // After a failure Garuda is left alone for a while. A service that is down or has blocked us would
  // otherwise make every reference wait out its own timeout. The pause is in memory and holds no text.
  let pausedUntil = 0
  let pausedCode: ServiceErrorCode = 'network'

  async function query(q: string): Promise<MatchedRecord[]> {
    const params = new URLSearchParams({ q: q.slice(0, MAX_QUERY_CHARS), select: 'title' })
    const page = await scheduler.run(async () => {
      // Checked when the request's turn comes, so requests queued behind a failure fail at once too.
      if (now() < pausedUntil) throw new ServiceUnavailableError('garuda', pausedCode)
      return http.getText(`${ORIGIN}/documents?${params.toString()}`, {
        service: 'garuda',
        headers: { accept: 'text/html' },
      })
    })
    if (page.text === null) throw bad()
    return parseGarudaPage(page.text).records
  }

  return {
    async searchTitle(title) {
      const key = hashKey('garuda', 'title', title)
      return cache.wrap<MatchedRecord[]>(key, async () => {
        try {
          const records = await query(collapse(title))
          if (records.length > 0) return records
          // Every word has to be in the title, so a single misspelling finds nothing. Try the opening words.
          const short = shortQuery(title)
          return short === null ? records : await query(short)
        } catch (err) {
          // Only a real attempt starts a pause. A request that was turned away during one must not
          // extend it, or the pause would never end while references keep arriving.
          if (err instanceof ServiceUnavailableError && now() >= pausedUntil) {
            pausedUntil = now() + pauseMs
            pausedCode = err.code
          }
          throw err
        }
      })
    },
  }
}
