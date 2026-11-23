import { plain } from './pieces.js'
import { formatInitials } from './people.js'
import { looksLikeTitleCase, toSentenceCase } from './sentence-case.js'
import type {
  FormatOptions,
  FormatStyle,
  Formatted,
  JournalArticle,
  NoteCode,
  Person,
  Piece,
} from './types.js'

const EN_DASH = String.fromCharCode(0x2013)

/** "207-217" with an en dash. A single page or an article number is left as it is. */
const withEnDash = (pages: string) => pages.replace(/(\w)-(\w)/, `$1${EN_DASH}$2`)

type Locator =
  | { kind: 'none' }
  | { kind: 'pages'; text: string; range: boolean }
  | { kind: 'article'; text: string; assumed: boolean }

/**
 * Pages or an article number. One value of five digits or more, or one that starts with a letter
 * ("e0123"), is read as an article number when the text did not say what it was. `assumed` says so.
 */
function locatorOf(a: JournalArticle): Locator {
  const p = a.pages
  if (p === null || p === '') return { kind: 'none' }
  if (a.articleNumber) return { kind: 'article', text: p, assumed: false }
  if (p.includes('-')) return { kind: 'pages', text: withEnDash(p), range: true }
  if (/^\d{5,}$/.test(p) || /^[A-Za-z]\d+/.test(p)) return { kind: 'article', text: p, assumed: true }
  return { kind: 'pages', text: p, range: false }
}

const lastStop = (s: string) => (s.endsWith('.') ? s : `${s}.`)
const endsWithMark = (s: string) => /[?!]$/.test(s)

// Names -------------------------------------------------------------------------------------------

const apaName = (p: Person): string => {
  if (p.org) return p.family
  const initials = formatInitials(p.given, true)
  return initials === '' ? p.family : `${p.family}, ${initials}`
}
const ieeeName = (p: Person): string => {
  if (p.org) return p.family
  const initials = formatInitials(p.given, true)
  return initials === '' ? p.family : `${initials} ${p.family}`
}
const harvardName = (p: Person): string => {
  if (p.org) return p.family
  const initials = formatInitials(p.given, false)
  return initials === '' ? p.family : `${p.family}, ${initials}`
}

interface Authors {
  /** The text, and the pieces when part of it is italic ("et al." in Harvard). */
  pieces: Piece[]
  /** Some of the names that the text gave were left out. */
  shortened: boolean
}

function apaAuthors(a: JournalArticle): Authors {
  const names = a.authors.map(apaName)
  const n = names.length
  let text: string
  let shortened = false
  if (a.etAl) text = `${names.join(', ')}, et al.`
  else if (n === 1) text = names[0] as string
  else if (n === 2) text = `${names[0]}, & ${names[1]}`
  else if (n <= 20) text = `${names.slice(0, -1).join(', ')}, & ${names[n - 1]}`
  else {
    text = `${names.slice(0, 19).join(', ')}, ... ${names[n - 1]}`
    shortened = true
  }
  return { pieces: [{ text: lastStop(text) }], shortened }
}

function ieeeAuthors(a: JournalArticle): Authors {
  const names = a.authors.map(ieeeName)
  const n = names.length
  if (a.etAl || n > 6) {
    return { pieces: [{ text: `${names[0]} et al.` }], shortened: n > 1 }
  }
  if (n === 1) return { pieces: [{ text: names[0] as string }], shortened: false }
  if (n === 2) return { pieces: [{ text: `${names[0]} and ${names[1]}` }], shortened: false }
  return { pieces: [{ text: `${names.slice(0, -1).join(', ')}, and ${names[n - 1]}` }], shortened: false }
}

function harvardAuthors(a: JournalArticle): Authors {
  const names = a.authors.map(harvardName)
  const n = names.length
  if (a.etAl) {
    return {
      pieces: [{ text: `${names[0]} ` }, { text: 'et al.', italic: true }],
      shortened: n > 1,
    }
  }
  if (n === 1) return { pieces: [{ text: names[0] as string }], shortened: false }
  if (n === 2) return { pieces: [{ text: `${names[0]} and ${names[1]}` }], shortened: false }
  return { pieces: [{ text: `${names.slice(0, -1).join(', ')} and ${names[n - 1]}` }], shortened: false }
}

// The three styles --------------------------------------------------------------------------------

interface Built {
  authors: Authors
  year: string
  title: string
  source: Piece[]
  doi: string
  /** The reference put together. */
  pieces: Piece[]
}

