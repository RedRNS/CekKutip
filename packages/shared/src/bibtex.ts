/**
 * Deterministic BibTeX reader and formatter. No model involved.
 *
 * `referencesFromBibtex` turns a .bib file into one plain APA-style line per entry, which then goes
 * through the same split, Parse, Retrieve, Match, and Decide steps as pasted text. It does not look
 * anything up and does not add information that the entry does not contain: a missing field stays
 * missing (for example, an arXiv `eprint` is not turned into a DOI).
 */

import { initialsOf, joinApaAuthors, withStop } from './apa.js'

export interface BibEntry {
  /** Lower-case entry type: article, book, phdthesis, ... */
  type: string
  key: string
  /** Lower-case field names. Values keep their LaTeX markup and inner braces. */
  fields: Record<string, string>
}

const MONTHS: Record<string, string> = {
  jan: 'January',
  feb: 'February',
  mar: 'March',
  apr: 'April',
  may: 'May',
  jun: 'June',
  jul: 'July',
  aug: 'August',
  sep: 'September',
  oct: 'October',
  nov: 'November',
  dec: 'December',
}

const WORD = /[A-Za-z0-9_\-:.+/]/
const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c)

/** Read a brace-balanced group starting at `{`. Returns the inner text and the index after `}`; null when unbalanced. */
function readBraced(text: string, start: number): { value: string; end: number } | null {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '\\') {
      i++ // an escaped brace does not count
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return { value: text.slice(start + 1, i), end: i + 1 }
    }
  }
  return null
}

/** Read a "..." value. Quotes inside braces do not end it. */
function readQuoted(text: string, start: number): { value: string; end: number } | null {
  let depth = 0
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '"' && depth === 0) return { value: text.slice(start + 1, i), end: i + 1 }
  }
  return null
}

/** One field value: parts joined with `#`, each a {group}, a "string", a number, or a macro name. */
function readValue(
  text: string,
  start: number,
  macros: Map<string, string>,
): { value: string; end: number } | null {
  let i = start
  let out = ''
  for (;;) {
    while (isSpace(text[i])) i++
    const c = text[i]
    if (c === '{') {
      const g = readBraced(text, i)
      if (g === null) return null
      out += g.value
      i = g.end
    } else if (c === '"') {
      const q = readQuoted(text, i)
      if (q === null) return null
      out += q.value
      i = q.end
    } else {
      let j = i
      while (j < text.length && WORD.test(text[j] as string)) j++
      if (j === i) return null
      const word = text.slice(i, j)
      out += /^\d+$/.test(word)
        ? word
        : (macros.get(word.toLowerCase()) ?? MONTHS[word.toLowerCase()] ?? word)
      i = j
    }
    while (isSpace(text[i])) i++
    if (text[i] === '#') {
      i++
      continue
    }
    return { value: out, end: i }
  }
}

/** Skip the body of an entry we do not use, up to its closing delimiter. */
function skipBody(text: string, open: number): number {
  if (text[open] === '{') return readBraced(text, open)?.end ?? text.length
  const close = text.indexOf(')', open)
  return close < 0 ? text.length : close + 1
}

