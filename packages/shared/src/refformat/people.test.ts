import { describe, expect, it } from 'vitest'
import { formatInitials, parsePeople } from './people.js'

const names = (text: string) => parsePeople(text).people.map((p) => [p.family, p.given])

describe('parsePeople: family name first', () => {
  it('reads "Family, I. I., & Family, I. I."', () => {
    expect(parsePeople('Walters, W. H., & Wilder, E. I.')).toMatchObject({
      people: [
        { family: 'Walters', given: 'W. H.', org: false },
        { family: 'Wilder', given: 'E. I.', org: false },
      ],
      etAl: false,
      uncertain: false,
    })
  })

  it('reads initials written without spaces, and "and" instead of "&"', () => {
    expect(names('Walters, W.H. and Wilder, E.I')).toEqual([
      ['Walters', 'W.H.'],
      ['Wilder', 'E.I'],
    ])
    expect(names('Walters, W.H. & Wilder, E.I.')).toEqual([
      ['Walters', 'W.H.'],
      ['Wilder', 'E.I.'],
    ])
  })

  it('reads a long list, with and without the last "&"', () => {
    const expected = [
      ['Grady', 'J. S.'],
      ['Her', 'M.'],
      ['Moreno', 'G.'],
      ['Perez', 'C.'],
      ['Yelinek', 'J.'],
    ]
    expect(names('Grady, J. S., Her, M., Moreno, G., Perez, C., & Yelinek, J.')).toEqual(expected)
    expect(names('Grady, J. S., Her, M., Moreno, G., Perez, C. and Yelinek, J.')).toEqual(expected)
  })

  it('reads full given names when each person is separated by a semicolon', () => {
    expect(names('Wantoro, Agus; Zulkifli; Fitria Yulia, Aviv')).toEqual([
      ['Wantoro', 'Agus'],
      ['Zulkifli', ''],
      ['Fitria Yulia', 'Aviv'],
    ])
  })

  it('reads full given names before an "&"', () => {
    expect(names('Walters, William H., & Wilder, Esther I.')).toEqual([
      ['Walters', 'William H.'],
      ['Wilder', 'Esther I.'],
    ])
  })

  it('keeps a family name that has a particle', () => {
    expect(names('van der Berg, J.')).toEqual([['van der Berg', 'J.']])
  })

  it('reads a one-word name next to an author with initials (common for Indonesian names)', () => {
    expect(names('Putra, I. G. N. A., & Sugiyono')).toEqual([
      ['Putra', 'I. G. N. A.'],
      ['Sugiyono', ''],
    ])
  })
})

describe('parsePeople: given name first', () => {
  it('reads "I. I. Family and I. I. Family" (IEEE style)', () => {
    expect(names('W. H. Walters and E. I. Wilder')).toEqual([
      ['Walters', 'W. H.'],
      ['Wilder', 'E. I.'],
    ])
  })

  it('reads a comma list of such names, with ", and" before the last', () => {
    expect(names('J. S. Grady, M. Her, G. Moreno, C. Perez, and J. Yelinek')).toEqual([
      ['Grady', 'J. S.'],
      ['Her', 'M.'],
      ['Moreno', 'G.'],
      ['Perez', 'C.'],
      ['Yelinek', 'J.'],
    ])
  })

  it('reads full names in plain order, and takes the last word as the family name', () => {
    expect(names('Agus Wantoro and Zulkifli')).toEqual([
      ['Wantoro', 'Agus'],
      ['Zulkifli', ''],
    ])
    expect(names('Ludwig van Beethoven')).toEqual([['van Beethoven', 'Ludwig']])
    expect(names('Jean-Paul Sartre')).toEqual([['Sartre', 'Jean-Paul']])
  })

  it('says when the order of a name cannot be known (three words, no initials)', () => {
    const r = parsePeople('Agus Wantoro, Zulkifli, and Aviv Fitria Yulia')
    expect(r.people.map((p) => [p.family, p.given])).toEqual([
      ['Wantoro', 'Agus'],
      ['Zulkifli', ''],
      ['Yulia', 'Aviv Fitria'],
    ])
    expect(r.uncertain).toBe(true)
  })

  it('is not unsure about a name with initials or a name of one or two words', () => {
    expect(parsePeople('W. H. Walters and E. I. Wilder').uncertain).toBe(false)
    expect(parsePeople('Agus Wantoro').uncertain).toBe(false)
    expect(parsePeople('Walters, W. H.').uncertain).toBe(false)
  })
})

describe('parsePeople: family name, then initials, with no comma', () => {
  it('reads "Grady J.S., Her M." and "Walters WH"', () => {
    expect(names('Grady J.S., Her M., Moreno G.')).toEqual([
      ['Grady', 'J.S.'],
      ['Her', 'M.'],
      ['Moreno', 'G.'],
    ])
    expect(names('Walters WH and Wilder EI')).toEqual([
      ['Walters', 'WH'],
      ['Wilder', 'EI'],
    ])
  })

  it('keeps a family name of two words', () => {
    expect(names('Mahardika Pratama I.G.A., Astuti L.G.')).toEqual([
      ['Mahardika Pratama', 'I.G.A.'],
      ['Astuti', 'L.G.'],
    ])
  })

  it('does not take initials in front of the name for this form', () => {
    expect(names('W. H. Walters')).toEqual([['Walters', 'W. H.']])
  })
})

describe('parsePeople: one-word names, organisations, and "et al."', () => {
  it('keeps a one-word name as a family name only', () => {
    expect(names('Sugiyono')).toEqual([['Sugiyono', '']])
  })

  it('reads an organisation as one name that is not split', () => {
    expect(parsePeople('World Health Organization').people).toEqual([
      { family: 'World Health Organization', given: '', org: true },
    ])
    expect(parsePeople('Badan Pusat Statistik').people[0]?.org).toBe(true)
    expect(parsePeople('BPS').people[0]?.org).toBe(true)
    expect(parsePeople('Kementerian Pendidikan dan Kebudayaan').people).toHaveLength(1)
  })

  it.each(['et al.', 'et al', 'dkk.', 'dkk', 'dll.', 'and others'])('notes "%s"', (marker) => {
    const r = parsePeople(`Wantoro, A., ${marker}`)
    expect(r.etAl).toBe(true)
    expect(r.people.map((p) => [p.family, p.given])).toEqual([['Wantoro', 'A.']])
  })

  it('reads "A. Wantoro et al." in plain order', () => {
    const r = parsePeople('A. Wantoro et al.')
    expect(r.etAl).toBe(true)
    expect(r.people.map((p) => [p.family, p.given])).toEqual([['Wantoro', 'A.']])
  })

  it('gives no one for an empty text', () => {
    expect(parsePeople('  ')).toEqual({ people: [], etAl: false, uncertain: false })
  })
})

describe('formatInitials', () => {
  it.each([
    ['W. H.', 'W. H.', 'W.H.'],
    ['W.H.', 'W. H.', 'W.H.'],
    ['E.I', 'E. I.', 'E.I.'],
    ['Agus', 'A.', 'A.'],
    ['Putri Renisa', 'P. R.', 'P.R.'],
    ['Aviv Fitria', 'A. F.', 'A.F.'],
    ['I. G. N. A.', 'I. G. N. A.', 'I.G.N.A.'],
    ['Jean-Paul', 'J.-P.', 'J.-P.'],
    ['Ludwig van', 'L.', 'L.'],
    ['', '', ''],
  ])('%j', (given, spaced, compact) => {
    expect(formatInitials(given, true)).toBe(spaced)
    expect(formatInitials(given, false)).toBe(compact)
  })
})
