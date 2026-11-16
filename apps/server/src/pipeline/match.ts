import type { MatchedRecord, ParsedReference } from '@cekkutip/shared'
import { normalizeText, tokenize } from '../lib/normalize.js'
import { similarity, titleSimilarity } from '../lib/similarity.js'
import type { MatchFlags, Scored } from './types.js'

/** Generic words that say little about which journal this is. */
const VENUE_STOP = new Set([
  'the',
  'of',
  'and',
  'in',
  'for',
  'on',
  'a',
  'an',
  'journal',
  'jurnal',
  'international',
  'proceedings',
  'proceeding',
  'conference',
  'prosiding',
])
/** Words that never start an acronym ("Proceedings of the National Academy of Sciences" is PNAS). */
const ACRONYM_SKIP = new Set([
  'the',
  'of',
  'and',
  'in',
  'for',
  'on',
  'a',
  'an',
  'dan',
  'untuk',
  'di',
  'dalam',
])

/** Leading "&", "and", "dan" left over from list splitting. */
const LIST_WORD = /^(?:&|and|dan)\s+/i

/** Tokens of a cited author's family name: initials dropped, "Surname, I." and "I. Surname" both handled. */
export function citedSurnameTokens(name: string): string[] {
  let n = name.replace(LIST_WORD, '').trim()
  if (n.includes(',')) n = n.split(',')[0] as string
  return tokenize(n).filter((t) => t.length > 1)
}

interface RecordAuthor {
  family: string
  full: Set<string>
}

function recordAuthors(record: MatchedRecord): RecordAuthor[] {
  return record.authors.map((family, i) => ({
    family: normalizeText(family),
    full: new Set(tokenize(record.authorsFull?.[i] ?? family)),
  }))
}

/** A cited family name matches a record author when it equals the family name or all its words appear in the full name. */
function matchesAuthor(cited: string[], author: RecordAuthor): boolean {
  if (cited.length === 0) return false
  if (cited.join(' ') === author.family) return true
  return cited.every((t) => author.full.has(t))
}

export interface AuthorScore {
  /** Share of cited family names found among the record's authors. */
  score: number
  /** How many family names could be compared at all. */
  compared: number
}

/**
 * Brief section 6.4: share of cited family names found in the record's author list.
 * With "et al." only the written authors are compared, and the first author must match.
 */
export function authorScore(parsed: ParsedReference, record: MatchedRecord): AuthorScore {
  const cited = parsed.authors.map(citedSurnameTokens).filter((t) => t.length > 0)
  if (cited.length === 0) return { score: 0, compared: 0 }
  const authors = recordAuthors(record)
  const found = cited.filter((c) => authors.some((a) => matchesAuthor(c, a)))
  const share = found.length / cited.length
  if (parsed.hasEtAl) {
    const first = authors[0]
    const firstMatches = first !== undefined && matchesAuthor(cited[0] as string[], first)
    return { score: firstMatches ? share : 0, compared: cited.length }
  }
  return { score: share, compared: cited.length }
}

function significant(tokens: string[]): string[] {
  const kept = tokens.filter((t) => !VENUE_STOP.has(t))
  return kept.length > 0 ? kept : tokens
}

/** "J. Pers. Soc. Psychol." against "Journal of Personality and Social Psychology": every cited word starts a word of the record, in order. */
function isAbbreviationOf(cited: string[], found: string[]): boolean {
  let from = 0
  for (const c of cited) {
    const at = found.findIndex((f, i) => i >= from && f.startsWith(c))
    if (at < 0) return false
    from = at + 1
  }
  return true
}

/**
 * Venue similarity, tolerant of abbreviations and generic words such as "Journal of" (brief 6.4).
 * Deliberately lenient: when unsure it scores high, so a venue is only called different when it clearly is.
 */
export function venueSimilarity(cited: string, found: string): number {
  const cTokens = tokenize(cited)
  const fTokens = tokenize(found)
  if (cTokens.length === 0 || fTokens.length === 0) return 0
  const c = significant(cTokens)
  const f = significant(fTokens)

  let best = similarity(c.join(' '), f.join(' '))

  const [small, large] = c.length <= f.length ? [c, f] : [f, c]
  if (small.every((t) => large.includes(t))) {
    best = Math.max(best, 0.5 + 0.5 * (small.length / large.length))
  }
  // Abbreviations are tried twice: without generic words, and with them kept, because "J." stands for "Journal".
  const loose = (tokens: string[]) => tokens.filter((t) => !ACRONYM_SKIP.has(t))
  if (isAbbreviationOf(c, f) || isAbbreviationOf(loose(cTokens), loose(fTokens))) {
    best = Math.max(best, 0.9)
  }

  if (cTokens.length === 1 && cTokens[0] && cTokens[0].length >= 2 && cTokens[0].length <= 8) {
    const initials = fTokens
      .filter((t) => !ACRONYM_SKIP.has(t))
      .map((t) => t[0])
      .join('')
    if (initials === cTokens[0]) best = Math.max(best, 0.9)
  }
  return best
}

export interface MatchOptions {
  checkAuthors: boolean
}

/** Score one candidate against the parsed reference. */
export function scoreCandidate(
  parsed: ParsedReference,
  record: MatchedRecord,
  opts: MatchOptions,
): Scored {
  const titleCited = parsed.title !== null && normalizeText(parsed.title) !== ''
  const title = titleCited ? titleSimilarity(parsed.title as string, record.title) : 0

  const auth = opts.checkAuthors ? authorScore(parsed, record) : { score: 0, compared: 0 }
  const authorsCited = auth.compared > 0

  const yearCited = parsed.year !== null
  const yearDiff =
    parsed.year !== null && record.year !== null ? Math.abs(parsed.year - record.year) : null

  const venueCompared =
    parsed.venue !== null && record.venue !== null && tokenize(parsed.venue).length > 0
  const venue = venueCompared ? venueSimilarity(parsed.venue as string, record.venue as string) : 0

  const flags: MatchFlags = { titleCited, authorsCited, yearCited, venueCompared }
  return {
    record,
    scores: { title, authors: authorsCited ? auth.score : 0, yearDiff, venue },
    flags,
  }
}

/**
 * Best candidate by title score, then author score (brief 6.4). Remaining ties prefer the smaller year
 * difference, then the better venue, then the order the service returned.
 */
export function pickBest(
  parsed: ParsedReference,
  candidates: MatchedRecord[],
  opts: MatchOptions,
  /** Candidates for which this returns true are preferred over the rest, whatever their scores. */
  prefer: (s: Scored) => boolean = () => true,
): Scored | null {
  const scored = candidates.map((c) => scoreCandidate(parsed, c, opts))
  if (scored.length === 0) return null
  const EPS = 1e-9
  const yd = (s: Scored) => s.scores.yearDiff ?? Number.POSITIVE_INFINITY
  return scored.reduce((best, cur) => {
    if (prefer(cur) !== prefer(best)) return prefer(cur) ? cur : best
    if (Math.abs(cur.scores.title - best.scores.title) > EPS) {
      return cur.scores.title > best.scores.title ? cur : best
    }
    if (Math.abs(cur.scores.authors - best.scores.authors) > EPS) {
      return cur.scores.authors > best.scores.authors ? cur : best
    }
    if (yd(cur) !== yd(best)) return yd(cur) < yd(best) ? cur : best
    if (Math.abs(cur.scores.venue - best.scores.venue) > EPS) {
      return cur.scores.venue > best.scores.venue ? cur : best
    }
    return best
  })
}