function apa(a: JournalArticle, title: string, loc: Locator): Built {
  const authors = apaAuthors(a)
  const year = a.year === 'n.d.' ? '(n.d.).' : `(${a.year}).`
  const titleText = endsWithMark(title) ? title : `${title}.`

  const source: Piece[] = [{ text: a.journal, italic: true }]
  if (a.volume !== null) {
    source.push({ text: ', ' }, { text: a.volume, italic: true })
    if (a.issue !== null) source.push({ text: `(${a.issue})` })
  } else if (a.issue !== null) {
    source.push({ text: `, (${a.issue})` })
  }
  if (loc.kind === 'pages') source.push({ text: `, ${loc.text}` })
  if (loc.kind === 'article') source.push({ text: `, Article ${loc.text}` })
  source.push({ text: '.' })

  const doi = a.doi !== null ? `https://doi.org/${a.doi}` : (a.url ?? '')
  const pieces: Piece[] = [
    ...authors.pieces,
    { text: ` ${year} ${titleText} ` },
    ...source,
    ...(doi === '' ? [] : [{ text: ` ${doi}` }]),
  ]
  return { authors, year, title: titleText, source, doi, pieces }
}

function ieee(a: JournalArticle, title: string, loc: Locator): Built {
  const authors = ieeeAuthors(a)
  const titleText = endsWithMark(title) ? `"${title}"` : `"${title},"`

  let tail = ''
  if (a.volume !== null) tail += `, vol. ${a.volume}`
  if (a.issue !== null) tail += `, no. ${a.issue}`
  if (loc.kind === 'pages') tail += loc.range ? `, pp. ${loc.text}` : `, p. ${loc.text}`
  if (loc.kind === 'article') tail += `, Art. no. ${loc.text}`
  if (a.year !== 'n.d.') tail += `, ${a.year}`
  const source: Piece[] = [{ text: a.journal, italic: true }, { text: tail }]

  const doi = a.doi !== null ? `doi: ${a.doi}.` : a.url !== null ? `[Online]. Available: ${a.url}` : ''
  const end = a.doi !== null ? `, ${doi}` : a.url !== null ? `. ${doi}` : '.'
  const pieces: Piece[] = [...authors.pieces, { text: `, ${titleText} ` }, ...source, { text: end }]
  // The full stop that closes a reference with no DOI belongs to its source.
  const closed: Piece[] = a.doi !== null ? source : [...source.slice(0, -1), { text: `${tail}.` }]
  return { authors, year: '', title: titleText, source: closed, doi, pieces }
}

function harvard(a: JournalArticle, title: string, loc: Locator): Built {
  const authors = harvardAuthors(a)
  const year = a.year === 'n.d.' ? '(no date)' : `(${a.year})`
  const titleText = `'${title}',`

  const source: Piece[] = [{ text: a.journal, italic: true }]
  if (a.volume !== null || a.issue !== null) {
    source.push({ text: `, ${a.volume ?? ''}${a.issue !== null ? `(${a.issue})` : ''}` })
  }
  if (loc.kind === 'pages') source.push({ text: loc.range ? `, pp. ${loc.text}` : `, p. ${loc.text}` })
  if (loc.kind === 'article') source.push({ text: `, article ${loc.text}` })
  source.push({ text: '.' })

  const doi =
    a.doi !== null
      ? `Available at: https://doi.org/${a.doi}.`
      : a.url !== null
        ? `Available at: ${a.url}.`
        : ''
  const pieces: Piece[] = [
    ...authors.pieces,
    { text: ` ${year} ${titleText} ` },
    ...source,
    ...(doi === '' ? [] : [{ text: ` ${doi}` }]),
  ]
  return { authors, year, title: titleText, source, doi, pieces }
}

/**
 * Write a journal article in APA 7, IEEE, or Harvard (Cite Them Right, as the Open University and DMU guides
 * give it). Fixed rules, no model. The notes name what the rules could not decide.
 */
export function formatArticle(
  a: JournalArticle,
  style: FormatStyle,
  opts: FormatOptions,
): Formatted {
  const loc = locatorOf(a)

  let title = a.title
  let titleNote: NoteCode | null = null
  if (opts.sentenceCase) {
    title = toSentenceCase(a.title)
    if (title !== a.title) titleNote = 'sentence_case_applied'
  } else if (looksLikeTitleCase(a.title)) {
    titleNote = 'title_case'
  }

  const built = style === 'apa' ? apa(a, title, loc) : style === 'ieee' ? ieee(a, title, loc) : harvard(a, title, loc)

  const notes: NoteCode[] = []
  if (a.etAl) notes.push('et_al_kept')
  if (built.authors.shortened) notes.push('authors_shortened')
  if (loc.kind === 'article' && loc.assumed) notes.push('article_number_assumed')
  if (titleNote !== null) notes.push(titleNote)
  if (style === 'ieee') notes.push('ieee_journal_abbreviation')

  return {
    pieces: built.pieces,
    parts: {
      authors: plain(built.authors.pieces),
      year: built.year,
      title: built.title,
      source: plain(built.source),
      doi: built.doi,
    },
    notes,
  }
}
