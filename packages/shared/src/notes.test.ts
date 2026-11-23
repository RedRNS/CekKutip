import { describe, expect, it } from 'vitest'
import type { MatchedRecord, ParsedReference, ReferenceResult } from './index.js'
import { resultNotes } from './notes.js'

const parsed = (over: Partial<ParsedReference> = {}): ParsedReference => ({
  raw: 'x',
  authors: ['Walters', 'Wilder'],
  hasEtAl: false,
  year: 2023,
  title: 'Fabrication and errors',
  venue: null,
  volume: null,
  issue: null,
  pages: null,
  doi: null,
  type: 'journal_article',
  parseMode: 'regex',
  ...over,
})

const record = (over: Partial<MatchedRecord> = {}): MatchedRecord => ({
  source: 'crossref',
  doi: '10.1038/s41598-023-41032-5',
  url: null,
  title: 'Fabrication and errors',
  authors: ['Walters', 'Wilder'],
  year: 2023,
  venue: 'Scientific Reports',
  volume: null,
  issue: null,
  pages: null,
  ...over,
})

let next = 0
const result = (
  over: Partial<Omit<ReferenceResult, 'parsed' | 'record'>> & {
    parsed?: Partial<ParsedReference>
    record?: Partial<MatchedRecord> | null
  } = {},
): ReferenceResult => {
  const { parsed: p, record: r, ...rest } = over
  const index = next++
  return {
    index,
    raw: 'x',
    status: 'verified',
    reasons: ['verified_all_match'],
    parsed: parsed(p),
    // Each result leads to a record of its own unless a test says otherwise.
    record: r === null ? null : record({ doi: `10.1000/r${index}`, ...r }),
    comparison: [],
    scores: { title: 1, authors: 1, yearDiff: 0, venue: 0 },
    latencyMs: 1,
    ...rest,
  }
}

const notesOf = (results: ReferenceResult[]) => resultNotes(results)

describe('resultNotes: the year', () => {
  it('says so when a verified reference is a year away from the record', () => {
    const r = result({ parsed: { year: 2023 }, record: { year: 2022 } })
    expect(notesOf([r]).get(r.index)).toEqual([{ code: 'year_differs', cited: 2023, found: 2022 }])
  })

  it('says nothing when the years are the same, or when one is missing', () => {
    const same = result()
    const noCited = result({ parsed: { year: null } })
    const noFound = result({ record: { year: null } })
    expect(notesOf([same, noCited, noFound]).size).toBe(0)
  })

  it('says nothing about the year for a result that is not Verified: its own reasons say what differs', () => {
    const r = result({ status: 'mismatch', reasons: ['mismatch_authors'], parsed: { year: 2023 }, record: { year: 2022 } })
    expect(notesOf([r]).has(r.index)).toBe(false)
  })
})

describe('resultNotes: how many authors are written', () => {
  it('says so when fewer authors are written than the record has, and there is no "et al."', () => {
    const r = result({
      parsed: { authors: ['Wei'] },
      record: { authors: ['Wei', 'Wang', 'Schuurmans', 'Bosma'] },
    })
    expect(notesOf([r]).get(r.index)).toEqual([{ code: 'authors_partial', cited: 1, found: 4 }])
  })

  it('says nothing with "et al.", with every author written, or with none written', () => {
    const etAl = result({ parsed: { authors: ['Wei'], hasEtAl: true }, record: { authors: ['Wei', 'Wang', 'Bosma'] } })
    const all = result({ parsed: { authors: ['Wei', 'Wang'] }, record: { authors: ['Wei', 'Wang'] } })
    const none = result({ parsed: { authors: [] }, record: { authors: ['Wei', 'Wang'] } })
    expect(notesOf([etAl, all, none]).size).toBe(0)
  })

  it('does not count a long list that APA 7 shortens to 20 names as a short one', () => {
    const names = Array.from({ length: 20 }, (_, i) => `Author${i}`)
    const long = result({ parsed: { authors: names }, record: { authors: [...names, 'More', 'Others'] } })
    expect(notesOf([long]).has(long.index)).toBe(false)
  })

  it('says nothing for a result that is not Verified, or has no record', () => {
    const mismatch = result({ status: 'mismatch', reasons: ['mismatch_authors'], parsed: { authors: ['Wei'] }, record: { authors: ['Wei', 'Wang'] } })
    const none = result({ status: 'out_of_index', reasons: ['out_of_index_type'], parsed: { authors: ['Wei'] }, record: null })
    expect(notesOf([mismatch, none]).size).toBe(0)
  })
})

