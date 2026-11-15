import { describe, expect, it } from 'vitest'
import { LimitExceededError, prepareReferences } from '../src/pipeline/split.js'

const limits = { maxReferences: 3, maxReferenceChars: 60 }

describe('prepareReferences', () => {
  it('splits a string', () => {
    expect(
      prepareReferences('1. Alpha, A. (2020). One.\n2. Beta, B. (2021). Two.', limits),
    ).toEqual(['Alpha, A. (2020). One.', 'Beta, B. (2021). Two.'])
  })

  it('cleans array items without splitting them further', () => {
    expect(
      prepareReferences(
        ['  [1] Alpha,  A. (2020).\u200B One. ', '', 'Beta, B. (2021). Two.'],
        limits,
      ),
    ).toEqual(['Alpha, A. (2020). One.', 'Beta, B. (2021). Two.'])
  })

  it('rejects too many references with a clear message instead of cutting the list', () => {
    const err = (() => {
      try {
        prepareReferences(['a', 'b', 'c', 'd'], limits)
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(LimitExceededError)
    expect((err as LimitExceededError).detail).toEqual({
      error: 'too_many_references',
      limit: 3,
      found: 4,
    })
    expect((err as Error).message).toBe(
      'You can check up to 3 references at a time. Split your list and check it in parts.',
    )
  })

  it('rejects an over-long reference and names which one', () => {
    expect(() => prepareReferences(['ok', 'x'.repeat(61)], limits)).toThrow(
      'Reference 2 is longer than 60 characters',
    )
  })

  it('returns an empty list for blank input', () => {
    expect(prepareReferences('   \n\n ', limits)).toEqual([])
    expect(prepareReferences([], limits)).toEqual([])
  })
})
