/** Letters of a word, without the punctuation around it. */
const lettersOf = (w: string) => w.replace(/[^\p{L}]/gu, '')

const isAllCapsTitle = (words: string[]): boolean => {
  const letters = words.map(lettersOf).join('')
  return words.length >= 3 && letters.length >= 6 && letters === letters.toUpperCase()
}

/** A word whose capitals carry meaning: an acronym, a mixed-case name, or one with a digit. */
function isProtected(word: string, isLast: boolean): boolean {
  if (/\d/.test(word)) return true
  if (/\p{Ll}\p{Lu}/u.test(word)) return true // YouTube, iPhone, ChatGPT
  const letters = lettersOf(word)
  if (letters.length >= 2 && letters === letters.toUpperCase()) return true // (ML), WHO
  if (letters.length === 1 && letters === letters.toUpperCase()) {
    return letters === 'I' || letters !== 'A' || isLast // a single capital: D, I; "A" only at the end
  }
  return false
}

const endsSentence = (w: string) => /[:?!]$/.test(w)

const capitalise = (word: string) =>
  word.replace(/\p{L}/u, (letter) => letter.toUpperCase())

/**
 * Sentence case: a capital for the first word, the first word after ":" "?" "!", acronyms, mixed-case words
 * and words with digits. Every other word goes to lower case. Names of people and places cannot be told
 * from other words, so they are lowered too, and the person is asked to check them.
 */
export function toSentenceCase(title: string): string {
  const words = title.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const allCaps = isAllCapsTitle(words)
  let capitalNext = true

  const out = words.map((word, i) => {
    const isLast = i === words.length - 1
    let result: string
    if (!allCaps && isProtected(word, isLast)) {
      result = word
    } else {
      // Hyphenated parts after the first follow the same rule: "Self-Regulated" becomes "Self-regulated".
      result = word
        .split('-')
        .map((part, k) =>
          k > 0 && !allCaps && isProtected(part, false) ? part : part.toLowerCase(),
        )
        .join('-')
    }
    if (capitalNext) result = capitalise(result)
    capitalNext = endsSentence(word)
    return result
  })
  return out.join(' ')
}

/**
 * Whether a title is written with a capital on nearly every word (Title Case), or all in capitals.
 * Too few words, or a title with only a few longer words, gives too little to go on.
 */
export function looksLikeTitleCase(title: string): boolean {
  const words = title.split(/\s+/).filter(Boolean)
  if (isAllCapsTitle(words)) return true
  const candidates: boolean[] = []
  words.forEach((word, i) => {
    if (i === 0 || endsSentence(words[i - 1] as string)) return
    if (lettersOf(word).length < 4) return
    if (isProtected(word, false)) return
    candidates.push(/^\W*\p{Lu}/u.test(word))
  })
  if (candidates.length < 3) return false
  return candidates.filter(Boolean).length / candidates.length >= 0.7
}
