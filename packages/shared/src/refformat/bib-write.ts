import { stripDiacritics } from '../normalize.js'
import { formatInitials, isInitials } from './people.js'
import type { JournalArticle, Person } from './types.js'

export interface BibWriteLabels {
  /** The first line of the file, a BibTeX comment. */
  header: string
  /** Above the references that could not be made into entries, a BibTeX comment. */
  kept: string
}

export interface BibWriteItem {
  /** The reference read as a journal article, or null when it could not be. */
  article: JournalArticle | null
  /** The reference as it was written, kept as a comment when there is no article. */
  text: string
}

export interface BibWriteResult {
  text: string
  entries: number
  keys: string[]
  /** References that are in the file only as comments. */
  kept: number
}

/** LaTeX takes these for markup. */
const escapeSpecials = (s: string) => s.replace(/(?<!\\)([&%$#_])/g, '\\$1')

/** Braces that do not pair would make the file unreadable: take them all out. */
function pairedBraces(s: string): string {
  let depth = 0
  for (const c of s) {
    if (c === '{') depth++
    else if (c === '}' && --depth < 0) return s.replace(/[{}]/g, '')
  }
  return depth === 0 ? s : s.replace(/[{}]/g, '')
}

const ACRONYM = /^\p{Lu}{2,}[\p{Lu}\p{N}-]*s?$/u
const MIXED_CASE = /^(?:\p{Ll}+\p{Lu}[\p{L}\p{N}]*|\p{Lu}\p{Ll}+\p{Lu}[\p{L}\p{N}]*)$/u
const AROUND = /^([("'[]*)(.*?)([)"'\].,:;?!]*)$/u

/**
 * Put {} around acronyms and words with a capital inside (LLM, COVID-19, ChatGPT), so that a style that
 * lowers the capitals of a title leaves them as they are. This is what BibTeX users do by hand.
 */
function protectCapitals(title: string): string {
  const letters = title.replace(/[^\p{L}]/gu, '')
  if (letters !== '' && letters === letters.toUpperCase()) return title // a title in capitals: nothing to tell apart
  return title
    .split(' ')
    .map((word) => {
      if (word.includes('{') || word.includes('}')) return word
      const m = AROUND.exec(word)
      const core = m?.[2] ?? ''
      if (m && (ACRONYM.test(core) || MIXED_CASE.test(core))) return `${m[1]}{${core}}${m[3]}`
      return word
    })
    .join(' ')
}

const bibTitle = (title: string) => protectCapitals(pairedBraces(escapeSpecials(title)))
const bibText = (text: string) => pairedBraces(escapeSpecials(text))

function bibAuthor(p: Person): string {
  if (p.org) return `{${p.family}}`
  if (p.given === '') return p.family
  // Initials are written one way ("W. H."), whatever the text had. Full given names are kept as they were.
  const given = isInitials(p.given) ? formatInitials(p.given, true) : p.given
  return `${p.family}, ${given}`
}

function keyBase(a: JournalArticle): string {
  const first = a.authors[0]
  const name = first === undefined ? '' : first.org ? (first.family.split(/\s+/)[0] ?? '') : first.family
  const ascii = stripDiacritics(name).toLowerCase().replace(/[^a-z0-9]/g, '')
  const year = /\d{4}/.exec(a.year)?.[0] ?? 'nd'
  return `${ascii.slice(0, 24) || 'ref'}${year}`
}

/** Letters for keys that would be the same: a, b, c, ... then a1, b1, ... */
const suffix = (n: number) => (n < 26 ? String.fromCharCode(97 + n) : `${String.fromCharCode(97 + (n % 26))}${Math.floor(n / 26)}`)

function entryText(a: JournalArticle, key: string): string {
  const fields: [string, string][] = [
    ['author', `${a.authors.map(bibAuthor).join(' and ')}${a.etAl ? ' and others' : ''}`],
    ['title', bibTitle(a.title)],
    ['journal', bibText(a.journal)],
  ]
  if (a.volume !== null) fields.push(['volume', a.volume])
  if (a.issue !== null) fields.push(['number', a.issue])
  if (a.pages !== null) fields.push(['pages', a.pages.replace(/-+/g, '--')])
  const year = /\d{4}/.exec(a.year)?.[0]
  if (year !== undefined) fields.push(['year', year])
  if (a.doi !== null) fields.push(['doi', a.doi])
  else if (a.url !== null) fields.push(['url', a.url])

  const width = Math.max(...fields.map(([name]) => name.length))
  const lines = fields.map(([name, value], i) => `  ${name.padEnd(width)} = {${value}}${i < fields.length - 1 ? ',' : ''}`)
  return `@article{${key},\n${lines.join('\n')}\n}\n`
}

/**
 * Write the journal articles of a list as a .bib file. Keys are the first author and the year (walters2023),
 * with a letter when two would be the same. A reference that could not be read as a journal article is not
 * dropped: it stays in the file as a comment. Nothing is looked up, and nothing is made up.
 */
export function bibtexFromReferences(
  items: readonly BibWriteItem[],
  labels: BibWriteLabels | null,
): BibWriteResult {
  const articles = items.flatMap((i) => (i.article === null ? [] : [i.article]))
  const bases = articles.map(keyBase)
  const total = new Map<string, number>()
  for (const b of bases) total.set(b, (total.get(b) ?? 0) + 1)
  const seen = new Map<string, number>()
  const keys = bases.map((b) => {
    if ((total.get(b) ?? 0) < 2) return b
    const n = seen.get(b) ?? 0
    seen.set(b, n + 1)
    return `${b}${suffix(n)}`
  })

  const kept = items
    .filter((i) => i.article === null)
    .map((i) => i.text.replace(/\s+/g, ' ').trim())
    .filter((t) => t !== '')

  const parts: string[] = []
  if (labels !== null && (articles.length > 0 || kept.length > 0)) parts.push(`${labels.header}\n`)
  parts.push(...articles.map((a, i) => entryText(a, keys[i] as string)))
  if (kept.length > 0) {
    parts.push(`${labels?.kept ?? '% Not made into entries:'}\n${kept.map((t) => `% ${t}`).join('\n')}\n`)
  }
  return { text: parts.join('\n'), entries: articles.length, keys, kept: kept.length }
}
