import { describe, expect, it } from 'vitest'
import { arxivDoi, extractArxivId } from './arxiv.js'

describe('extractArxivId', () => {
  it.each([
    ['Dubey, H. (2024). A survey. arXiv preprint arXiv:2407.12994v2.', '2407.12994'],
    ['arXiv:2407.12994', '2407.12994'],
    ['ARXIV:2407.12994v10', '2407.12994'],
    ['arXiv: 1706.03762 [cs.CL]', '1706.03762'],
    ['(arXiv:1501.00001).', '1501.00001'],
    ['https://arxiv.org/abs/2407.12994v3', '2407.12994'],
    ['Available at https://arxiv.org/pdf/2407.12994v1.pdf', '2407.12994'],
    ['arXiv:0704.0001', '0704.0001'], // four digits after the dot, as before 2015
  ])('reads a new-style ID: %s', (text, id) => {
    expect(extractArxivId(text)).toBe(id)
  })

  it.each([
    ['arXiv:hep-th/9901001v2', 'hep-th/9901001'],
    ['arXiv:math.GT/0309136', 'math.GT/0309136'],
    ['https://arxiv.org/abs/cond-mat/0611001', 'cond-mat/0611001'],
  ])('reads an old-style ID: %s', (text, id) => {
    expect(extractArxivId(text)).toBe(id)
  })

  it('takes the first ID when there are two', () => {
    expect(extractArxivId('arXiv:2407.12994 and arXiv:1706.03762')).toBe('2407.12994')
  })

  it.each([
    ['a number that looks like an ID but is not named as one', 'Journal of Things 2023.12345, pp. 1-9'],
    ['a bare ID without the word arXiv', 'Dubey (2024) 2407.12994'],
    ['the word arXiv without an ID', 'arXiv preprint'],
    ['a month that does not exist', 'arXiv:2413.00001'],
    ['a month of zero', 'arXiv:2400.00001'],
    ['too many digits', 'arXiv:2407.129941'],
    ['too few digits', 'arXiv:2407.129'],
    ['an old-style ID without its seven digits', 'arXiv:hep-th/99010'],
    ['a DOI, which the DOI path already handles', 'https://doi.org/10.48550/arXiv.2407.12994'],
    ['empty text', ''],
  ])('reads nothing from %s', (_why, text) => {
    expect(extractArxivId(text)).toBeNull()
  })
})

describe('arxivDoi', () => {
  it('is the DOI arXiv registers with DataCite for every paper', () => {
    expect(arxivDoi('2407.12994')).toBe('10.48550/arXiv.2407.12994')
    expect(arxivDoi('hep-th/9901001')).toBe('10.48550/arXiv.hep-th/9901001')
  })
})
