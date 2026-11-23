/**
 * Deterministic APA 7 formatting. No model involved.
 *
 * `apaReference` writes a reference from the metadata of the record that was found. It adds nothing
 * the record does not hold. Two things plain text cannot do, and the person must finish by hand:
 * italics (journal name and volume) and sentence case for article titles. The title is written as
 * the record gives it.
 */
import type { MatchedRecord } from './index.js'

const EN_DASH = String.fromCharCode(0x2013)

/** End a sentence part with a full stop unless it already ends with one (or ? or !). */
export const withStop = (s: string): string => (/[.?!]$/.test(s) ? s : `${s}.`)

/** "Jean-Pierre Marie" gives "J.-P. M."; "J.R." gives "J. R."; "" gives "". */
export function initialsOf(given: string): string {
  const out: string[] = []
  for (const token of given.split(/\s+/).filter(Boolean)) {
    const pieces = token
      .split('-')
      .map((p) => {
        const letters = p.match(/\p{L}/gu)
        if (letters === null) return ''
        // "J.R." is two initials; "Ana" is one.
        return /^(?:\p{L}\.)+$/u.test(p) ? letters.map((l) => `${l}.`).join(' ') : `${letters[0]}.`
      })
      .filter(Boolean)
    if (pieces.length > 0) out.push(pieces.join('-'))
  }
  return out.join(' ')
}

/**
 * APA 7 author list from names that are already written ("Walters, W. H."): up to 20 names with "&"
 * before the last; 21 or more give the first 19, ". . .", and the last. `etAl` writes "et al.".
 */
export function joinApaAuthors(names: string[], etAl = false): string {
  if (names.length === 0) return ''
  if (etAl) return `${names.join(', ')}, et al.`
  if (names.length === 1) return names[0] as string
  if (names.length > 20) return `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`
}

/**
 * One author as "Family, I. I." from the record's family name and full display name.
 * A name with no separable given name (an organisation, a single name) is written as it is.
 */
export function apaName(full: string | undefined, family: string): string {
  const f = family.trim()
  const name = (full ?? '').trim()
  if (name === '' || f === '' || name === f || !name.endsWith(f)) return f || name
  const given = name.slice(0, name.length - f.length).trim()
  if (given === '') return f
  // Lower-case particles that end up on the given-name side ("Ludwig van") belong to the family name.
  const tokens = given.split(/\s+/)
  let familyOut = f
  while (tokens.length > 1 && /^\p{Ll}/u.test(tokens[tokens.length - 1] as string)) {
    familyOut = `${tokens.pop() as string} ${familyOut}`
  }
  const initials = initialsOf(tokens.join(' '))
  return initials === '' ? familyOut : `${familyOut}, ${initials}`
}

/** Journal-article style reference, written from the record. Works for any record that has a title. */
export function apaReference(record: MatchedRecord): string {
  const names = record.authors.map((family, i) => apaName(record.authorsFull?.[i], family))
  const authors = joinApaAuthors(names)
  const date = record.year !== null ? `(${record.year}).` : '(n.d.).'

  const volume = record.volume ?? ''
  const issue = record.issue ? `(${record.issue})` : ''
  const volIssue = `${volume}${issue}`
  const pages = record.pages ? record.pages.replace(/(\d)\s*-\s*(\d)/, `$1${EN_DASH}$2`) : ''
  const source = [record.venue ?? '', volIssue, pages].filter(Boolean).join(', ')
  // A DOI, or else the record's own address. Garuda only indexes journals and does not publish the
  // article, so a Garuda page is never the link of a reference.
  const link = record.doi
    ? `https://doi.org/${record.doi}`
    : record.source === 'garuda'
      ? ''
      : (record.url ?? '')

  // With no author, the title comes first and the date follows it.
  const head =
    authors === ''
      ? [withStop(record.title), date]
      : [withStop(authors), date, withStop(record.title)]
  return [...head, source === '' ? '' : withStop(source), link]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
