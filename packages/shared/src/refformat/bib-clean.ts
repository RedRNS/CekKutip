import { normalizeText } from '../normalize.js'
import { scanBibtex } from './bib-scan.js'
import type { ScannedEntry, ScannedField } from './bib-scan.js'
import { isOrganisationName } from './people.js'

export type BibRule =
  | 'journal_period'
  | 'doi_prefix'
  | 'pages_dash'
  | 'et_al'
  | 'year_period'
  | 'month_from_year'
  | 'drop_url_copy'
  | 'drop_note_copy'

export interface BibFix {
  key: string
  rule: BibRule
  field: string
  /** The value as it was in the file. */
  before: string
  /** The value as it is now. Empty when the field was removed. */
  after: string
}

export type BibFlagCode =
  | 'no_key'
  | 'duplicate_key'
  | 'author_one_name'
  | 'duplicate_work'
  | 'looks_like_preprint'
  | 'looks_like_proceedings'
  | 'number_zero'
  | 'future_date'
  | 'missing_field'

export interface BibFlag {
  key: string
  code: BibFlagCode
  /** The other entry's key, the journal, the date, or the missing fields. Empty when there is nothing to add. */
  detail: string
}

export interface CleanBibOptions {
  /** Write "Sep. 2025" in `year` as `year = {2025}` and `month = sep`. Off unless asked: some styles need it. */
  monthFromYear: boolean
  /** Remove a `url` and a `note` that only repeat the DOI. Off unless asked: some styles print the DOI from them. */
  dropDoiCopies: boolean
  /** Today, for dates that have not happened yet. */
  now: Date
}

export interface CleanBibResult {
  /** The file, with the fixes made in its own text. */
  text: string
  entries: number
  fixes: BibFix[]
  flags: BibFlag[]
  /** How many entries each switch would change, whether or not it is on. */
  offered: { monthInYear: number; doiCopies: number }
}

interface Edit {
  start: number
  end: number
  text: string
}

const MONTHS: Record<string, string> = {
  jan: 'jan',
  january: 'jan',
  feb: 'feb',
  february: 'feb',
  mar: 'mar',
  march: 'mar',
  apr: 'apr',
  april: 'apr',
  may: 'may',
  jun: 'jun',
  june: 'jun',
  jul: 'jul',
  july: 'jul',
  aug: 'aug',
  august: 'aug',
  sep: 'sep',
  sept: 'sep',
  september: 'sep',
  oct: 'oct',
  october: 'oct',
  nov: 'nov',
  november: 'nov',
  dec: 'dec',
  december: 'dec',
}
const MONTH_ORDER = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** What each entry type cannot do without, for the standard BibTeX styles. Each item is a field or "a|b". */
const REQUIRED: Record<string, string[]> = {
  article: ['author', 'title', 'journal', 'year'],
  inproceedings: ['author', 'title', 'booktitle', 'year'],
  conference: ['author', 'title', 'booktitle', 'year'],
  book: ['author|editor', 'title', 'publisher', 'year'],
  incollection: ['author', 'title', 'booktitle', 'publisher', 'year'],
  phdthesis: ['author', 'title', 'school', 'year'],
  mastersthesis: ['author', 'title', 'school', 'year'],
  techreport: ['author', 'title', 'institution', 'year'],
}

const DOI_PREFIX = /^\s*(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i
const bareDoi = (inner: string) => inner.replace(DOI_PREFIX, '').trim()

const field = (e: ScannedEntry, name: string): ScannedField | undefined =>
  e.fields.find((f) => f.name === name)

/** A field's text with the braces taken out, for comparing. */
const plainText = (f: ScannedField | undefined): string =>
  f === undefined ? '' : (f.inner ?? f.raw).replace(/[{}]/g, '').trim()

/** A year and a month from a field value, whichever way the month is written. */
function monthAndYear(inner: string): { year: string; month: string } | null {
  const a = /^\s*([A-Za-z]{3,9})\.?\s+(\d{4})\s*$/.exec(inner)
  if (a && MONTHS[(a[1] as string).toLowerCase()]) {
    return { year: a[2] as string, month: MONTHS[(a[1] as string).toLowerCase()] as string }
  }
  const b = /^\s*(\d{4})\s+([A-Za-z]{3,9})\.?\s*$/.exec(inner)
  if (b && MONTHS[(b[2] as string).toLowerCase()]) {
    return { year: b[1] as string, month: MONTHS[(b[2] as string).toLowerCase()] as string }
  }
  return null
}

/** The line ending in use near `at`. */
function eolNear(src: string, at: number): string {
  const nl = src.indexOf('\n', at)
  return nl > 0 && src[nl - 1] === '\r' ? '\r\n' : '\n'
}

/** Cut `edits` into `src`. They must not overlap; the last one wins if two start at the same place. */
function applyEdits(src: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end)
  let out = src
  let floor = Infinity
  for (const e of sorted) {
    if (e.end > floor) continue // overlaps one already made: skip it, rather than damage the file
    out = out.slice(0, e.start) + e.text + out.slice(e.end)
    floor = e.start
  }
  return out
}

