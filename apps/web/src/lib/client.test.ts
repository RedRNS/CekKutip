import type { ReferenceResult, StreamEvent } from '@cekkutip/shared'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { id } from '../i18n/id'
import { checkReducer, countByStatus, initialCheckState } from '../state/check'
import { createLineParser, parseEvent, toClientCode } from './api'
import {
  csvCell,
  reasonSentences,
  reasonText,
  recordUrl,
  scholarUrl,
  toCsv,
  toReport,
} from './report'

const result = (over: Partial<ReferenceResult> = {}): ReferenceResult => ({
  index: 0,
  raw: 'Walters, W. H. (2021). A title. Nature Communications.',
  status: 'mismatch',
  reasons: ['mismatch_year', 'mismatch_venue'],
  parsed: {
    raw: 'Walters, W. H. (2021). A title. Nature Communications.',
    authors: ['Walters'],
    hasEtAl: false,
    year: 2021,
    title: 'A title',
    venue: 'Nature Communications',
    volume: null,
    issue: null,
    pages: null,
    doi: null,
    type: 'journal_article',
    parseMode: 'llm',
  },
  record: {
    source: 'crossref',
    doi: '10.1/x',
    url: 'https://doi.org/10.1/x',
    title: 'A title',
    authors: ['Walters'],
    year: 2023,
    venue: 'Scientific Reports',
    volume: '13',
    issue: null,
    pages: null,
  },
  comparison: [],
  scores: { title: 1, authors: 1, yearDiff: 2, venue: 0.14 },
  latencyMs: 10,
  ...over,
})

describe('createLineParser', () => {
  it('emits complete lines even when chunks split them', () => {
    const lines: string[] = []
    const p = createLineParser((l) => lines.push(l))
    p.push('{"a":1}\n{"b"')
    expect(lines).toEqual(['{"a":1}'])
    p.push(':2}\n\n{"c":3}')
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
    p.flush()
    expect(lines).toEqual(['{"a":1}', '{"b":2}', '{"c":3}'])
  })

  it('handles Windows line endings and ignores blank lines', () => {
    const lines: string[] = []
    const p = createLineParser((l) => lines.push(l))
    p.push('one\r\n\r\ntwo\r\n')
    p.flush()
    expect(lines).toEqual(['one', 'two'])
  })
})

describe('parseEvent', () => {
  it('accepts the three event types', () => {
    expect(parseEvent('{"type":"started","total":3}')).toEqual({ type: 'started', total: 3 })
    expect(parseEvent(JSON.stringify({ type: 'result', result: result() }))?.type).toBe('result')
    expect(parseEvent('{"type":"done","summary":{}}')?.type).toBe('done')
  })

  it('ignores anything else instead of trusting it', () => {
    for (const line of [
      'not json',
      '{}',
      '{"type":"other"}',
      '{"type":"result"}',
      '{"type":"started"}',
      'null',
    ]) {
      expect(parseEvent(line)).toBeNull()
    }
  })
})

describe('toClientCode', () => {
  it('maps server answers to fixed message codes', () => {
    expect(toClientCode(429, 'anything')).toBe('rate_limited')
    expect(toClientCode(413, 'payload_too_large')).toBe('too_many_references')
    expect(toClientCode(400, 'too_many_references')).toBe('too_many_references')
    expect(toClientCode(400, 'no_references')).toBe('no_references')
    expect(toClientCode(500, 'internal_error')).toBe('generic')
    expect(toClientCode(400, undefined)).toBe('generic')
  })
})

describe('checkReducer', () => {
  const started = checkReducer(initialCheckState, {
    type: 'start',
    references: ['a', 'b'],
    parseMode: 'regex',
  })
  const event = (e: StreamEvent) => ({ type: 'event' as const, event: e })

  it('starts clean and remembers what was sent', () => {
    expect(started).toMatchObject({
      phase: 'running',
      references: ['a', 'b'],
      parseMode: 'regex',
      received: 0,
    })
  })

  it('stores results by index, in any order, once each', () => {
    let s = checkReducer(started, event({ type: 'result', result: result({ index: 1 }) }))
    s = checkReducer(s, event({ type: 'result', result: result({ index: 0, status: 'verified' }) }))
    s = checkReducer(s, event({ type: 'result', result: result({ index: 0, status: 'suspect' }) })) // duplicate
    expect(s.received).toBe(2)
    expect(s.results[0]?.status).toBe('verified')
    expect(s.results[1]?.status).toBe('mismatch')
  })

  it('ignores a result whose index is outside the list', () => {
    const s = checkReducer(started, event({ type: 'result', result: result({ index: 7 }) }))
    expect(s.received).toBe(0)
  })

  it('keeps partial results when the check fails', () => {
    let s = checkReducer(started, event({ type: 'result', result: result({ index: 0 }) }))
    s = checkReducer(s, { type: 'fail', code: 'incomplete' })
    expect(s).toMatchObject({ phase: 'error', error: 'incomplete', received: 1 })
    // Late events after a failure change nothing.
    expect(checkReducer(s, event({ type: 'result', result: result({ index: 1 }) }))).toBe(s)
  })

  it('counts results by status', () => {
    const counts = countByStatus({ 0: result(), 1: result({ index: 1, status: 'check_failed' }) })
    expect(counts).toEqual({
      verified: 0,
      mismatch: 1,
      suspect: 0,
      out_of_index: 0,
      check_failed: 1,
    })
  })
})

