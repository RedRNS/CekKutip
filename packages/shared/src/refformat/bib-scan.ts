import { readBraced, readQuoted } from '../bibtex.js'

/**
 * Where everything is in the text of a .bib file. `parseBibtex` gives values; this gives positions, so a
 * fix can be made in the text itself and everything else (comments, order, spacing, line endings) stays.
 */
export interface ScannedField {
  /** Lower case. */
  name: string
  nameStart: number
  /** The "=" sign. */
  eqAt: number
  valueStart: number
  /** After the last character of the value, before any comma. */
  valueEnd: number
  /** The value as written, braces and all. */
  raw: string
  /** The text inside the braces or quotes when the whole value is one group; otherwise null. */
  inner: string | null
  innerStart: number
  innerEnd: number
  /** The comma that ends the field, or null for the last field without one. */
  commaAt: number | null
  /** The whole field to cut out: its line if it has the line to itself, with its comma and line break. */
  removeStart: number
  removeEnd: number
  /** True when nothing else is on the field's line. */
  ownLine: boolean
}

export interface ScannedEntry {
  /** Lower case: article, inproceedings, ... */
  type: string
  key: string
  start: number
  end: number
  fields: ScannedField[]
}

const WORD = /[A-Za-z0-9_\-:.+/]/
const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c)

/** Skip a @comment, @preamble, or @string body. Returns the index after it, or null when it is not closed. */
function skipBody(text: string, open: number): number | null {
  if (text[open] === '{') return readBraced(text, open)?.end ?? null
  const close = text.indexOf(')', open)
  return close < 0 ? null : close + 1
}

/** The field's line and what to cut to remove it. */
function removalRange(src: string, nameStart: number, valueEnd: number, commaAt: number | null) {
  const lineBegin = src.lastIndexOf('\n', nameStart - 1) + 1
  const ownLineStart = /^[ \t]*$/.test(src.slice(lineBegin, nameStart))
  const afterField = commaAt !== null ? commaAt + 1 : valueEnd
  const lineEnd = /^[ \t]*(\r?\n)/.exec(src.slice(afterField))
  const ownLine = ownLineStart && lineEnd !== null
  return {
    ownLine,
    removeStart: ownLine ? lineBegin : nameStart,
    removeEnd: ownLine ? afterField + (lineEnd as RegExpExecArray)[0].length : afterField,
  }
}

/**
 * Find every entry of a .bib text, with the position of every field. An entry that cannot be read (a brace
 * that never closes) is skipped, and the next one is still found. Nothing here changes the text.
 */
export function scanBibtex(src: string): ScannedEntry[] {
  const entries: ScannedEntry[] = []
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
    if (type === 'comment' || type === 'preamble' || type === 'string') {
      pos = skipBody(src, i) ?? at + 1
      continue
    }

    const closeChar = open === '{' ? '}' : ')'
    const bodyStart = i + 1
    const comma = src.indexOf(',', bodyStart)
    const closeIdx = src.indexOf(closeChar, bodyStart)
    if (comma < 0 || (closeIdx >= 0 && closeIdx < comma)) {
      pos = at + 1 // an entry with a key and no fields
      continue
    }
    const key = src.slice(bodyStart, comma).trim()

    const fields: ScannedField[] = []
    let k = comma + 1
    let end = -1
    for (;;) {
      while (isSpace(src[k]) || src[k] === ',') k++
      if (src[k] === closeChar) {
        end = k + 1
        break
      }
      const nameStart = k
      while (k < src.length && WORD.test(src[k] as string)) k++
      if (k === nameStart) break // an unexpected character: give up on this entry
      const name = src.slice(nameStart, k).toLowerCase()
      while (isSpace(src[k])) k++
      if (src[k] !== '=') break
      const eqAt = k
      k++
      while (isSpace(src[k])) k++
      const valueStart = k

      // The value: parts joined with "#", each a {group}, a "string", or a bare word or number.
      let parts = 0
      let valueEnd = k
      let innerFrom = -1
      let innerTo = -1
      let failed = false
      for (;;) {
        while (isSpace(src[k])) k++
        const c = src[k]
        let partEnd: number
        if (c === '{') {
          const g = readBraced(src, k)
          if (g === null) {
            failed = true
            break
          }
          innerFrom = k + 1
          innerTo = g.end - 1
          partEnd = g.end
        } else if (c === '"') {
          const q = readQuoted(src, k)
          if (q === null) {
            failed = true
            break
          }
          innerFrom = k + 1
          innerTo = q.end - 1
          partEnd = q.end
        } else {
          let w = k
          while (w < src.length && WORD.test(src[w] as string)) w++
          if (w === k) {
            failed = true
            break
          }
          partEnd = w
        }
        parts++
        valueEnd = partEnd
        k = partEnd
        while (isSpace(src[k])) k++
        if (src[k] === '#') {
          k++
          continue
        }
        break
      }
      if (failed) break

      const braced = parts === 1 && (src[valueStart] === '{' || src[valueStart] === '"')
      let commaAt: number | null = null
      if (src[k] === ',') {
        commaAt = k
        k++
      }
      const removal = removalRange(src, nameStart, valueEnd, commaAt)
      fields.push({
        name,
        nameStart,
        eqAt,
        valueStart,
        valueEnd,
        raw: src.slice(valueStart, valueEnd),
        inner: braced ? src.slice(innerFrom, innerTo) : null,
        innerStart: braced ? innerFrom : -1,
        innerEnd: braced ? innerTo : -1,
        commaAt,
        ...removal,
      })
    }

    if (end < 0) {
      pos = at + 1 // not closed: leave this entry alone, and look for the next one
      continue
    }
    entries.push({ type, key, start: at, end, fields })
    pos = end
  }
  return entries
}
