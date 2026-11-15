import { normalizeText } from '@cekkutip/shared/normalize'

export interface Segment {
  text: string
  /** True when this word does not appear in the other text. */
  differs: boolean
}

/**
 * Mark the words in `text` that are absent from `other`.
 * Whitespace is preserved so the result can be rendered as-is.
 * Comparison ignores case, punctuation, and diacritics.
 */
export function diffAgainst(text: string, other: string | null): Segment[] {
  if (other === null) return [{ text, differs: false }]
  const known = new Set(
    normalizeText(other)
      .split(' ')
      .filter((w) => w !== ''),
  )
  const parts = text.split(/(\s+)/)
  return parts
    .filter((p) => p !== '')
    .map((p) => {
      if (/^\s+$/.test(p)) return { text: p, differs: false }
      const n = normalizeText(p)
      // A token made only of punctuation never counts as different.
      return { text: p, differs: n !== '' && n.split(' ').some((w) => !known.has(w)) }
    })
}