export function parseBibtex(text: string): BibEntry[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // drop a byte order mark
  const macros = new Map<string, string>()
  const entries: BibEntry[] = []
  let pos = 0

  for (;;) {
    const at = src.indexOf('@', pos)
    if (at < 0) break
    let i = at + 1
    while (isSpace(src[i])) i++
    let j = i
    while (j < src.length && /[A-Za-z]/.test(src[j] as string)) j++
    const type = src.slice(i, j).toLowerCase()
    i = j
    while (isSpace(src[i])) i++
    const open = src[i]
    if (type === '' || (open !== '{' && open !== '(')) {
      pos = at + 1 // an "@" in running text, not an entry
      continue
    }
    const closeChar = open === '{' ? '}' : ')'
    const bodyStart = i + 1

    if (type === 'comment' || type === 'preamble') {
      pos = skipBody(src, i)
      continue
    }

    if (type === 'string') {
      let k = bodyStart
      while (isSpace(src[k])) k++
      let m = k
      while (m < src.length && WORD.test(src[m] as string)) m++
      const name = src.slice(k, m).toLowerCase()
      k = m
      while (isSpace(src[k])) k++
      if (src[k] === '=') {
        const v = readValue(src, k + 1, macros)
        if (v !== null && name !== '') macros.set(name, v.value)
      }
      pos = skipBody(src, i)
      continue
    }

    // Citation key: up to the first comma.
    let k = bodyStart
    const comma = src.indexOf(',', k)
    const closeIdx = src.indexOf(closeChar, k)
    if (comma < 0 || (closeIdx >= 0 && closeIdx < comma)) {
      pos = skipBody(src, i)
      continue
    }
    const key = src.slice(k, comma).trim()
    k = comma + 1

    const fields: Record<string, string> = {}
    let ended = false
    while (k < src.length) {
      while (isSpace(src[k]) || src[k] === ',') k++
      if (src[k] === closeChar) {
        k++
        ended = true
        break
      }
      let n = k
      while (n < src.length && WORD.test(src[n] as string)) n++
      if (n === k) break // unexpected character: give up on this entry
      const name = src.slice(k, n).toLowerCase()
      k = n
      while (isSpace(src[k])) k++
      if (src[k] !== '=') break
      const v = readValue(src, k + 1, macros)
      if (v === null) break
      if (!(name in fields)) fields[name] = v.value
      k = v.end
    }
    entries.push({ type, key, fields })
    pos = ended ? k : Math.max(skipBody(src, i), k)
  }
  return entries
}

// ---------- LaTeX to plain text ----------

const BACKSLASH = String.fromCharCode(92)
/** A backslash as it must be written inside a RegExp source (escaped). */
const RE_BS = String.fromCharCode(92, 92)
const EN_DASH = String.fromCharCode(0x2013)
const EM_DASH = String.fromCharCode(0x2014)

/** Accent commands and the combining mark each one adds. */
const ACCENT_MARKS: Record<string, number> = {
  "'": 0x301,
  '`': 0x300,
  '^': 0x302,
  '"': 0x308,
  '~': 0x303,
  '=': 0x304,
  '.': 0x307,
  u: 0x306,
  v: 0x30c,
  H: 0x30b,
  r: 0x30a,
  c: 0x327,
  k: 0x328,
}

const LETTER_COMMANDS: Record<string, string> = {
  ss: 'ß',
  o: 'ø',
  O: 'Ø',
  ae: 'æ',
  AE: 'Æ',
  oe: 'œ',
  OE: 'Œ',
  aa: 'å',
  AA: 'Å',
  l: 'ł',
  L: 'Ł',
  i: 'i',
  j: 'j',
}

