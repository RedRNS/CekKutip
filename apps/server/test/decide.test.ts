import type { MatchedRecord, ParsedReference, ReasonCode, CheckStatus } from '@cekkutip/shared'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds.js'
import { decide } from '../src/pipeline/decide.js'
import type { DecideInput } from '../src/pipeline/decide.js'
import type { MatchFlags, Retrieval, Scored } from '../src/pipeline/types.js'

const T = DEFAULT_THRESHOLDS // tauT .9, tauA .6, tauL .6, tauV .4

const record: MatchedRecord = {
  source: 'crossref',
  doi: '10.1/x',
  url: 'https://doi.org/10.1/x',
  title: 'Found title',
  authors: ['Walters'],
  year: 2023,
  venue: 'Scientific Reports',
  volume: '13',
  issue: null,
  pages: null,
}

const parsed = (over: Partial<ParsedReference> = {}): ParsedReference => ({
  raw: 'raw text',
  authors: ['Walters'],
  hasEtAl: false,
  year: 2023,
  title: 'Found title',
  venue: 'Scientific Reports',
  volume: null,
  issue: null,
  pages: null,
  doi: null,
  type: 'journal_article',
  parseMode: 'llm',
  ...over,
})

const allCited: MatchFlags = {
  titleCited: true,
  authorsCited: true,
  yearCited: true,
  venueCompared: true,
}

function scored(scores: Partial<Scored['scores']> = {}, flags: Partial<MatchFlags> = {}): Scored {
  return {
    record,
    scores: { title: 1, authors: 1, yearDiff: 0, venue: 1, ...scores },
    flags: { ...allCited, ...flags },
  }
}

function run(
  retrieval: Retrieval,
  best: Scored | null,
  p: ParsedReference = parsed(),
  options: Partial<DecideInput['options']> = {},
) {
  return decide({
    parsed: p,
    retrieval,
    best,
    options: { thresholds: T, abstain: true, checkAuthors: true, ...options },
  })
}

const candidates = (): Retrieval => ({ kind: 'candidates', candidates: [record] })
const doiRecord = (): Retrieval => ({ kind: 'doi_record', record })

interface Row {
  name: string
  rule: number
  status: CheckStatus
  reasons: ReasonCode[]
  input: () => ReturnType<typeof decide>
}

