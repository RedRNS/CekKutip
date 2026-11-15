import { describe, expect, it } from 'vitest'
import { normalizeText, stripDiacritics, tokenize } from './normalize.js'

describe('normalizeText', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeText('  Fabrication   AND  Errors ')).toBe('fabrication and errors')
  })

  it('removes diacritics and folds non-decomposing letters', () => {
    expect(stripDiacritics('Müller Łukasz Søren')).toBe('Muller Lukasz Soren')
    expect(normalizeText('Kaiser, Łukasz')).toBe('kaiser lukasz')
  })

  it('removes punctuation, keeping word boundaries', () => {
    expect(normalizeText('Attention: is all-you need?')).toBe('attention is all you need')
  })

  it('drops apostrophes without splitting the name', () => {
    expect(normalizeText("O'Brien")).toBe('obrien')
    expect(normalizeText('O’Brien')).toBe('obrien')
  })

  it('normalizes Unicode compatibility forms', () => {
    expect(normalizeText('ﬁnding')).toBe('finding')
    expect(normalizeText('Café')).toBe('cafe')
  })

  it('keeps non-Latin letters and digits', () => {
    expect(normalizeText('深度学习 2021')).toBe('深度学习 2021')
  })

  it('returns an empty string for punctuation only', () => {
    expect(normalizeText('...!')).toBe('')
    expect(tokenize('...!')).toEqual([])
  })
})

describe('tokenize', () => {
  it('returns normalized tokens', () => {
    expect(tokenize('Nature Communications')).toEqual(['nature', 'communications'])
  })
})
