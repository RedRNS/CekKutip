import { MIN_YEAR, extractDoi } from '@cekkutip/shared'
import type { ParsedReference, ReferenceType } from '@cekkutip/shared'

/**
 * Parser without a language model. Used for "do not send my text to an AI service", for ablation A3,
 * and as the fallback when the model's output cannot be validated.
 *
 * It handles the common shapes (APA, Harvard, a good part of Indonesian styles, IEEE with a quoted
 * title). It prefers returning null over guessing: a missing field is "not cited", never "wrong".
 */

const YEAR_PART = String.raw`(?:1[4-9]|20)\d{2}`
const PAREN_YEAR = new RegExp(String.raw`\(\s*(${YEAR_PART})[a-z]?\s*[,)]`)
const LOOSE_YEAR = new RegExp(String.raw`(?:^|[\s,.(])(${YEAR_PART})[a-z]?(?=[\s,.);]|$)`)
const ET_AL = /\b(?:et\.?\s+al\.?|dkk\.?|dll\.?)/i
const NAME = String.raw`\p{Lu}[\p{L}'\-]+`
const SURNAME_FIRST = new RegExp(
  String.raw`^(?:\p{Ll}{1,4}\s+){0,2}${NAME}(?:\s+${NAME}){0,2},\s*\p{Lu}\.`,
  'u',
)
/** Words after which a full stop does not end a sentence. */
const ABBREVIATIONS = new Set([
  'vs',
  'no',
  'vol',
  'dr',
  'prof',
  'ed',
  'eds',
  'et',
  'al',
  'pp',
  'p',
  'cf',
  'e.g',
  'i.e',
  'st',
  'jr',
  'sr',
  'mr',
  'mrs',
  'ms',
])

export interface RegexParseOptions {
  /** Used to cap the accepted year at "this year plus one". */
  now?: Date
}