/** One entry per row of the brief's decision table (section 6.5), in order. */
const TABLE: Row[] = [
  {
    name: 'row 1: a service failed after retries',
    rule: 1,
    status: 'check_failed',
    reasons: ['check_failed_network'],
    input: () => run({ kind: 'service_failed' }, null),
  },
  {
    name: 'row 2: DOI registered nowhere',
    rule: 2,
    status: 'suspect',
    reasons: ['suspect_doi_not_found'],
    input: () => run({ kind: 'doi_not_registered' }, null, parsed({ doi: '10.9999/nope' })),
  },
  {
    name: 'row 3: DOI leads to a record with a very different title',
    rule: 3,
    status: 'mismatch',
    reasons: ['mismatch_doi_other_work'],
    input: () => run(doiRecord(), scored({ title: 0.2 }), parsed({ doi: '10.1/x' })),
  },
  {
    name: 'row 4: title, authors, and year agree',
    rule: 4,
    status: 'verified',
    reasons: ['verified_all_match'],
    input: () => run(candidates(), scored()),
  },
  {
    name: 'row 5a: title agrees, authors do not',
    rule: 5,
    status: 'mismatch',
    reasons: ['mismatch_authors'],
    input: () => run(candidates(), scored({ authors: 0.3 })),
  },
  {
    name: 'row 5b: title agrees, year differs by 2',
    rule: 5,
    status: 'mismatch',
    reasons: ['mismatch_year'],
    input: () => run(candidates(), scored({ yearDiff: 2 })),
  },
  {
    name: 'row 5c: title agrees, venue clearly differs',
    rule: 5,
    status: 'mismatch',
    reasons: ['mismatch_venue'],
    input: () => run(candidates(), scored({ venue: 0.1 })),
  },
  {
    name: 'row 5d: several things differ at once',
    rule: 5,
    status: 'mismatch',
    reasons: ['mismatch_authors', 'mismatch_year', 'mismatch_venue'],
    input: () => run(candidates(), scored({ authors: 0, yearDiff: 5, venue: 0 })),
  },
  {
    name: 'row 6: journal article, no record close enough',
    rule: 6,
    status: 'suspect',
    reasons: ['suspect_no_record_journal'],
    input: () =>
      run({ kind: 'candidates', candidates: [] }, null, parsed({ type: 'journal_article' })),
  },
  {
    name: 'row 6: a venue name alone makes it journal-like',
    rule: 6,
    status: 'suspect',
    reasons: ['suspect_no_record_journal'],
    input: () =>
      run(
        { kind: 'candidates', candidates: [] },
        null,
        parsed({ type: 'other', venue: 'Some Journal' }),
      ),
  },
  {
    name: 'row 6: a volume alone makes it journal-like',
    rule: 6,
    status: 'suspect',
    reasons: ['suspect_no_record_journal'],
    input: () =>
      run(
        { kind: 'candidates', candidates: [] },
        null,
        parsed({ type: 'other', venue: null, volume: '12' }),
      ),
  },
  {
    name: 'row 7: thesis, no record close enough',
    rule: 7,
    status: 'out_of_index',
    reasons: ['out_of_index_type'],
    input: () =>
      run({ kind: 'candidates', candidates: [] }, null, parsed({ type: 'thesis', venue: null })),
  },
  {
    name: 'row 8: not enough detail to search',
    rule: 8,
    status: 'out_of_index',
    reasons: ['out_of_index_insufficient_data'],
    input: () => run({ kind: 'insufficient' }, null, parsed({ title: null })),
  },
  {
    name: 'row 9: DOI belongs to another registry',
    rule: 9,
    status: 'out_of_index',
    reasons: ['out_of_index_other_registry'],
    input: () =>
      run({ kind: 'doi_other_registry', agency: 'DataCite' }, null, parsed({ doi: '10.5281/z' })),
  },
]

describe('decision table, brief section 6.5', () => {
  it.each(TABLE)('$name', ({ input, rule, status, reasons }) => {
    expect(input()).toEqual({ rule, status, reasons })
  })

  for (const type of ['book', 'book_chapter', 'thesis', 'report', 'web_page', 'other'] as const) {
    it(`row 7 applies to type ${type} without journal signals`, () => {
      const d = run(
        { kind: 'candidates', candidates: [] },
        null,
        parsed({ type, venue: null, volume: null }),
      )
      expect(d).toMatchObject({ rule: 7, status: 'out_of_index' })
    })
  }

  it('row 7: a conference paper with no venue is abstained on too', () => {
    const d = run(
      { kind: 'candidates', candidates: [] },
      null,
      parsed({ type: 'conference_paper', venue: null }),
    )
    expect(d.status).toBe('out_of_index')
  })
})

describe('rules are evaluated in order', () => {
  it('a failed service beats every other signal', () => {
    expect(run({ kind: 'service_failed' }, scored(), parsed({ type: 'thesis' })).status).toBe(
      'check_failed',
    )
  })

  it('a failure is never a verdict: it is neither suspect nor out_of_index', () => {
    const d = run(
      { kind: 'service_failed' },
      null,
      parsed({ type: 'journal_article', doi: '10.1/x' }),
    )
    expect(['suspect', 'mismatch', 'verified', 'out_of_index']).not.toContain(d.status)
  })

  it('a DOI that leads to another work (row 3) wins over matching authors and year', () => {
    const d = run(
      doiRecord(),
      scored({ title: 0.3, authors: 1, yearDiff: 0 }),
      parsed({ doi: '10.1/x' }),
    )
    expect(d.rule).toBe(3)
  })

  it('journal-like (row 6) wins over thesis-like (row 7) when both signals are present', () => {
    const d = run(
      { kind: 'candidates', candidates: [] },
      null,
      parsed({ type: 'thesis', venue: 'Jurnal X' }),
    )
    expect(d.rule).toBe(6)
  })
})

