import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
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

  it('sends temperature 0 to the model unless told otherwise', () => {
    expect(loadEnv({}).geminiTemperature).toBe(0)
    expect(loadEnv({ GEMINI_TEMPERATURE: '' }).geminiTemperature).toBe(0)
    expect(loadEnv({ GEMINI_TEMPERATURE: '0.2' }).geminiTemperature).toBe(0.2)
    expect(loadEnv({ GEMINI_TEMPERATURE: 'off' }).geminiTemperature).toBeUndefined()
    expect(loadEnv({ GEMINI_TEMPERATURE: 'junk' }).geminiTemperature).toBe(0)
  })

  it('never enables experiment modes in production', () => {
    expect(loadEnv({ ENABLE_EXPERIMENT_MODES: 'true' }).enableExperimentModes).toBe(true)
    expect(
      loadEnv({ NODE_ENV: 'production', ENABLE_EXPERIMENT_MODES: 'true' }).enableExperimentModes,
    ).toBe(false)
    expect(loadEnv({}).enableExperimentModes).toBe(false)
  })

  it('treats blank keys as absent', () => {
    const e = loadEnv({ GEMINI_API_KEY: '  ', CROSSREF_MAILTO: '', OPENALEX_API_KEY: '' })
    expect(e.geminiApiKey).toBeUndefined()
    expect(e.crossrefMailto).toBeUndefined()
    expect(e.openalexApiKey).toBeUndefined()
  })
})
