export interface Mark {
  text: string
  /** This part is not in the text it is compared with. Spaces are never marked. */
  changed: boolean
}

interface Token {
  /** The text before the token (spaces). */
  space: string
  text: string
}

const TOKEN = /(\s*)(\p{L}[\p{L}\p{N}'’]*|\p{N}+|[^\s\p{L}\p{N}])/gu

function tokenize(s: string): { tokens: Token[]; tail: string } {
  const tokens: Token[] = []
  let last = 0
  for (const m of s.matchAll(TOKEN)) {
    tokens.push({ space: m[1] as string, text: m[2] as string })
    last = (m.index ?? 0) + m[0].length
  }
  return { tokens, tail: s.slice(last) }
}

/** A space before a token counts: "W.H." and "W. H." are different. */
const key = (t: Token) => (t.space === '' ? t.text : ` ${t.text}`)

/** More cells than this and the comparison is skipped: everything is marked. */
const MAX_CELLS = 4_000_000

/**
 * Compare `after` with `before` word by word and punctuation mark by punctuation mark, and mark the
 * parts of `after` that are not in `before`. Joining the texts of the result gives `after` back.
 */
export function markChanges(before: string, after: string): Mark[] {
  const a = tokenize(before).tokens.map(key)
  const { tokens: b, tail } = tokenize(after)
  const bKeys = b.map(key)
  const n = a.length
  const m = bKeys.length

  const kept = new Array<boolean>(m).fill(false)
  if (n * m <= MAX_CELLS) {
    // The longest common run of tokens, in order. The tokens of `after` in it are unchanged.
    const table = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i]![j] =
          a[i] === bKeys[j]
            ? (table[i + 1]![j + 1] as number) + 1
            : Math.max(table[i + 1]![j] as number, table[i]![j + 1] as number)
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (a[i] === bKeys[j]) {
        kept[j] = true
        i++
        j++
      } else if ((table[i + 1]![j] as number) >= (table[i]![j + 1] as number)) i++
      else j++
    }
  }

  const marks: Mark[] = []
  b.forEach((token, j) => {
    if (token.space !== '') marks.push({ text: token.space, changed: false })
    marks.push({ text: token.text, changed: !kept[j] })
  })
  if (tail !== '') marks.push({ text: tail, changed: false })
  return marks
}