describe('thresholds are inclusive on the "high" side', () => {
  it('title exactly at TAU_T counts as the same work', () => {
    expect(run(candidates(), scored({ title: T.tauT })).status).toBe('verified')
  })

  it('title just below TAU_T without a DOI counts as not matched', () => {
    const d = run(candidates(), scored({ title: T.tauT - 0.001 }))
    expect(d.rule).toBe(6)
  })

  it('authors exactly at TAU_A pass; just below fail', () => {
    expect(run(candidates(), scored({ authors: T.tauA })).status).toBe('verified')
    expect(run(candidates(), scored({ authors: T.tauA - 0.01 })).reasons).toEqual([
      'mismatch_authors',
    ])
  })

  it('a year difference of 1 is allowed; 2 is not', () => {
    expect(run(candidates(), scored({ yearDiff: 1 })).status).toBe('verified')
    expect(run(candidates(), scored({ yearDiff: 2 })).reasons).toEqual(['mismatch_year'])
  })

  it('venue exactly at TAU_V passes; just below differs', () => {
    expect(run(candidates(), scored({ venue: T.tauV })).status).toBe('verified')
    expect(run(candidates(), scored({ venue: T.tauV - 0.01 })).reasons).toEqual(['mismatch_venue'])
  })

  it('title exactly at TAU_L is not "a different work" for a DOI record', () => {
    const d = run(doiRecord(), scored({ title: T.tauL }), parsed({ doi: '10.1/x' }))
    expect(d.rule).not.toBe(3)
  })

  it('title just below TAU_L is "a different work" for a DOI record', () => {
    const d = run(doiRecord(), scored({ title: T.tauL - 0.01 }), parsed({ doi: '10.1/x' }))
    expect(d.rule).toBe(3)
  })
})

describe('gap A: venue (decisions no. 6)', () => {
  it('a venue that clearly differs blocks Verified even when title, authors, and year agree', () => {
    const d = run(candidates(), scored({ venue: 0 }))
    expect(d).toMatchObject({ status: 'mismatch', reasons: ['mismatch_venue'] })
  })

  it('a venue that was not cited (or not found) is never held against the reference', () => {
    const d = run(candidates(), scored({ venue: 0 }, { venueCompared: false }))
    expect(d.status).toBe('verified')
  })
})

describe('gap B: DOI records (decisions no. 7)', () => {
  it('a DOI record with a title between TAU_L and TAU_T is treated as the same work: verified', () => {
    const d = run(doiRecord(), scored({ title: 0.75 }), parsed({ doi: '10.1/x' }))
    expect(d).toMatchObject({ rule: 4, status: 'verified' })
  })

  it('...and as a mismatch when authors or year differ', () => {
    const d = run(doiRecord(), scored({ title: 0.75, yearDiff: 3 }), parsed({ doi: '10.1/x' }))
    expect(d).toMatchObject({ rule: 5, status: 'mismatch', reasons: ['mismatch_year'] })
  })

  it('without a DOI the same title score does not count as a match', () => {
    const d = run(candidates(), scored({ title: 0.75 }))
    expect(d.rule).toBe(6)
  })

  it('a DOI reference with no cited title is compared on authors and year', () => {
    const b = scored({ title: 0 }, { titleCited: false })
    expect(run(doiRecord(), b, parsed({ doi: '10.1/x', title: null }))).toMatchObject({
      status: 'verified',
    })
    const wrong = scored({ title: 0, yearDiff: 4 }, { titleCited: false })
    expect(run(doiRecord(), wrong, parsed({ doi: '10.1/x', title: null })).reasons).toEqual([
      'mismatch_year',
    ])
  })

  it('throws if a DOI record arrives without a scored record (a bug, not a verdict)', () => {
    expect(() => run(doiRecord(), null)).toThrow()
  })
})