/** Turn LaTeX markup in a BibTeX value into plain text. */
export function unlatex(raw: string): string {
  let s = raw
  const accentTo = (whole: string, accent: string, braced?: string, bare?: string) => {
    const mark = ACCENT_MARKS[accent]
    const letter = braced ?? bare
    return mark === undefined || letter === undefined ? whole : letter + String.fromCodePoint(mark)
  }
  const letter = `(?:${RE_BS}?)([A-Za-z])` // a letter, or a dotless \i or \j
  // Symbol accents: \"{u}  \"u  \'{\i}
  s = s.replace(
    new RegExp(`${RE_BS}(["'\`^~=.])\\s*(?:\\{\\s*${letter}\\s*\\}|${letter})`, 'g'),
    accentTo,
  )
  // Letter accents need a brace or a space, so that \url, \cite and \ref are not read as accents:
  // \c{c}  \c c  \v{s}
  s = s.replace(
    new RegExp(`${RE_BS}([uvHrck])(?![A-Za-z])\\s*(?:\\{\\s*${letter}\\s*\\}|${letter})`, 'g'),
    accentTo,
  )
  s = s.replace(
    new RegExp(`${RE_BS}(ss|oe|OE|ae|AE|aa|AA|o|O|l|L)(?![A-Za-z])\\s?`, 'g'),
    (_w, name: string) => LETTER_COMMANDS[name] ?? name,
  )
  s = s
    .replaceAll(`${BACKSLASH}&`, '&')
    .replaceAll(`${BACKSLASH}%`, '%')
    .replaceAll(`${BACKSLASH}$`, '$')
    .replaceAll(`${BACKSLASH}_`, '_')
    .replaceAll(`${BACKSLASH}#`, '#')
    .replaceAll('---', EM_DASH)
    .replaceAll('--', EN_DASH)
    .replaceAll('~', ' ')
  // \textit{x}, \emph{x}: keep the content. Repeat for nested commands.
  const wrapped = new RegExp(`${RE_BS}[A-Za-z]+\\*?\\s*\\{([^{}]*)\\}`, 'g')
  for (let n = 0; n < 4; n++) {
    const next = s.replace(wrapped, '$1')
    if (next === s) break
    s = next
  }
  s = s.replace(new RegExp(`${RE_BS}[A-Za-z]+\\*?\\s?`, 'g'), '')
  s = s.replace(/[{}$]/g, '').replace(/\s+/g, ' ').trim()
  return s.normalize('NFC')
}

// ---------- Names ----------

interface Person {
  corporate: boolean
  family: string
  given: string
  suffix: string
}

/** Split on a separator that sits outside braces. */
function splitTopLevel(s: string, sep: RegExp): string[] {
  const parts: string[] = []
  let depth = 0
  let last = 0
  // Sticky: the separator must start exactly at the position being tested.
  const re = new RegExp(sep.source, sep.flags.replace(/[gy]/g, '') + 'y')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '{') depth++
    else if (c === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0) {
      re.lastIndex = i
      const m = re.exec(s)
      if (m && m[0].length > 0) {
        parts.push(s.slice(last, i))
        i += m[0].length - 1
        last = i + 1
      }
    }
  }
  parts.push(s.slice(last))
  return parts.map((p) => p.trim()).filter((p) => p !== '')
}

const isWholeGroup = (s: string) => s.startsWith('{') && readBraced(s, 0)?.end === s.length

function parsePerson(raw: string): Person {
  if (isWholeGroup(raw)) {
    return { corporate: true, family: unlatex(raw), given: '', suffix: '' }
  }
  const commaParts = splitTopLevel(raw, /,/)
  if (commaParts.length >= 2) {
    const [family = '', second = '', third] = commaParts
    return third === undefined
      ? { corporate: false, family: unlatex(family), given: unlatex(second), suffix: '' }
      : {
          corporate: false,
          family: unlatex(family),
          given: unlatex(third),
          suffix: unlatex(second),
        }
  }
  // "First Middle von Last": the family name is the last word plus any lower-case particles before it.
  const words = splitTopLevel(raw, /\s+/)
  if (words.length <= 1) return { corporate: false, family: unlatex(raw), given: '', suffix: '' }
  let start = words.length - 1
  while (start > 1 && /^\p{Ll}/u.test(unlatex(words[start - 1] as string))) start--
  return {
    corporate: false,
    family: unlatex(words.slice(start).join(' ')),
    given: unlatex(words.slice(0, start).join(' ')),
    suffix: '',
  }
}

function formatPerson(p: Person): string {
  if (p.corporate) return p.family
  const ini = initialsOf(p.given)
  const base = ini === '' ? p.family : `${p.family}, ${ini}`
  return p.suffix === '' ? base : `${base}, ${p.suffix}`
}

/** APA 7 author list: up to 20 names, "&" before the last, "et al." when the entry says "and others". */
function formatAuthors(field: string): string {
  const names = splitTopLevel(field, /\s+and\s+/i)
  const etAl = names.length > 0 && /^others$/i.test(names[names.length - 1] as string)
  const people = (etAl ? names.slice(0, -1) : names).map(parsePerson).map(formatPerson)
  return joinApaAuthors(people, etAl)
}

