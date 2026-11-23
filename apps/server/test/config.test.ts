import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { loadLimits } from '../src/config/limits.js'
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds.js'
import { buildPipelineDeps } from '../src/wiring.js'

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

describe('Gemini keys', () => {
  it('reads the three keys in order', () => {
    const e = loadEnv({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_2: 'b', GEMINI_API_KEY_3: 'c' })
    expect(e.geminiApiKeys).toEqual(['a', 'b', 'c'])
    expect(e.geminiApiKey).toBe('a')
  })

  it('skips blanks and merges repeats', () => {
    const e = loadEnv({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_2: '  ', GEMINI_API_KEY_3: 'a' })
    expect(e.geminiApiKeys).toEqual(['a'])
  })

  it('uses a backup key when the first is missing', () => {
    const e = loadEnv({ GEMINI_API_KEY: '', GEMINI_API_KEY_2: 'b' })
    expect(e.geminiApiKeys).toEqual(['b'])
    expect(e.geminiApiKey).toBe('b')
  })

  it('has no keys at all by default', () => {
    const e = loadEnv({})
    expect(e.geminiApiKeys).toEqual([])
    expect(e.geminiApiKey).toBeUndefined()
  })
})

describe('Garuda switch', () => {
  it('is on by default, and for blank or unrecognised values', () => {
    expect(loadEnv({}).garudaEnabled).toBe(true)
    expect(loadEnv({ GARUDA_ENABLED: '' }).garudaEnabled).toBe(true)
    expect(loadEnv({ GARUDA_ENABLED: 'true' }).garudaEnabled).toBe(true)
    expect(loadEnv({ GARUDA_ENABLED: 'maybe' }).garudaEnabled).toBe(true)
  })

  it.each(['false', 'FALSE', ' 0 ', 'no', 'off'])('is off for %j', (value) => {
    expect(loadEnv({ GARUDA_ENABLED: value }).garudaEnabled).toBe(false)
  })

  it('decides whether the pipeline gets a Garuda client at all', () => {
    expect(buildPipelineDeps(loadEnv({}), loadLimits({})).retrieve.garuda).toBeDefined()
    expect(
      buildPipelineDeps(loadEnv({ GARUDA_ENABLED: 'false' }), loadLimits({})).retrieve.garuda,
    ).toBeUndefined()
  })
})
