import type { Person } from './types.js'

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Words that start a family name and are not part of the given name ("van" in "Ludwig van Beethoven"). */
const PARTICLES = new Set([
  'van',
  'von',
  'de',
  'der',
  'den',
  'di',
  'da',
  'del',
  'la',
  'le',
  'bin',
  'binti',
  'bte',
  'ibn',
  'al',
  'el',
  'ter',
  'ten',
  'du',
])

/** Words that say a name is an organisation. */
const ORG_WORDS =
  /\b(?:organi[sz]ation|association|university|universitas|institute?|institut|kementerian|badan|dinas|pemerintah|departemen|department|ministry|council|committee|komisi|lembaga|yayasan|perusahaan|company|corporation|foundation|society|bank|world|national|nasional|bureau|biro|pusat|center|centre|group|team|unesco|unicef)\b/i

/** "W. H.", "W.H.", "E.I", "J.-P.", "WH", "A". Not "BPS" (an organisation) and not "Agus". */
export function isInitials(s: string): boolean {
  const t = s.trim()
  if (/^\p{Lu}{1,2}$/u.test(t)) return true
  return /^(?:\p{Lu}\.?[\s-]*)+$/u.test(t) && t.includes('.')
}

const isOrg = (s: string): boolean =>
  !isInitials(s) && (ORG_WORDS.test(s) || /^\p{Lu}{3,}$/u.test(s.trim()))

/** Some initials in a given name: "W. H." gives W and H, "Agus" gives A, "Jean-Paul" gives J-P. */
function initialsList(given: string): string[] {
  const out: string[] = []
  for (const word of given.split(/\s+/).filter(Boolean)) {
    if (/^\p{Ll}/u.test(word)) continue // "van" in a given name
    const parts = word.split('-').filter(Boolean)
    const each = parts.map((part) => {
      if (/^(?:\p{Lu}\.)+\p{Lu}?\.?$/u.test(part) || /^\p{Lu}{2,3}$/u.test(part)) {
        return [...part.replace(/\./g, '')]
      }
      return [part.charAt(0).toUpperCase()]
    })
    if (parts.length > 1) out.push(each.map((letters) => letters[0] as string).join('-'))
    else out.push(...(each[0] ?? []))
  }
  return out
}

/** "W. H." (spaced) or "W.H." (compact). A hyphenated name keeps its hyphen: "J.-P.". */
export function formatInitials(given: string, spaced: boolean): string {
  const marks = initialsList(given).map((entry) =>
    entry
      .split('-')
      .map((letter) => `${letter}.`)
      .join('-'),
  )
  return marks.join(spaced ? ' ' : '')
}

interface Natural {
  person: Person
  uncertain: boolean
}

/** A name in plain order: "Agus Wantoro", "W. H. Walters", "Ludwig van Beethoven", "Sugiyono". */
function naturalName(text: string): Natural {
  const t = collapse(text)
  if (isOrg(t)) return { person: { family: t, given: '', org: true }, uncertain: false }
  const words = t.split(' ')
  if (words.length === 1) return { person: { family: t, given: '', org: false }, uncertain: false }

  // The family name and then the initials, with no comma: "Grady J.S.", "Walters WH".
  const lastWord = words[words.length - 1] as string
  if (isInitials(lastWord) && !isInitials(words[0] as string)) {
    return {
      person: { family: words.slice(0, -1).join(' '), given: lastWord, org: false },
      uncertain: false,
    }
  }

  let start = words.length - 1
  while (start > 1 && PARTICLES.has((words[start - 1] as string).toLowerCase())) start--
  const given = words.slice(0, start)
  const family = words.slice(start).join(' ')
  // Two or more full given names, as in many Indonesian names, leave the family name a guess.
  const fullNames = given.filter((w) => !/^\p{Lu}\.?$/u.test(w) && !/^(?:\p{Lu}\.)+$/u.test(w))
  return {
    person: { family, given: given.join(' '), org: false },
    uncertain: fullNames.length >= 2,
  }
}

const startsWithInitials = (s: string): boolean => /^(?:\p{Lu}\.[\s-]*)+\p{L}/u.test(s.trim())

export interface People {
  people: Person[]
  etAl: boolean
  uncertain: boolean
}

const ET_AL = /(?:,\s*|\s+)(?:et\.? al\.?|dkk\.?|dll\.?|dsb\.?|and others|dan lainnya)\s*$/i
const CONNECTOR = /\s*,?\s+(?:&|and|dan)\s+/gi

/**
 * Read the authors of a reference: "Walters, W. H., & Wilder, E. I.", "W. H. Walters and E. I. Wilder",
 * "Wantoro, Agus; Zulkifli", "Agus Wantoro, Zulkifli, and Aviv Fitria Yulia", an organisation, "et al.".
 * When an order cannot be known the family name is the last word, and `uncertain` says so.
 */
export function parsePeople(input: string): People {
  let s = collapse(input).replace(/[,;\s]+$/, '')
  let etAl = false
  if (ET_AL.test(s)) {
    s = s.replace(ET_AL, '')
    etAl = true
  }
  s = s.replace(/[,;\s]+$/, '')
  // The full stop that ends the author part ("Sugiyono.") is not part of a name. Initials keep theirs.
  const lastWord = s.split(/[\s,]+/).pop() ?? ''
  if (lastWord.endsWith('.') && !isInitials(lastWord)) s = s.slice(0, -1)
  if (s === '') return { people: [], etAl, uncertain: false }

  // An organisation such as "Kementerian Pendidikan dan Kebudayaan" is not a list of two.
  if (!s.includes(',') && isOrg(s)) {
    return { people: [{ family: s, given: '', org: true }], etAl, uncertain: false }
  }

  const people: Person[] = []
  let uncertain = false
  const addNatural = (text: string) => {
    const n = naturalName(text)
    people.push(n.person)
    uncertain ||= n.uncertain
  }

  /** "Family, I., Family, I." or "Name, Name, Name": one text with commas between its parts. */
  const fromCommas = (text: string) => {
    const tokens = text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (!tokens.some(isInitials)) {
      for (const token of tokens) addNatural(token)
      return
    }
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i] as string
      const next = tokens[i + 1]
      if (isInitials(token)) continue // initials with no name in front of them
      if (next !== undefined && isInitials(next)) {
        people.push({ family: token, given: next, org: false })
        i++
      } else {
        addNatural(token)
      }
    }
  }

  const explicit = s.includes(';') // the text itself separated the people with semicolons
  const joined = s.replace(CONNECTOR, ';')
  if (joined.includes(';')) {
    for (const piece of joined.split(';').map((p) => p.trim())) {
      if (piece === '') continue
      const commas = piece.split(',').length - 1
      if (commas === 0) addNatural(piece)
      else if (commas === 1 && !startsWithInitials(piece)) {
        const [family = '', given = ''] = piece.split(',').map((p) => p.trim())
        // "Walters, William H." and "Walters, W. H." are a family name and given names. "Agus Wantoro,
        // Zulkifli" before an "and" is two people. A family name is one word, unless the text says otherwise.
        if (explicit || isInitials(given) || family.split(' ').length === 1) {
          people.push({ family, given, org: false })
        } else fromCommas(piece)
      } else fromCommas(piece)
    }
  } else {
    fromCommas(joined)
  }
  return { people, etAl, uncertain }
}
