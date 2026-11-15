import { describe, expect, it } from 'vitest'
import {
  CheckRequestSchema,
  DOI_PATTERN,
  ParsedReferenceSchema,
  StreamEventSchema,
} from './index.js'

const parsed = {
  raw: 'x',
  authors: ['Walters'],
  hasEtAl: false,
  year: 2021,
  title: 'T',
  venue: null,
  volume: null,
  issue: null,
  pages: null,
  doi: null,
  type: 'journal_article',
  parseMode: 'regex',
}

describe('shared schemas', () => {
  it('accepts a valid DOI and rejects a malformed one', () => {
    expect(DOI_PATTERN.test('10.1038/s41598-023-41032-5')).toBe(true)
    expect(DOI_PATTERN.test('doi:10.1038/x')).toBe(false)
    expect(ParsedReferenceSchema.safeParse({ ...parsed, doi: 'not-a-doi' }).success).toBe(false)
    expect(ParsedReferenceSchema.safeParse(parsed).success).toBe(true)
  })

  it('defaults parseMode to llm', () => {
    const r = CheckRequestSchema.parse({ references: ['a'] })
    expect(r.options.parseMode).toBe('llm')
  })

  it('discriminates stream events', () => {
    expect(StreamEventSchema.safeParse({ type: 'started', total: 3 }).success).toBe(true)
    expect(StreamEventSchema.safeParse({ type: 'nope' }).success).toBe(false)
  })
})
