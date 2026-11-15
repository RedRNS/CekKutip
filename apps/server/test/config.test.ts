import { describe, expect, it } from 'vitest'
import { loadLimits } from '../src/config/limits.js'
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds.js'

describe('config', () => {
  it('uses the documented defaults', () => {
    const l = loadLimits({})
    expect(l.maxReferences).toBe(40)
    expect(l.maxReferenceChars).toBe(600)
    expect(l.maxBodyBytes).toBe(65536)
    expect(l.rateLimitMax).toBe(10)
  })

  it('reads overrides and ignores junk', () => {
    expect(loadLimits({ MAX_REFERENCES: '12' }).maxReferences).toBe(12)
    expect(loadLimits({ MAX_REFERENCES: 'abc' }).maxReferences).toBe(40)
    expect(loadLimits({ MAX_REFERENCES: '-3' }).maxReferences).toBe(40)
  })

  it('keeps provisional thresholds in one place', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ tauT: 0.9, tauA: 0.6, tauL: 0.6, tauV: 0.4 })
  })
})
