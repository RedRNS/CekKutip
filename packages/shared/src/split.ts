/**
 * Deterministic reference splitter. No model involved.
 * Shared so the browser's "N found" count always equals what the server will check.
 *
 * Rules (brief section 6.1):
 * 1. Split on blank lines.
 * 2. With no blank lines, split at list numbers ("1.", "[1]", "(1)") or at lines that start with an
 *    author pattern ("Surname, I.") when the previous line already ended in a period, URL, or DOI.
 * 3. Join continuation lines (hanging indent, wrapped lines) onto the previous reference.
 * 4. Strip list numbers, collapse whitespace, remove invisible characters, normalize to NFC.
 */

// Format and zero-width characters that pasted text often carries (soft hyphen, ZWSP, bidi marks, BOM).
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g

const NUMBERED_LINE = /^\s*(?:\[\d{1,3}\]\s*|\(\d{1,3}\)\s*|\d{1,3}[.)]\s+)\S/
const NUMBER_PREFIX = /^\s*(?:\[\d{1,3}\]|\(\d{1,3}\)|\d{1,3}[.)])\s*/
const BULLET_PREFIX = /^\s*[-•*–]\s+/

const NAME = String.raw`\p{Lu}[\p{L}'’\-]+`
/** "Walters, W." or "van der Berg, J." : surname (with optional particles), comma, initial. */
const AUTHOR_START = new RegExp(
  String.raw`^(?:\p{Ll}{1,4}\s+){0,2}${NAME}(?:\s+${NAME}){0,2},\s*\p{Lu}\.`,
  'u',
)
/** "Kementerian Kesehatan RI. (2020)." : corporate author followed by a parenthesised year. */
const YEAR_START = /^[^()]{2,150}?\(\s*(?:1[4-9]|20)\d{2}[a-z]?\s*[,)]/

const LAST_TOKEN_IS_LINK = /(?:^|\s)(?:https?:\/\/|doi:|10\.\d{4,9}\/)\S*$/i

function endsReference(s: string): boolean {
  const t = s.trimEnd()
  return t.endsWith('.') || LAST_TOKEN_IS_LINK.test(t)
}

function indentOf(line: string): number {
  const m = /^[ \t]*/.exec(line)
  return m ? m[0].replaceAll('\t', '    ').length : 0
}

function clean(raw: string): string {
  return raw
    .replace(BULLET_PREFIX, '')
    .replace(NUMBER_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC')
}

/** Split one block of consecutive lines (no blank lines) into references. */
function splitLines(lines: string[]): string[] {
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  if (nonEmpty.length === 0) return []
  const first = nonEmpty[0] as string
  const numberedMode = NUMBERED_LINE.test(first)
  const baseIndent = Math.min(...nonEmpty.map(indentOf))

  const refs: string[][] = []
  for (const line of nonEmpty) {
    const cur = refs[refs.length - 1]
    if (!cur) {
      refs.push([line])
      continue
    }
    const trimmed = line.trim()
    const hanging = indentOf(line) > baseIndent
    let startsNew: boolean
    if (numberedMode) {
      startsNew = NUMBERED_LINE.test(line)
    } else {
      const prev = cur.join(' ')
      startsNew =
        !hanging && endsReference(prev) && (AUTHOR_START.test(trimmed) || YEAR_START.test(trimmed))
    }
    if (startsNew) refs.push([line])
    else cur.push(line)
  }
  return refs.map((r) => r.join(' '))
}

export function splitReferences(text: string): string[] {
  const normalized = text
    .replace(INVISIBLE, '')
    .replace(/\r\n?/g, '\n')
    .replaceAll('\u00A0', ' ')
    .normalize('NFC')

  const out: string[] = []
  if (/\n[ \t]*\n/.test(normalized)) {
    for (const block of normalized.split(/\n(?:[ \t]*\n)+/)) {
      const lines = block.split('\n').filter((l) => l.trim() !== '')
      const numbered = lines.filter((l) => NUMBERED_LINE.test(l)).length
      // A block holding several numbered lines is a list, not one wrapped reference.
      if (numbered >= 2) out.push(...splitLines(lines))
      else if (lines.length > 0) out.push(lines.join(' '))
    }
  } else {
    out.push(...splitLines(normalized.split('\n')))
  }
  return out.map(clean).filter((r) => r !== '')
}

export type LimitError =
  | { error: 'too_many_references'; limit: number; found: number }
  | { error: 'reference_too_long'; limit: number; index: number; length: number }

export interface Limits {
  maxReferences: number
  maxReferenceChars: number
}

/** Never truncates silently: returns the first problem, or null when the list is acceptable. */
export function checkLimits(refs: string[], limits: Limits): LimitError | null {
  if (refs.length > limits.maxReferences) {
    return { error: 'too_many_references', limit: limits.maxReferences, found: refs.length }
  }
  const i = refs.findIndex((r) => r.length > limits.maxReferenceChars)
  if (i >= 0) {
    return {
      error: 'reference_too_long',
      limit: limits.maxReferenceChars,
      index: i,
      length: (refs[i] as string).length,
    }
  }
  return null
}
