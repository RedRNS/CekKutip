import { describe, expect, it } from 'vitest'
import { diffAgainst } from './diff'

const marked = (text: string, other: string | null) =>
  diffAgainst(text, other)
    .filter((s) => s.differs)
    .map((s) => s.text)

describe('diffAgainst', () => {
  it('marks words missing from the other text', () => {
    expect(marked('Nature Communications', 'Scientific Reports')).toEqual([
      'Nature',
      'Communications',
    ])
  })

  it('marks nothing when the texts agree, ignoring case and punctuation', () => {
    expect(marked('Fabrication and errors,', 'fabrication and errors')).toEqual([])
  })

  it('marks only the changed year', () => {
    expect(marked('Walters 2021', 'Walters 2023')).toEqual(['2021'])
  })

  it('ignores diacritics', () => {
    expect(marked('Müller', 'Muller')).toEqual([])
  })

  it('marks nothing when there is nothing to compare against', () => {
    expect(marked('anything', null)).toEqual([])
  })

  it('preserves the original text', () => {
    const joined = diffAgainst('A  b, c', 'a')
      .map((s) => s.text)
      .join('')
    expect(joined).toBe('A  b, c')
  })
})