// ---------- Entry to line ----------

const field = (e: BibEntry, ...names: string[]): string => {
  for (const n of names) {
    const v = e.fields[n]
    if (v !== undefined && unlatex(v) !== '') return unlatex(v)
  }
  return ''
}

function doiLink(e: BibEntry): string {
  const doi = field(e, 'doi').replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '')
  if (doi !== '') return `https://doi.org/${doi}`
  return field(e, 'url')
}

const THESIS_LABEL: Record<string, string> = {
  phdthesis: 'Doctoral dissertation',
  mastersthesis: "Master's thesis",
}

/** One APA-style line for an entry, or null when it has no title to look up. */
export function formatBibEntry(e: BibEntry): string | null {
  const title = field(e, 'title')
  if (title === '') return null

  // With no author, the editors stand in for them, marked as editors.
  const names = e.fields.author ?? e.fields.editor ?? ''
  const isEditor = e.fields.author === undefined && e.fields.editor !== undefined
  const many = /\s+and\s+/i.test(names)
  const authorLine = formatAuthors(names)
  const authors =
    isEditor && authorLine !== '' ? `${authorLine} (${many ? 'Eds.' : 'Ed.'})` : authorLine
  const year = /\d{4}/.exec(field(e, 'year', 'date'))?.[0]
  const date = year ? `(${year})` : '(n.d.)'

  const volume = field(e, 'volume')
  const number = field(e, 'number', 'issue')
  const pages = field(e, 'pages').replaceAll(EN_DASH, '-').replaceAll(EM_DASH, '-')
  const volIssue = volume ? (number ? `${volume}(${number})` : volume) : ''

  let heading = title
  let container = ''
  switch (e.type) {
    case 'article': {
      const journal = field(e, 'journal', 'journaltitle')
      container = [journal, volIssue, pages].filter(Boolean).join(', ')
      break
    }
    case 'inproceedings':
    case 'conference':
    case 'incollection':
    case 'inbook': {
      const book = field(e, 'booktitle')
      container = [book ? `In ${book}` : '', pages ? `(pp. ${pages})` : '']
        .filter(Boolean)
        .join(' ')
      const publisher = field(e, 'publisher')
      if (publisher) container = `${withStop(container)} ${publisher}`
      break
    }
    case 'phdthesis':
    case 'mastersthesis':
    case 'thesis': {
      const label = THESIS_LABEL[e.type] ?? (field(e, 'type') || 'Thesis')
      const school = field(e, 'school', 'institution')
      heading = `${title} [${[label, school].filter(Boolean).join(', ')}]`
      break
    }
    case 'techreport':
    case 'report': {
      const kind = field(e, 'type')
      if (number) heading = `${title} (${kind || 'Report'} No. ${number})`
      container = field(e, 'institution', 'publisher')
      break
    }
    default: {
      // book, proceedings, misc, online, unpublished, ...
      const prefix = field(e, 'archiveprefix', 'eprinttype')
      container =
        field(e, 'publisher', 'howpublished', 'organization', 'institution') ||
        (prefix ? prefix : '')
    }
  }

  const link = doiLink(e)
  const body = [
    authors ? `${withStop(authors)} ${date}.` : '',
    `${withStop(heading)}`,
    container ? withStop(container) : '',
    link,
  ]
    .filter(Boolean)
    .join(' ')
  return body.replace(/\s+/g, ' ').trim()
}

export interface BibtexResult {
  references: string[]
  /** Entries left out because they have no title. */
  skipped: number
}

export function referencesFromBibtex(text: string): BibtexResult {
  const references: string[] = []
  let skipped = 0
  for (const entry of parseBibtex(text)) {
    const line = formatBibEntry(entry)
    if (line === null) skipped++
    else references.push(line)
  }
  return { references, skipped }
}
