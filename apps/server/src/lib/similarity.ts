import { normalizeText } from './normalize.js'

/** Classic Levenshtein distance (insert, delete, substitute), two-row implementation. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        (prev[j] as number) + 1,
        (curr[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      )
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length] as number
}

/** 1 minus normalized Levenshtein distance, after text normalization. Range 0..1. */
export function similarity(a: string, b: string): number {
  const x = normalizeText(a)
  const y = normalizeText(b)
  if (x === '' && y === '') return 0 // nothing to compare is not a match
  const longest = Math.max(x.length, y.length)
  return 1 - levenshtein(x, y) / longest
}

/** The part of a title before its first colon, or null when there is no subtitle. */
function mainTitle(title: string): string | null {
  const i = title.indexOf(':')
  if (i <= 0) return null
  const head = title.slice(0, i).trim()
  return head === '' ? null : head
}

/**
 * Title score between a cited title and a candidate record title.
 * When the citation has no subtitle but the candidate does, the citation is also compared with
 * the candidate's main title, and the higher score wins (brief section 6.4).
 */
export function titleSimilarity(cited: string, candidate: string): number {
  const full = similarity(cited, candidate)
  if (cited.includes(':')) return full
  const head = mainTitle(candidate)
  return head === null ? full : Math.max(full, similarity(cited, head))
}