describe('resultNotes: two references, one record', () => {
  it('tells each of them about the other, by the numbers shown (from 1)', () => {
    next = 0
    const a = result({ record: { doi: '10.52202/068431-1800' } })
    const b = result({ record: { doi: '10.9999/other' } })
    const c = result({ record: { doi: '10.52202/068431-1800' } })
    const notes = notesOf([a, b, c])
    expect(notes.get(a.index)).toEqual([{ code: 'same_record', others: [3] }])
    expect(notes.get(c.index)).toEqual([{ code: 'same_record', others: [1] }])
    expect(notes.has(b.index)).toBe(false)
  })

  it('lists every other reference when there are three', () => {
    next = 0
    const rs = [0, 1, 2].map(() => result({ record: { doi: '10.1000/x' } }))
    expect(notesOf(rs).get(1)).toEqual([{ code: 'same_record', others: [1, 3] }])
  })

  it('takes a DOI written in capitals or as an address as the same DOI', () => {
    next = 0
    const a = result({ record: { doi: '10.1109/ACCESS.2021.3087913' } })
    const b = result({ record: { doi: 'https://doi.org/10.1109/access.2021.3087913' } })
    expect(notesOf([a, b]).get(0)).toEqual([{ code: 'same_record', others: [2] }])
  })

  it('does not depend on the order the results came in', () => {
    next = 0
    const a = result({ record: { doi: '10.1000/x' } })
    const b = result({ record: { doi: '10.1000/x' } })
    expect(notesOf([b, a]).get(0)).toEqual([{ code: 'same_record', others: [2] }])
    expect(notesOf([b, a]).get(1)).toEqual([{ code: 'same_record', others: [1] }])
  })

  it('uses the record address when it has no DOI, and nothing when it has neither', () => {
    next = 0
    const a = result({ record: { source: 'garuda', doi: null, url: 'https://garuda.example/view/1' } })
    const b = result({ record: { source: 'garuda', doi: null, url: 'https://garuda.example/view/1' } })
    const c = result({ record: { source: 'openalex', doi: null, url: null } })
    const d = result({ record: { source: 'openalex', doi: null, url: null } })
    const notes = notesOf([a, b, c, d])
    expect(notes.get(0)).toEqual([{ code: 'same_record', others: [2] }])
    expect(notes.has(2)).toBe(false)
    expect(notes.has(3)).toBe(false)
  })

  it('counts only results with a record that was found, not suspect or failed ones', () => {
    next = 0
    const a = result({ record: { doi: '10.1000/x' } })
    const b = result({ status: 'out_of_index', reasons: ['out_of_index_type'], record: null })
    const c = result({ status: 'check_failed', reasons: ['check_failed_network'], record: null })
    expect(notesOf([a, b, c]).size).toBe(0)
  })

  it('still tells a Mismatch that it points at the same record as another reference', () => {
    next = 0
    const a = result({ record: { doi: '10.1609/icwsm.v19i1.35923' } })
    const b = result({ status: 'mismatch', reasons: ['mismatch_authors'], record: { doi: '10.1609/icwsm.v19i1.35923' } })
    expect(notesOf([a, b]).get(1)).toEqual([{ code: 'same_record', others: [1] }])
  })

  it('keeps the notes of one result in one order: year, authors, then the record', () => {
    next = 0
    const a = result({
      parsed: { year: 2023, authors: ['Wei'] },
      record: { year: 2022, authors: ['Wei', 'Wang'], doi: '10.1000/x' },
    })
    const b = result({ record: { doi: '10.1000/x' } })
    expect(notesOf([a, b]).get(0)?.map((n) => n.code)).toEqual(['year_differs', 'authors_partial', 'same_record'])
  })
})