function cleanTitle(s: string): string {
  return s
    .replace(/[*_]+/g, '')
    .replace(/^[\s"'‘’“”.,:;-]+/u, '')
    .replace(/[\s"'‘’“”.,:;]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "Are LLMs good at structured outputs? A benchmark for ...": a plain sentence after "?" or "!" is the
 * rest of the title. A journal after "?" has a volume or a comma after it, or is one or two words.
 * Same rule as the formatting page (refformat/parse.ts).
 */
function isSubtitle(afterMark: string): boolean {
  const next = afterMark.trimStart()
  if (!/^[\p{Lu}\p{N}"'([]/u.test(next)) return false
  const stop = next.indexOf('. ')
  const sentence = stop < 0 ? next.replace(/\.$/, '') : next.slice(0, stop)
  return sentence !== '' && !/[\d,]/.test(sentence) && sentence.split(' ').length >= 3
}

/** End index of the first sentence of `s`: the first full stop that is not an initial or a known abbreviation. */
function sentenceEnd(s: string): number {
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const next = s[i + 1]
    if ((c === '?' || c === '!') && (next === undefined || /\s/.test(next))) {
      if (isSubtitle(s.slice(i + 1))) continue
      return i + 1
    }
    if (c !== '.') continue
    if (next !== undefined && !/\s/.test(next)) continue // 3.5, U.S, file.txt
    const prev = /(\S+)$/.exec(s.slice(0, i))?.[1] ?? ''
    if (/^\p{Lu}$/u.test(prev)) continue // an initial such as "J."
    if (ABBREVIATIONS.has(prev.toLowerCase())) continue
    if (/^(?:\p{Lu}\.)+\p{Lu}$/u.test(prev)) continue // "U.S" in "a study of U.S. policy"
    return i
  }
  return s.length
}

export function parseAuthors(input: string): { authors: string[]; hasEtAl: boolean } {
  let s = input.trim()
  let hasEtAl = false
  if (ET_AL.test(s)) {
    hasEtAl = true
    s = s.replace(ET_AL, '')
  }
  s = s.replace(/[\s,;&]+$/, '').replace(/^[\s,;&]+/, '')
  if (s === '') return { authors: [], hasEtAl }

  const stripLead = (x: string) => x.replace(/^(?:&|and|dan)\s+/i, '').trim()
  let segments: string[]

  if (SURNAME_FIRST.test(s)) {
    // "Walters, W. H., & Wilder, E. I." : a comma that follows an initial's full stop ends one author.
    segments = s.split(/(?<=\.)\s*,\s*|\s*;\s*|\s+&\s+|\s+(?:and|dan)\s+/i).map(stripLead)
  } else {
    segments = s.split(/\s*[;&]\s*|\s*,\s*(?:(?:and|dan)\s+)?|\s+(?:and|dan)\s+/i).map(stripLead)
  }

  const authors: string[] = []
  for (const seg of segments) {
    if (seg === '') continue
    let surname: string
    if (seg.includes(',')) {
      surname = (seg.split(',')[0] as string).trim()
    } else {
      // "I. Surname" and "Surname I." both reduce to the surname; single and corporate names are kept whole.
      surname = seg
        .replace(/^(?:\p{Lu}\.\s*|\p{Lu}\.-\p{Lu}\.\s*)+/u, '')
        .replace(/\s+(?:\p{Lu}\.\s*)+$/u, '')
        .replace(/\.$/, '')
        .trim()
    }
    if (surname === '' || /^\p{Lu}\.?$/u.test(surname)) continue
    if (surname.split(/\s+/).length > 8) continue // a sentence, not a name
    authors.push(surname)
    if (authors.length >= 30) break
  }
  return { authors, hasEtAl }
}

function guessType(
  raw: string,
  f: { volume: string | null; issue: string | null; hasDoi: boolean; hasUrl: boolean },
): ReferenceType {
  if (/\b(?:skripsi|tesis|disertasi|thesis|dissertation|tugas\s+akhir)\b/i.test(raw))
    return 'thesis'
  if (
    /\b(?:proceedings?|proc|prosiding|conference|konferensi|symposium|simposium|seminar\s+nasional|workshop)\b/i.test(
      raw,
    )
  ) {
    return 'conference_paper'
  }
  if (
    /\b(?:in|dalam)\s+[^()]{2,120}?\(\s*(?:eds?|ed)\.?\s*\)/i.test(raw) ||
    /\(\s*(?:eds?)\.?\s*\)\s*,/i.test(raw)
  ) {
    return 'book_chapter'
  }
  if (
    /\b(?:laporan|report|white\s+paper|working\s+paper|technical\s+report|policy\s+brief)\b/i.test(
      raw,
    )
  ) {
    return 'report'
  }
  if (f.volume !== null || f.issue !== null || /\b(?:journal|jurnal)\b/i.test(raw))
    return 'journal_article'
  if (
    /\b(?:penerbit|publisher|press|edisi|edition|cetakan|erlangga|gramedia|andi|rajagrafindo)\b/i.test(
      raw,
    )
  ) {
    return 'book'
  }
  if (f.hasDoi) return 'journal_article'
  if (f.hasUrl || /\b(?:diakses|retrieved|accessed|available\s+at)\b/i.test(raw)) return 'web_page'
  return 'other'
}

export function parseWithRegex(raw: string, opts: RegexParseOptions = {}): ParsedReference {
  const maxYear = (opts.now ?? new Date()).getFullYear() + 1
  const text = raw.replace(/\s+/g, ' ').trim()

  const doi = extractDoi(text)
  const hasUrl = /\b(?:https?:\/\/|www\.)\S+/i.test(text)
  const body = text
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\bdoi:\s*\S+/gi, ' ')
    .replace(/10\.\d{4,9}\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Year: "(2023)" first, then a bare year anywhere.
  let year: number | null = null
  let yearStart = -1
  let yearEnd = -1
  const paren = PAREN_YEAR.exec(body)
  if (paren) {
    year = Number(paren[1])
    yearStart = paren.index
    yearEnd = paren.index + paren[0].length
  } else {
    const loose = LOOSE_YEAR.exec(body)
    if (loose) {
      year = Number(loose[1])
      yearStart = loose.index
      yearEnd = loose.index + loose[0].length
    }
  }
  if (year !== null && (year < MIN_YEAR || year > maxYear)) year = null

  // Title and authors.
  let authorText = ''
  let title: string | null = null
  let tail = ''
  const quoted = /[“"]([^”"]{8,}?)[”"]/u.exec(body)

  if (paren) {
    authorText = body.slice(0, yearStart)
    let after = body.slice(yearEnd).replace(/^[\s.,:)\]-]+/, '')
    after = after.replace(/^[*_]+/, '')
    const end = sentenceEnd(after)
    let rawTitle = after.slice(0, end)
    tail = after.slice(end).replace(/^[.\s,]+/, '')
    const bracket = rawTitle.indexOf('[')
    if (bracket > 0) rawTitle = rawTitle.slice(0, bracket)
    title = cleanTitle(rawTitle) || null
  } else if (quoted) {
    authorText = body.slice(0, quoted.index)
    title = cleanTitle(quoted[1] as string) || null
    tail = body.slice(quoted.index + quoted[0].length).replace(/^[.\s,]+/, '')
  }

  const { authors, hasEtAl } = authorText
    ? parseAuthors(authorText)
    : { authors: [], hasEtAl: false }

  // Volume, issue, pages, venue from the part after the title.
  let volume: string | null
  let issue: string | null
  let pages: string | null = null
  const volIssue = /\b(\d{1,4})\s*\(\s*(\d{1,4}(?:\s*[-–]\s*\d{1,4})?)\s*\)/u.exec(tail)
  if (volIssue) {
    volume = volIssue[1] as string
    issue = (volIssue[2] as string).replace(/\s+/g, '')
  } else {
    volume = /\bvol(?:ume)?\.?\s*(\d{1,4})\b/i.exec(tail)?.[1] ?? null
    issue = /\b(?:no|issue|nomor)\.?\s*(\d{1,4})\b/i.exec(tail)?.[1] ?? null
  }
  const range = /(?:\bpp?\.\s*)?\b(\d{1,5}\s*[-–—]\s*\d{1,5})\b/u.exec(tail)
  if (range) pages = (range[1] as string).replace(/\s+/g, '')

  const parts = tail.split(/,\s*/)
  const bareVolume = (parts[1] ?? '').trim().replace(/\.$/, '') // "Journal, 30." ends the reference
  if (volume === null && /^\d{1,4}$/.test(bareVolume)) volume = bareVolume
  if (
    pages === null &&
    volume !== null &&
    parts[2] &&
    /^[A-Za-z]?\d{3,}\.?$/.test(parts[2].trim())
  ) {
    pages = parts[2].trim().replace(/\.$/, '')
  }

  const type = guessType(text, { volume, issue, hasDoi: doi !== null, hasUrl })

  let venue: string | null = null
  if (type === 'journal_article' || type === 'conference_paper') {
    const first = (parts[0] ?? '').replace(/[*_]+/g, '').replace(/\.$/, '').trim()
    const looksLikeVenue =
      /\p{L}{2}/u.test(first) &&
      !/^(?:vol|no|pp?)\b/i.test(first) &&
      first.split(/\s+/).length <= 14
    if (looksLikeVenue) venue = first
  } else if (type === 'book_chapter') {
    venue =
      /\b(?:in|dalam)\s+[^()]{2,120}?\(\s*eds?\.?\s*\)\s*,\s*([^.(]{3,120}?)\s*(?:\(|\.|$)/i
        .exec(text)?.[1]
        ?.trim() ?? null
  }

  return {
    raw,
    authors,
    hasEtAl,
    year,
    title,
    venue,
    volume,
    issue,
    pages,
    doi,
    type,
    parseMode: 'regex',
  }
}
