import { describe, expect, it } from 'vitest'
import { cleanedFileName } from './download'

describe('cleanedFileName', () => {
  it.each([
    ['references.bib', 'references.clean.bib'],
    ['references (1).bib', 'references (1).clean.bib'],
    ['REFS.BIB', 'REFS.clean.bib'],
    ['my.refs.bib', 'my.refs.clean.bib'],
    ['noextension', 'noextension.clean.bib'],
    ['a.clean.bib', 'a.clean.bib'],
  ])('%s becomes %s, so the original is never overwritten', (name, expected) => {
    expect(cleanedFileName(name)).toBe(expected)
  })
})
