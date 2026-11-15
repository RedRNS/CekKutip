import { describe, expect, it } from 'vitest'
import { levenshtein, similarity, titleSimilarity } from '../src/lib/similarity.js'

describe('levenshtein', () => {
  it.each([
    ['', '', 0],
    ['abc', '', 3],
    ['', 'abc', 3],
    ['kitten', 'sitting', 3],
    ['flaw', 'lawn', 2],
    ['same', 'same', 0],
  ])('distance(%j, %j) = %i', (a, b, d) => {
    expect(levenshtein(a, b)).toBe(d)
  })

  it('is symmetric', () => {
    expect(levenshtein('saturday', 'sunday')).toBe(levenshtein('sunday', 'saturday'))
  })
})

describe('similarity', () => {
  it('is 1 for identical text, ignoring case, punctuation, diacritics, and spacing', () => {
    expect(similarity('Attention Is All You Need', 'attention is all you need')).toBe(1)
    expect(similarity('Müller: a study.', 'muller a  study')).toBe(1)
  })

  it('is 0 when there is nothing to compare', () => {
    expect(similarity('', '')).toBe(0)
    expect(similarity('...', '!!!')).toBe(0)
    expect(similarity('abc', '')).toBe(0)
  })

  it('drops for different titles', () => {
    expect(
      similarity(
        'Fabrication and errors in citations',
        'Deep residual learning for image recognition',
      ),
    ).toBeLessThan(0.4)
  })

  it('stays high for a small typo', () => {
    expect(
      similarity(
        'Fabrication and errors in the bibliographic citations',
        'Fabrication and errors in the bibliographic citation',
      ),
    ).toBeGreaterThan(0.95)
  })
})

describe('titleSimilarity', () => {
  it('compares against the main title when the citation omits the subtitle', () => {
    const cited = 'Attention is all you need'
    const record = 'Attention is all you need: a longer subtitle appears here'
    expect(similarity(cited, record)).toBeLessThan(0.6)
    expect(titleSimilarity(cited, record)).toBe(1)
  })

  it('does not apply the shortcut when the citation has its own colon', () => {
    const cited = 'Attention is all you need: wrong subtitle'
    const record = 'Attention is all you need: a longer subtitle appears here'
    expect(titleSimilarity(cited, record)).toBe(similarity(cited, record))
  })

  it('does not inflate the score for unrelated titles', () => {
    expect(
      titleSimilarity('Pengaruh media sosial', 'Deep learning: a review of methods'),
    ).toBeLessThan(0.4)
  })

  it('equals plain similarity when the record has no subtitle', () => {
    expect(titleSimilarity('Fabrication and errors', 'Fabrication and error')).toBe(
      similarity('Fabrication and errors', 'Fabrication and error'),
    )
  })
})
