import { describe, expect, it } from 'vitest'
import {
  BRIDGE_EXTENSION_SOURCE,
  BRIDGE_PAGE_SOURCE,
  EMPTY_KEY_STATE,
  GEMINI_KEY_HEADER,
  isPlausibleGeminiKey,
  isStoredKey,
  maskKey,
  normalizeKeyInput,
  parseExtensionMessage,
  parsePageMessage,
  pickNewer,
} from './apikey.js'

const KEY = 'AIzaSyA-1234567890abcdefghijklmnopqrstu'

describe('key shape', () => {
  it('uses a lower-case header name', () => {
    expect(GEMINI_KEY_HEADER).toBe(GEMINI_KEY_HEADER.toLowerCase())
  })

  it('accepts a key-like string', () => {
    expect(isPlausibleGeminiKey(KEY)).toBe(true)
    expect(isPlausibleGeminiKey('A'.repeat(20))).toBe(true)
    expect(isPlausibleGeminiKey('A'.repeat(200))).toBe(true)
  })

  it.each([
    ['too short', 'AIza123'],
    ['too long', 'A'.repeat(201)],
    ['a space', 'AIzaSyA 1234567890abcdefghijklmnop'],
    ['a line break', 'AIzaSyA-1234567890abcdef\nghijklmnop'],
    ['a quote', '"AIzaSyA-1234567890abcdefghijklmnop"'],
    ['a slash', 'AIzaSyA/1234567890abcdefghijklmnop'],
    ['empty', ''],
  ])('rejects a string that is %s', (_why, value) => {
    expect(isPlausibleGeminiKey(value)).toBe(false)
  })

  it('cleans what people paste around a key', () => {
    expect(normalizeKeyInput(`  ${KEY}\n`)).toBe(KEY)
    expect(normalizeKeyInput(`"${KEY}"`)).toBe(KEY)
    expect(normalizeKeyInput(`'${KEY}'`)).toBe(KEY)
    expect(normalizeKeyInput(' " ' + KEY + ' " ')).toBe(KEY)
  })

  it('masks all but the ends', () => {
    expect(maskKey(KEY)).toBe('AIza...pqrstu'.replace('pqrstu', KEY.slice(-4)))
    expect(maskKey(KEY)).not.toContain(KEY.slice(8, 30))
    expect(maskKey('short')).toBe('*****')
  })
})

describe('stored key state', () => {
  it('recognises valid states, including a removal', () => {
    expect(isStoredKey({ key: KEY, updatedAt: 5 })).toBe(true)
    expect(isStoredKey({ key: null, updatedAt: 5 })).toBe(true)
    expect(isStoredKey(EMPTY_KEY_STATE)).toBe(true)
  })

  it.each([
    null,
    undefined,
    'x',
    {},
    { key: KEY },
    { key: 'bad key', updatedAt: 1 },
    { key: KEY, updatedAt: -1 },
    { key: KEY, updatedAt: NaN },
    { key: 5, updatedAt: 1 },
  ])('rejects %j', (value) => {
    expect(isStoredKey(value)).toBe(false)
  })

  it('the newer change wins, and a removal beats an older key', () => {
    const old = { key: KEY, updatedAt: 10 }
    const removed = { key: null, updatedAt: 20 }
    expect(pickNewer(old, removed)).toBe(removed)
    expect(pickNewer(removed, old)).toBe(removed)
    const newer = { key: KEY.replace('AIza', 'BIza'), updatedAt: 30 }
    expect(pickNewer(removed, newer)).toBe(newer)
  })

  it('keeps the first on a tie, and the empty state loses to any change', () => {
    const a = { key: KEY, updatedAt: 10 }
    const b = { key: null, updatedAt: 10 }
    expect(pickNewer(a, b)).toBe(a)
    expect(pickNewer(EMPTY_KEY_STATE, a)).toBe(a)
  })
})

describe('bridge messages', () => {
  const state = { key: KEY, updatedAt: 7 }

  it('reads a page message', () => {
    expect(parsePageMessage({ source: BRIDGE_PAGE_SOURCE, type: 'hello', state })).toEqual({
      source: BRIDGE_PAGE_SOURCE,
      type: 'hello',
      state,
    })
    expect(parsePageMessage({ source: BRIDGE_PAGE_SOURCE, type: 'set', state })?.type).toBe('set')
  })

  it('reads an extension message', () => {
    expect(parseExtensionMessage({ source: BRIDGE_EXTENSION_SOURCE, type: 'present' })).toEqual({
      source: BRIDGE_EXTENSION_SOURCE,
      type: 'present',
    })
    expect(
      parseExtensionMessage({ source: BRIDGE_EXTENSION_SOURCE, type: 'state', state }),
    ).toMatchObject({ type: 'state', state })
  })

  it('ignores anything else, and a message from the wrong side', () => {
    expect(parsePageMessage(null)).toBeNull()
    expect(parsePageMessage('hello')).toBeNull()
    expect(parsePageMessage({ source: 'other', type: 'hello', state })).toBeNull()
    expect(parsePageMessage({ source: BRIDGE_PAGE_SOURCE, type: 'nope', state })).toBeNull()
    expect(
      parsePageMessage({ source: BRIDGE_PAGE_SOURCE, type: 'set', state: { key: 'x' } }),
    ).toBeNull()
    expect(parsePageMessage({ source: BRIDGE_EXTENSION_SOURCE, type: 'state', state })).toBeNull()
    expect(parseExtensionMessage({ source: BRIDGE_PAGE_SOURCE, type: 'present' })).toBeNull()
    expect(parseExtensionMessage({ source: BRIDGE_EXTENSION_SOURCE, type: 'state' })).toBeNull()
    expect(
      parseExtensionMessage({
        source: BRIDGE_EXTENSION_SOURCE,
        type: 'state',
        state: { key: 'bad', updatedAt: 1 },
      }),
    ).toBeNull()
  })
})