/**
 * Clean a .bib file in its own text. Only what is plainly wrong is fixed, and everything else (comments,
 * order, spacing, keys, fields it does not know) stays as it was. What needs a person is flagged and not
 * changed. Two switches, off by default, put right habits that some styles rely on.
 */
export function cleanBibtex(source: string, options: CleanBibOptions): CleanBibResult {
  const entries = scanBibtex(source)
  const edits: Edit[] = []
  const fixes: BibFix[] = []
  const flags: BibFlag[] = []
  const offered = { monthInYear: 0, doiCopies: 0 }

  const nowYear = options.now.getUTCFullYear()
  const nowMonth = options.now.getUTCMonth() + 1

  const firstWithKey = new Map<string, string>()
  const firstWithTitle = new Map<string, string>()
  const firstWithDoi = new Map<string, string>()

  for (const e of entries) {
    const dropped = new Set<ScannedField>()
    const fix = (f: ScannedField, rule: BibRule, before: string, after: string) => {
      fixes.push({ key: e.key, rule, field: f.name, before, after })
    }
    const replaceInner = (f: ScannedField, rule: BibRule, after: string) => {
      const before = f.inner as string
      if (after === before) return
      edits.push({ start: f.innerStart, end: f.innerEnd, text: after })
      fix(f, rule, before, after)
    }

    // The DOI of the entry, as it will be written.
    const doiField = field(e, 'doi')
    const doi = doiField?.inner != null ? bareDoi(doiField.inner) : ''

    for (const f of e.fields) {
      if (f.inner === null) continue
      const inner = f.inner
      switch (f.name) {
        case 'journal':
        case 'booktitle':
          // "Electronics (Basel)." has a stray full stop. "Nat. Commun." is an abbreviation and keeps its own.
          if (/[)\]]\.\s*$/.test(inner)) replaceInner(f, 'journal_period', inner.replace(/\.\s*$/, ''))
          break
        case 'doi':
          if (bareDoi(inner) !== inner) replaceInner(f, 'doi_prefix', bareDoi(inner))
          break
        case 'pages': {
          const m = /^\s*([A-Za-z]?\d+)\s*[-–—]+\s*([A-Za-z]?\d+)\s*$/.exec(inner)
          if (m) replaceInner(f, 'pages_dash', `${m[1]}--${m[2]}`)
          break
        }
        case 'author':
        case 'editor':
          if (/(?:,\s*|\s+)(?:et\.?\s*al\.?|dkk\.?)\s*$/i.test(inner)) {
            replaceInner(f, 'et_al', inner.replace(/(?:,\s*|\s+)(?:et\.?\s*al\.?|dkk\.?)\s*$/i, ' and others'))
          }
          break
        case 'year': {
          const plain = /^\s*(\d{4})\s*[.,;]\s*$/.exec(inner)
          if (plain) {
            replaceInner(f, 'year_period', plain[1] as string)
            break
          }
          const my = monthAndYear(inner)
          if (my !== null && field(e, 'month') === undefined) {
            offered.monthInYear++
            if (options.monthFromYear) {
              const between = source.slice(f.nameStart + f.name.length, f.eqAt)
              const afterEq = source.slice(f.eqAt + 1, f.valueStart)
              const gap = between.length > 1 ? between.slice(1) : between
              const monthText = `month${gap}=${afterEq}${my.month}`
              const eol = eolNear(source, f.valueEnd)
              const indent = source.slice(source.lastIndexOf('\n', f.nameStart - 1) + 1, f.nameStart)
              edits.push({ start: f.innerStart, end: f.innerEnd, text: my.year })
              if (f.ownLine) {
                if (f.commaAt === null) edits.push({ start: f.valueEnd, end: f.valueEnd, text: ',' })
                edits.push({
                  start: f.removeEnd,
                  end: f.removeEnd,
                  text: `${indent}${monthText}${f.commaAt !== null ? ',' : ''}${eol}`,
                })
              } else {
                const at = f.commaAt !== null ? f.commaAt + 1 : f.valueEnd
                edits.push({
                  start: at,
                  end: at,
                  text: f.commaAt !== null ? ` ${monthText},` : `, ${monthText}`,
                })
              }
              fix(f, 'month_from_year', inner, `${my.year}, month = ${my.month}`)
            }
          }
          break
        }
      }
    }

    // A url and a note that only say the DOI again.
    if (doi !== '') {
      const copies: [ScannedField, BibRule][] = []
      const url = field(e, 'url')
      if (url?.inner != null && /^(?:https?:\/\/(?:dx\.)?doi\.org\/)/i.test(url.inner.trim()) && bareDoi(url.inner).toLowerCase() === doi.toLowerCase()) {
        copies.push([url, 'drop_url_copy'])
      }
      const note = field(e, 'note')
      const noteMatch =
        note?.inner != null
          ? /^\s*doi:\s*(?:\\url\{)?\s*https?:\/\/(?:dx\.)?doi\.org\/(10\.[^\s}]+?)\s*\}?\s*$/i.exec(note.inner)
          : null
      if (note !== undefined && noteMatch && (noteMatch[1] as string).toLowerCase() === doi.toLowerCase()) {
        copies.push([note, 'drop_note_copy'])
      }
      if (copies.length > 0) offered.doiCopies++
      if (options.dropDoiCopies) {
        for (const [f, rule] of copies) {
          dropped.add(f)
          edits.push({ start: f.removeStart, end: f.removeEnd, text: '' })
          fix(f, rule, f.inner as string, '')
        }
      }
    }
    // Taking away the last field leaves a comma that no field follows. Remove it with the field.
    const last = e.fields[e.fields.length - 1]
    if (last !== undefined && dropped.has(last)) {
      const kept = [...e.fields].reverse().find((f) => !dropped.has(f))
      if (kept?.commaAt != null && last.commaAt === null) {
        edits.push({ start: kept.commaAt, end: kept.commaAt + 1, text: '' })
      }
    }

    // ----- Flags: what a person should look at. Nothing here changes the file. -----
    const flag = (code: BibFlagCode, detail = '') => flags.push({ key: e.key, code, detail })

    if (e.key === '') flag('no_key')
    else if (firstWithKey.has(e.key)) flag('duplicate_key')
    else firstWithKey.set(e.key, e.key)

    for (const name of ['author', 'editor']) {
      const f = field(e, name)
      const m = f?.inner != null ? /^\{([^{}]*)\}$/.exec(f.inner.trim()) : null
      const text = m?.[1] ?? ''
      // "{{Z. N. Xun Liu}}": double braces make BibTeX print one name, and this is a list of people.
      if (m && /^\p{Lu}\.\s*\p{Lu}\./u.test(text) && !isOrganisationName(text)) flag('author_one_name')
    }

    const title = normalizeText(plainText(field(e, 'title')))
    const doiKey = doi.toLowerCase()
    const twin = (title !== '' ? firstWithTitle.get(title) : undefined) ?? (doiKey !== '' ? firstWithDoi.get(doiKey) : undefined)
    if (twin !== undefined && twin !== e.key) flag('duplicate_work', twin)
    if (title !== '' && !firstWithTitle.has(title)) firstWithTitle.set(title, e.key)
    if (doiKey !== '' && !firstWithDoi.has(doiKey)) firstWithDoi.set(doiKey, e.key)

    if (e.type === 'article') {
      const journal = plainText(field(e, 'journal'))
      if (/arxiv|preprint|biorxiv|medrxiv|ssrn/i.test(journal)) flag('looks_like_preprint', journal)
      else if (
        /proceedings|conference|symposium|workshop|prosiding|konferensi/i.test(journal) &&
        !/proceedings of the national academy/i.test(journal)
      ) {
        flag('looks_like_proceedings', journal)
      }
    }

    if (plainText(field(e, 'number')) === '0') flag('number_zero')

    // A month and a year that have not happened yet.
    const yearField = field(e, 'year')
    const yearText = yearField?.inner ?? yearField?.raw ?? ''
    const my = monthAndYear(yearText)
    const year = my?.year ?? /\b(?:19|20)\d{2}\b/.exec(yearText)?.[0]
    if (year !== undefined) {
      const monthName = my?.month ?? MONTHS[plainText(field(e, 'month')).toLowerCase().replace(/\.$/, '')]
      const monthNo = monthName === undefined ? 0 : MONTH_ORDER.indexOf(monthName) + 1
      const y = Number(year)
      if (y > nowYear || (y === nowYear && monthNo > nowMonth)) {
        flag('future_date', monthNo > 0 ? `${y}-${String(monthNo).padStart(2, '0')}` : String(y))
      }
    }

    const needs = REQUIRED[e.type]
    if (needs !== undefined) {
      const missing = needs.filter((n) => !n.split('|').some((name) => plainText(field(e, name)) !== ''))
      if (missing.length > 0) flag('missing_field', missing.map((n) => n.split('|')[0]).join(', '))
    }
  }

  return {
    text: applyEdits(source, edits),
    entries: entries.length,
    fixes,
    flags,
    offered,
  }
}
