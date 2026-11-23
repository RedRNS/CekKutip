import { parsePeople } from './people.js'
import type { JournalArticle } from './types.js'

/** The parts of a reference as they were written, with their punctuation. For saying what changed. */
export interface WrittenParts {
  authors: string
  year: string
  title: string
  source: string
  /** The DOI as it was written ("doi:10.1/x", "https://doi.org/10.1/x", "Available at: ..."), or null. */
  doi: string | null
}

export type ParseResult =
  | { ok: true; ref: JournalArticle; written: WrittenParts; cleaned: string; compare: string }
  | {
      ok: false
      reason: 'not_journal_article' | 'unreadable'
      /** The text with its list number removed and its DOI written as a link. */
      cleaned: string
      compare: string
    }

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

/** A reference is a line or two. A longer text is not read: it is not one reference, and reading it is slow. */
export const MAX_REFERENCE_CHARS = 2000

/** Spaces, straight quotes, no list number, no Markdown italics. */
function clean(raw: string): string {
  let s = raw.normalize('NFKC')
  s = s.replace(/[“”„‟«»]/g, '"')
  s = s.replace(/[‘’‚‛′]/g, "'")
  s = collapse(s)
  s = s.replace(/^(?:\[\d+\]|\(\d+\)|\d+[.)])\s+/, '')
  s = s.replace(/\*+([^*]+)\*+/g, '$1')
  s = s.replace(/(^|[\s(])_+([^_]+)_+(?=[\s,.;:)]|$)/g, '$1$2')
  return s.trim()
}

const DOI =
  /(?:(?:available at|retrieved from|diakses dari|diakses pada|tersedia di)\s*:?\s*)?(?:(?:https?:\/\/)?(?:dx\.)?doi\.org\/|\bdoi:?\s*)(10\.\d{4,9}\/[^\s"<>]+)/i

/** The DOI without trailing punctuation, and that punctuation. */
function splitDoi(found: string): { doi: string; trail: string } {
  const doi = found.replace(/[.,;:)\]]+$/, '')
  return { doi, trail: found.slice(doi.length) }
}

