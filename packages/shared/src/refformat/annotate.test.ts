import { describe, expect, it } from 'vitest'
import { annotate } from './annotate.js'
import { plain } from './pieces.js'

describe('annotate', () => {
  it('marks what is new and keeps the italics, in one list of runs', () => {
    const pieces = [{ text: 'Doe, J. (2020). A title. ' }, { text: 'Journal', italic: true }, { text: ', 1(1).' }]
    const runs = annotate(pieces, 'Doe, J. (2020). A title. Journal, 1(1)')
    expect(runs.map((r) => r.text).join('')).toBe(plain(pieces))
    expect(runs.filter((r) => r.italic).map((r) => r.text)).toEqual(['Journal'])
    expect(runs.filter((r) => r.changed).map((r) => r.text)).toEqual(['.'])
  })

  it('marks nothing when the text is already as it should be', () => {
    const pieces = [{ text: 'Doe, J. ' }, { text: 'Journal', italic: true }]
    expect(annotate(pieces, 'Doe, J. Journal').some((r) => r.changed)).toBe(false)
  })

  it('joins neighbouring runs that look the same', () => {
    const runs = annotate([{ text: 'one two three' }], 'one two three')
    expect(runs).toEqual([{ text: 'one two three', italic: false, changed: false }])
  })

  it('splits a changed run where the italics start', () => {
    const runs = annotate([{ text: 'New ' }, { text: 'Journal', italic: true }], '')
    // A space is never marked, so the marked runs stop at the word.
    expect(runs).toEqual([
      { text: 'New', italic: false, changed: true },
      { text: ' ', italic: false, changed: false },
      { text: 'Journal', italic: true, changed: true },
    ])
  })

  it('gives nothing for no pieces', () => {
    expect(annotate([], 'anything')).toEqual([])
  })
})
