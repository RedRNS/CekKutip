import { describe, expect, it } from 'vitest'
import { extractDoi, normalizeDoi } from './doi.js'

describe('normalizeDoi', () => {
  it.each([
    ['10.1038/s41598-023-41032-5', '10.1038/s41598-023-41032-5'],
    ['https://doi.org/10.1038/s41598-023-41032-5', '10.1038/s41598-023-41032-5'],
    ['http://dx.doi.org/10.1038/s41598-023-41032-5', '10.1038/s41598-023-41032-5'],
    ['doi:10.1038/s41598-023-41032-5', '10.1038/s41598-023-41032-5'],
    ['DOI: 10.1038/s41598-023-41032-5.', '10.1038/s41598-023-41032-5'],
    ['10.1038/s41598-023-41032-5).', '10.1038/s41598-023-41032-5'],
    ['10.1038%2Fs41598-023-41032-5', '10.1038/s41598-023-41032-5'],
  ])('cleans %s', (input, expected) => {
    expect(normalizeDoi(input)).toBe(expected)
  })

  it('keeps balanced brackets that belong to the DOI', () => {
    const doi = '10.1002/(SICI)1097-4571(199806)49:8<693::AID-ASI4>3.0.CO;2-O'
    expect(normalizeDoi(doi)).toBe(doi)
    expect(normalizeDoi(`(${doi})`.slice(1))).toBe(doi)
  })

  it('rejects text that is not a DOI', () => {
    expect(normalizeDoi('not a doi')).toBeNull()
    expect(normalizeDoi('10.12/short-prefix')).toBeNull()
    expect(normalizeDoi('')).toBeNull()
  })
})

describe('extractDoi', () => {
  it('finds a DOI inside a reference and drops trailing punctuation', () => {
    const ref =
      'Walters, W. H. (2023). Fabrication and errors. Scientific Reports, 13. https://doi.org/10.1038/s41598-023-41032-5.'
    expect(extractDoi(ref)).toBe('10.1038/s41598-023-41032-5')
  })

  it('returns null when there is none', () => {
    expect(extractDoi('Budi, A. (2020). Skripsi tanpa DOI.')).toBeNull()
  })
})
