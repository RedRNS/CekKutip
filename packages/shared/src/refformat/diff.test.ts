import { describe, expect, it } from 'vitest'
import { markChanges } from './diff.js'

const joined = (marks: { text: string }[]) => marks.map((m) => m.text).join('')
const changed = (marks: { text: string; changed: boolean }[]) =>
  marks.filter((m) => m.changed).map((m) => m.text)

describe('markChanges', () => {
  it('marks nothing when the text is the same', () => {
    const marks = markChanges('Walters, W. H.', 'Walters, W. H.')
    expect(joined(marks)).toBe('Walters, W. H.')
    expect(changed(marks)).toEqual([])
  })

  it('marks a full stop that was added', () => {
    const marks = markChanges('(2023)', '(2023).')
    expect(joined(marks)).toBe('(2023).')
    expect(changed(marks)).toEqual(['.'])
  })

  it('marks a space that was added between initials, and the commas around "&"', () => {
    const marks = markChanges('Walters, W.H. & Wilder, E.I', 'Walters, W. H., & Wilder, E. I.')
    expect(joined(marks)).toBe('Walters, W. H., & Wilder, E. I.')
    const marked = changed(marks)
    expect(marked.length).toBeGreaterThan(0)
    expect(marked).not.toContain('Walters')
    expect(marked).not.toContain('Wilder')
  })

  it('marks a replaced prefix and leaves the identifier alone', () => {
    const marks = markChanges('doi:10.1038/s41598', 'https://doi.org/10.1038/s41598')
    expect(joined(marks)).toBe('https://doi.org/10.1038/s41598')
    expect(changed(marks).join('')).not.toContain('s41598')
  })

  it('marks everything when nothing was there', () => {
    const marks = markChanges('', 'Article 14045.')
    expect(changed(marks).join('')).toContain('Article')
    expect(joined(marks)).toBe('Article 14045.')
  })

  it('does not hang on long text', () => {
    const long = 'word '.repeat(400)
    expect(joined(markChanges(long, `${long}extra`))).toBe(`${long}extra`)
  })
})