describe('evidence: at least two of title, authors, year must be written and compared', () => {
  it('a bare DOI that resolves cannot be called Verified', () => {
    const b = scored(
      { title: 0, authors: 0, yearDiff: null },
      { titleCited: false, authorsCited: false, yearCited: false, venueCompared: false },
    )
    const d = run(doiRecord(), b, parsed({ doi: '10.1/x', title: null, authors: [], year: null }))
    expect(d).toMatchObject({ status: 'out_of_index', reasons: ['out_of_index_insufficient_data'] })
  })

  it('a title with no authors and no year is not enough either', () => {
    const b = scored({}, { authorsCited: false, yearCited: false })
    b.scores.yearDiff = null
    expect(run(candidates(), b, parsed({ authors: [], year: null })).reasons).toEqual([
      'out_of_index_insufficient_data',
    ])
  })

  it('title and year alone are enough', () => {
    const b = scored({}, { authorsCited: false })
    expect(run(candidates(), b, parsed({ authors: [] })).status).toBe('verified')
  })

  it('title and authors alone are enough', () => {
    const b = scored({ yearDiff: null }, { yearCited: false })
    expect(run(candidates(), b, parsed({ year: null })).status).toBe('verified')
  })

  it('a mismatch is still reported when little was cited', () => {
    const b = scored({ yearDiff: 5 }, { authorsCited: false })
    expect(run(candidates(), b, parsed({ authors: [] })).reasons).toEqual(['mismatch_year'])
  })
})

describe('ablations', () => {
  it('A1 (no abstain): Out-of-index becomes Suspect, other verdicts are unchanged', () => {
    const noAbstain = { abstain: false }
    expect(
      run(
        { kind: 'candidates', candidates: [] },
        null,
        parsed({ type: 'thesis', venue: null }),
        noAbstain,
      ).status,
    ).toBe('suspect')
    expect(run({ kind: 'insufficient' }, null, parsed({ title: null }), noAbstain).status).toBe(
      'suspect',
    )
    expect(
      run({ kind: 'doi_other_registry', agency: 'x' }, null, parsed({ doi: '10.1/x' }), noAbstain)
        .status,
    ).toBe('suspect')
    expect(run(candidates(), scored(), parsed(), noAbstain).status).toBe('verified')
    expect(run({ kind: 'service_failed' }, null, parsed(), noAbstain).status).toBe('check_failed')
  })

  it('A1 keeps the original reason code so the audit trail still says why', () => {
    const d = run(
      { kind: 'candidates', candidates: [] },
      null,
      parsed({ type: 'thesis', venue: null }),
      { abstain: false },
    )
    expect(d.reasons).toEqual(['out_of_index_type'])
  })

  it('A4 (no author check): wrong authors no longer cause a mismatch', () => {
    const b = scored({ authors: 0 })
    expect(run(candidates(), b, parsed(), { checkAuthors: false }).status).toBe('verified')
    expect(run(candidates(), b, parsed(), { checkAuthors: true }).status).toBe('mismatch')
  })

  it('A4 counts only title and year as evidence', () => {
    const b = scored({ authors: 0 }, { yearCited: false })
    b.scores.yearDiff = null
    expect(run(candidates(), b, parsed({ year: null }), { checkAuthors: false }).reasons).toEqual([
      'out_of_index_insufficient_data',
    ])
  })
})

describe('purity', () => {
  it('gives the same answer for the same input and does not mutate it', () => {
    const b = scored({ authors: 0.2 })
    const before = JSON.stringify(b)
    const a1 = run(candidates(), b)
    const a2 = run(candidates(), b)
    expect(a1).toEqual(a2)
    expect(JSON.stringify(b)).toBe(before)
  })

  it('every non-failed reason code is one the brief defines for that status', () => {
    const allowed: Record<string, ReasonCode[]> = {
      verified: ['verified_all_match'],
      mismatch: ['mismatch_authors', 'mismatch_year', 'mismatch_venue', 'mismatch_doi_other_work'],
      suspect: ['suspect_doi_not_found', 'suspect_no_record_journal'],
      out_of_index: [
        'out_of_index_type',
        'out_of_index_insufficient_data',
        'out_of_index_other_registry',
      ],
      check_failed: ['check_failed_network'],
    }
    for (const row of TABLE) {
      const d = row.input()
      for (const r of d.reasons) expect(allowed[d.status]).toContain(r)
    }
  })
})