const URL_RE =
  /(?:(?:available at|retrieved from|diakses dari|diakses pada|tersedia di)\s*:?\s*)?\bhttps?:\/\/[^\s"<>]+(?:\s*\((?:accessed|diakses)[^)]*\))?/i

const tidyEnd = (s: string) =>
  collapse(s)
    .replace(/(?:\s*[,;:])+$/, '')
    .replace(/\.(?:\s*\.)+$/, '.')

/** Months as they come in IEEE references: "Jan.", "Sept.", "May/Jun.", "April-June". */
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?'
const MONTHS = `${MONTH}(?:[-/]${MONTH})?`

const ABBREVIATIONS = new Set([
  'vs',
  'no',
  'vol',
  'al',
  'dkk',
  'dll',
  'dr',
  'prof',
  'inc',
  'ltd',
  'co',
  'jr',
  'sr',
  'st',
  'mr',
  'mrs',
  'ms',
  'ed',
  'eds',
  'pp',
  'hal',
  'ca',
  'cf',
  'etc',
])

/** Where a title ends in unquoted text: a full stop, "?" or "!" that is not an abbreviation or an initial. */
function titleEnd(s: string): number {
  for (let p = 0; p < s.length; p++) {
    const c = s.charAt(p)
    if (c !== '.' && c !== '?' && c !== '!') continue
    if (p + 1 < s.length && s.charAt(p + 1) !== ' ') continue
    const word = /(\S+)$/.exec(s.slice(0, p))?.[1] ?? ''
    if (c === '.') {
      if (/^\p{L}$/u.test(word.replace(/^\W+/, ''))) continue // an initial: "U" in "U.S."
      if (/^(?:\p{L}\.)+\p{L}$/u.test(word)) continue // "e.g", "U.S"
      if (ABBREVIATIONS.has(word.toLowerCase().replace(/^\W+/, ''))) continue
    }
    const next = s.slice(p + 1).trimStart()
    if (next === '') return p
    if (!/^[\p{Lu}\p{N}"'([]/u.test(next)) continue
    if (c !== '.') {
      // "Is it real? A study of things. Journal, 1(1)": a plain sentence after "?" is a subtitle.
      const sentence = next.slice(0, Math.max(0, next.indexOf('. ')))
      if (sentence !== '' && !/[\d,]/.test(sentence) && sentence.split(' ').length >= 3) continue
    }
    return p
  }
  return -1
}

/**
 * A title in quotes at the start of `s`. Returns where the closing quote is: the first quote that is
 * followed by a separator or the end. An apostrophe inside a word ("Women's") is not a closing quote.
 */
function quotedEnd(s: string): number {
  const q = s.charAt(0)
  if (q !== '"' && q !== "'") return -1
  for (let k = 1; k < s.length; k++) {
    if (s.charAt(k) !== q) continue
    const after = s.charAt(k + 1)
    if (after === '' || /[\s,.;:]/.test(after)) return k
  }
  return -1
}

const PAGES = String.raw`[A-Za-z]?\d+(?:\s*[-–—]+\s*[A-Za-z]?\d+)?`
const normalizePages = (p: string) => p.replace(/\s*[-–—]+\s*/g, '-').trim()

interface Source {
  journal: string
  volume: string | null
  issue: string | null
  pages: string | null
  articleNumber: boolean
}

const articleRe = new RegExp(
  String.raw`\b(?:art(?:icle)?\.?(?:\s*no\.?)?|artikel)\s*#?\s*([A-Za-z]?\d[\w.-]*)`,
  'i',
)
const volumeRe = /\b(?:vol(?:ume)?|jilid)\.?\s*(\d+[A-Za-z]?)/i
const issueRe = /\b(?:no|nomor|issue|iss|number)\.?\s*(\d+(?:[-/]\d+)?)/i
const pagesRe = new RegExp(String.raw`\b(?:pp?|hal|halaman|pages?)\.?\s*(${PAGES})`, 'i')

/** The part before any pages: the journal, and a volume and issue written out or compact. */
function parseHead(head: string): Omit<Source, 'pages' | 'articleNumber'> {
  const vol = volumeRe.exec(head)
  const iss = issueRe.exec(head)
  if (vol || iss) {
    const at = Math.min(vol?.index ?? Infinity, iss?.index ?? Infinity)
    return {
      journal: head.slice(0, at).replace(/[\s,:;(-]+$/, ''),
      volume: vol?.[1] ?? null,
      issue: iss?.[1] ?? null,
    }
  }
  // "Journal, 2(3)" and "Journal 2(3)"
  const compact = /^(.+?)[,\s]+(\d+)\s*\(([^)]+)\)$/.exec(head)
  if (compact) {
    return {
      journal: (compact[1] as string).replace(/[\s,:;]+$/, ''),
      volume: compact[2] as string,
      issue: (compact[3] as string).trim(),
    }
  }
  const volOnly = /^(.+?),\s*(\d+)$/.exec(head)
  if (volOnly) return { journal: (volOnly[1] as string).trim(), volume: volOnly[2] as string, issue: null }
  return { journal: head, volume: null, issue: null }
}

/** "Scientific Reports, 13(1), 14045" and its cousins: the journal, volume, issue, and pages or article number. */
function parseSource(text: string): Source {
  const s = text.replace(/[.\s]+$/, '').replace(/^[\s,]+/, '')

  // Pages or an article number with a label ("pp. 14-20", "Art. no. 14045"): the journal, volume, and
  // issue are what comes before it.
  const article = articleRe.exec(s)
  // Blank the article number with spaces, so the positions of the other parts stay where they are.
  const withoutArticle = article ? s.replace(articleRe, (m) => ' '.repeat(m.length)) : s
  const pag = pagesRe.exec(withoutArticle)
  const cut = Math.min(article?.index ?? Infinity, pag?.index ?? Infinity)
  if (cut !== Infinity) {
    return {
      ...parseHead(s.slice(0, cut).replace(/[\s,;:(-]+$/, '')),
      pages: article ? (article[1] as string) : normalizePages(pag?.[1] as string),
      articleNumber: article !== null,
    }
  }

  // No label on the pages. Volume and issue written out: "Journal, vol. 13, no. 1".
  if (volumeRe.test(s) || issueRe.test(s)) return { ...parseHead(s), pages: null, articleNumber: false }

  // Compact: "Journal, 13(1), 14045", "Journal 13(1):14-20", "Journal, 13(1)".
  const compact = new RegExp(
    String.raw`^(.+?)[,\s]+(\d+)\s*\(([^)]+)\)\s*[,:]?\s*(${PAGES})?$`,
  ).exec(s)
  if (compact) {
    return {
      journal: (compact[1] as string).replace(/[\s,:;]+$/, ''),
      volume: compact[2] as string,
      issue: (compact[3] as string).trim(),
      pages: compact[4] ? normalizePages(compact[4]) : null,
      articleNumber: false,
    }
  }
  // A volume and pages, no issue: "Journal, 13, 207-217". A volume alone: "Journal, 13".
  const volPages = new RegExp(String.raw`^(.+?),\s*(\d+)\s*[,:]\s*(${PAGES})$`).exec(s)
  if (volPages) {
    return {
      journal: (volPages[1] as string).trim(),
      volume: volPages[2] as string,
      issue: null,
      pages: normalizePages(volPages[3] as string),
      articleNumber: false,
    }
  }
  return { ...parseHead(s), pages: null, articleNumber: false }
}

const THESIS = /\[\s*(?:skripsi|tesis|thesis|disertasi|dissertation|tugas akhir|unpublished)[^\]]*\]/i
const THESIS_SOURCE = /^\s*(?:skripsi|tesis|disertasi|thesis|dissertation)\b/i
const CONFERENCE =
  /\b(?:conference|konferensi|symposium|simposium|workshop|lokakarya|seminar nasional|prosiding)\b|\bproceedings of (?:the )?(?:\d|[\p{Lu}][\w-]*\s)*?(?:conference|symposium|workshop|meeting)\b/iu

/**
 * Read a journal article from a reference written in APA, Harvard, or IEEE form, or carelessly.
 * Anything else is refused with a reason: a book, a thesis, a web page, a conference paper, or text it
 * cannot read. It never guesses a journal article out of something that is not one.
 */
export function parseReference(raw: string): ParseResult {
  const compare = clean(raw)
  const cleaned = compare.replace(DOI, (_match, num: string) => {
    const { doi, trail } = splitDoi(num)
    return `https://doi.org/${doi}${trail}`
  })
  const refuse = (reason: 'not_journal_article' | 'unreadable'): ParseResult => ({
    ok: false,
    reason,
    cleaned,
    compare,
  })
  if (compare === '' || compare.length > MAX_REFERENCE_CHARS) return refuse('unreadable')

  // The DOI and any other address come out first: they sit at the end and confuse the rest.
  let body = compare
  let doi: string | null = null
  let writtenDoi: string | null = null
  const doiMatch = DOI.exec(body)
  if (doiMatch) {
    doi = splitDoi(doiMatch[1] as string).doi
    writtenDoi = doiMatch[0].trim()
    body = body.replace(doiMatch[0], ' ')
  }
  let url: string | null = null
  const urlMatch = URL_RE.exec(body)
  if (urlMatch) {
    url = (/https?:\/\/[^\s"<>]+/i.exec(urlMatch[0])?.[0] ?? '').replace(/[.,;:)\]]+$/, '')
    body = body.replace(urlMatch[0], ' ')
  }
  body = tidyEnd(body)

  if (THESIS.test(body)) return refuse('not_journal_article')

  let authorsText: string
  let yearWritten: string
  let year: string
  let titleWritten: string
  let title: string
  let rest: string
  /** The part after the title as it was written (for IEEE that includes the year). */
  let writtenSource: string

  const dateRe =
    /^(?<authors>.+?)\s*[([]\s*(?<year>(?:19|20)\d{2}[a-z]?|n\.\s?d\.|t\.\s?t\.|tanpa tahun|no date)\s*[)\]]\s*(?<punct>[.,:])?\s*(?<rest>.*)$/i
  const firstQuote = body.indexOf('"')
  const quoteFirst =
    firstQuote > 0 && !/\(\s*(?:19|20)\d{2}[a-z]?\s*\)/.test(body.slice(0, firstQuote))

  if (quoteFirst) {
    // IEEE: authors, "Title," Journal, vol. 1, no. 2, pp. 3-4, Mon. Year.
    const m = /^(?<authors>[^"]+?),\s*(?<title>".+?")(?<punct>[,.])?\s*(?<rest>.*)$/.exec(body)
    if (!m?.groups) return refuse('unreadable')
    authorsText = (m.groups.authors as string).trim()
    titleWritten = `${m.groups.title as string}${(m.groups.punct as string | undefined) ?? ''}`
    title = (m.groups.title as string).slice(1, -1).replace(/[,.]$/, '').trim()
    rest = (m.groups.rest as string).trim()
    // The year is the last number of four digits, after an optional month.
    const y = new RegExp(String.raw`(?:^|,\s*)(?:${MONTHS}\s+)?((?:19|20)\d{2})\s*[.,]?\s*$`).exec(rest)
    if (!y) return refuse('unreadable')
    writtenSource = rest.replace(/[,;\s]+$/, '')
    rest = rest.slice(0, y.index).replace(/[\s,;]+$/, '')
    year = y[1] as string
    yearWritten = year
  } else {
    const m = dateRe.exec(body)
    if (!m?.groups) return refuse('unreadable')
    authorsText = (m.groups.authors as string).trim()
    yearWritten = `(${(m.groups.year as string).trim()})${(m.groups.punct as string | undefined) ?? ''}`
    const y = (m.groups.year as string).trim().toLowerCase()
    year = /^(?:19|20)\d{2}[a-z]?$/.test(y) ? y : 'n.d.'
    const after = (m.groups.rest as string).trim()
    if (after === '') return refuse('unreadable')

    const q = quotedEnd(after)
    if (q > 0) {
      const punct = /^[,.]/.test(after.slice(q + 1)) ? after.charAt(q + 1) : ''
      titleWritten = after.slice(0, q + 1) + punct
      title = after.slice(1, q).replace(/[,.]$/, '').trim()
      rest = after.slice(q + 1 + punct.length).trim()
    } else {
      const end = titleEnd(after)
      if (end < 0) return refuse('not_journal_article')
      const mark = after.charAt(end)
      titleWritten = after.slice(0, end + 1)
      title = (mark === '.' ? after.slice(0, end) : after.slice(0, end + 1)).trim()
      rest = after.slice(end + 1).trim()
    }
    writtenSource = rest.replace(/[,;\s]+$/, '')
  }

  if (!/\p{L}/u.test(authorsText) || title === '') return refuse('unreadable')
  if (rest === '') return refuse('not_journal_article')
  if (THESIS_SOURCE.test(rest)) return refuse('not_journal_article')
  if (CONFERENCE.test(rest) && !/proceedings of the national academy/i.test(rest)) {
    return refuse('not_journal_article')
  }

  const source = parseSource(rest)
  const hasLocator = source.volume !== null || source.issue !== null || source.pages !== null
  if (source.journal === '' || !hasLocator || /^\d+$/.test(source.journal)) {
    return refuse('not_journal_article')
  }

  const people = parsePeople(authorsText)
  if (people.people.length === 0) return refuse('unreadable')

  return {
    ok: true,
    cleaned,
    compare,
    ref: {
      authors: people.people,
      etAl: people.etAl,
      namesUncertain: people.uncertain,
      year,
      title,
      journal: source.journal,
      volume: source.volume,
      issue: source.issue,
      pages: source.pages,
      articleNumber: source.articleNumber,
      doi,
      url,
    },
    written: {
      authors: authorsText,
      year: yearWritten,
      title: titleWritten,
      source: writtenSource,
      doi: writtenDoi,
    },
  }
}