describe('reason text comes from fixed templates', () => {
  it('fills in the year difference and uses one sentence per reason code', () => {
    expect(reasonSentences(result(), en)).toEqual([
      'This work exists, but the year differs by 2 years.',
      'This work exists, but it was published in a different journal.',
    ])
    expect(reasonText(result(), id)).toContain('tahunnya berbeda 2 tahun')
  })

  it('names the source for a verified result and the type for an abstained one', () => {
    const verified = result({ status: 'verified', reasons: ['verified_all_match'] })
    expect(reasonText(verified, en)).toBe('Found in Crossref. Title, authors, and year agree.')
    const thesis = result({
      status: 'out_of_index',
      reasons: ['out_of_index_type'],
      record: null,
      parsed: { ...result().parsed, type: 'thesis' },
    })
    expect(reasonText(thesis, en)).toContain('This looks like a thesis.')
    expect(reasonText(thesis, id)).toContain('skripsi atau tesis')
  })

  it('never leaves a placeholder unfilled, for any reason code in either language', () => {
    for (const dict of [en, id]) {
      for (const code of Object.keys(dict.reasons) as (keyof typeof dict.reasons)[]) {
        expect(reasonText(result({ reasons: [code] }), dict)).not.toMatch(/[{}]/)
      }
    }
  })
})

describe('CSV export', () => {
  it('quotes cells that need it', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(2023)).toBe('2023')
  })

  it('neutralises text that a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil.test")')).toBe('"\'=HYPERLINK(""http://evil.test"")"')
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@cmd')).toBe("'@cmd")
    expect(csvCell(-1)).toBe('-1') // real numbers are left alone
  })

  it('writes a header and one row per result, starting with a byte order mark', () => {
    const csv = toCsv([result(), result({ index: 1, raw: '=1+1, formula', record: null })], en)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]?.split(',')).toHaveLength(22)
    expect(lines[1]).toContain('1,Mismatch,mismatch_year mismatch_venue,')
    expect(lines[1]).toContain(
      'Crossref,A title,Walters,2023,Scientific Reports,10.1/x,https://doi.org/10.1/x',
    )
    expect(lines[2]).toContain('"\'=1+1, formula"')
  })
})

describe('report and links', () => {
  it('builds a plain-text report with totals, cut-offs, and the fixed statement', () => {
    const text = toReport(
      [result()],
      {
        total: 1,
        verified: 0,
        mismatch: 1,
        suspect: 0,
        outOfIndex: 0,
        checkFailed: 0,
        medianLatencyMs: 5,
        thresholds: { tauT: 0.9, tauA: 0.6, tauL: 0.6, tauV: 0.4 },
        toolVersion: '0.1.0',
      },
      en,
      '2026-11-16',
    )
    expect(text).toContain('CekKutip reference check (2026-11-16)')
    expect(text).toContain('1. [Mismatch] Walters, W. H. (2021).')
    expect(text).toContain('Record: https://doi.org/10.1/x')
    expect(text).toContain('Total 1. Verified 0. Mismatch 1.')
    expect(text).toContain(
      'CekKutip 0.1.0. Cut-offs: title 0.9, authors 0.6, low title 0.6, venue 0.4.',
    )
    expect(
      text.trimEnd().endsWith('Verdicts are prompts for review, not findings of misconduct.'),
    ).toBe(true)
  })

  it('links to the DOI when there is one, and only to https addresses otherwise', () => {
    expect(recordUrl(result())).toBe('https://doi.org/10.1/x')
    const noDoi = (url: string | null) =>
      result({ record: { ...result().record!, doi: null, url } })
    expect(recordUrl(noDoi('https://example.org/paper'))).toBe('https://example.org/paper')
    expect(recordUrl(noDoi('javascript:alert(1)'))).toBeNull()
    expect(recordUrl(noDoi('http://example.org/paper'))).toBeNull()
    expect(recordUrl(result({ record: null }))).toBeNull()
  })

  it('builds a Google Scholar search from the title', () => {
    expect(scholarUrl(result())).toBe('https://scholar.google.com/scholar?q=A%20title')
  })
})
