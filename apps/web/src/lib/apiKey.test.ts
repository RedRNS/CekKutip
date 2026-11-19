import { BRIDGE_EXTENSION_SOURCE, BRIDGE_PAGE_SOURCE } from '@cekkutip/shared/apikey'
import type { PageMessage } from '@cekkutip/shared/apikey'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkReducer, initialCheckState } from '../state/check'
import { fetchConfig, streamCheck, toClientCode } from './api'
import { KEY_STORAGE_NAME, createKeyStore } from './apiKey'

const KEY = 'AIzaSyA-1234567890abcdefghijklmnopqrstu'
const OTHER = 'AIzaSyB-0987654321zyxwvutsrqponmlkjihgf'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

function setup(initial: Record<string, string> = {}, start = 1000) {
  const storage = memoryStorage(initial)
  const sent: PageMessage[] = []
  let clock = start
  const store = createKeyStore({ storage, post: (m) => sent.push(m), now: () => clock })
  return { store, storage, sent, tick: (ms = 10) => (clock += ms) }
}

const fromExtension = (state: { key: string | null; updatedAt: number }) => ({
  source: BRIDGE_EXTENSION_SOURCE,
  type: 'state',
  state,
})

describe('key store', () => {
  it('starts empty, and reads a stored key', () => {
    expect(setup().store.getState()).toEqual({ key: null, updatedAt: 0 })
    const stored = JSON.stringify({ key: KEY, updatedAt: 500 })
    expect(setup({ [KEY_STORAGE_NAME]: stored }).store.getState()).toEqual({
      key: KEY,
      updatedAt: 500,
    })
  })

  it.each(['not json', '{"key":"bad key","updatedAt":1}', '{"key":"x"}', '[]', 'null'])(
    'starts empty when the stored value is %s',
    (raw) => {
      expect(setup({ [KEY_STORAGE_NAME]: raw }).store.getState().key).toBeNull()
    },
  )

  it('works when storage is blocked', () => {
    const store = createKeyStore({ storage: null, now: () => 5 })
    expect(store.save(KEY)).toBe('ok')
    expect(store.getState().key).toBe(KEY)
  })

  it('saves a valid key: keeps it, persists it, tells the extension, and wakes listeners', () => {
    const { store, storage, sent } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.save(`  "${KEY}"  `)).toBe('ok')
    expect(store.getState()).toEqual({ key: KEY, updatedAt: 1000 })
    expect(JSON.parse(storage.data.get(KEY_STORAGE_NAME) as string)).toEqual({
      key: KEY,
      updatedAt: 1000,
    })
    expect(sent).toEqual([
      { source: BRIDGE_PAGE_SOURCE, type: 'set', state: { key: KEY, updatedAt: 1000 } },
    ])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('refuses something that cannot be a key and changes nothing', () => {
    const { store, sent } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.save('hello there')).toBe('invalid')
    expect(store.save('')).toBe('invalid')
    expect(store.getState().key).toBeNull()
    expect(sent).toEqual([])
    expect(listener).not.toHaveBeenCalled()
  })

  it('removes the key as a recorded change, so the removal can travel', () => {
    const { store, sent, tick } = setup()
    store.save(KEY)
    tick()
    store.clear()
    expect(store.getState()).toEqual({ key: null, updatedAt: 1010 })
    expect(sent.at(-1)).toEqual({
      source: BRIDGE_PAGE_SOURCE,
      type: 'set',
      state: { key: null, updatedAt: 1010 },
    })
  })

  it('does nothing when asked to remove a key it does not hold', () => {
    const { store, sent } = setup()
    store.clear()
    expect(sent).toEqual([])
  })

  it('never lets a change go back in time, even if the clock does', () => {
    const { store } = setup({}, 5000)
    store.save(KEY)
    const first = store.getState().updatedAt
    const slow = createKeyStore({ storage: memoryStorage(), now: () => 1 })
    slow.save(KEY)
    slow.save(OTHER)
    expect(slow.getState().updatedAt).toBeGreaterThan(1)
    expect(first).toBe(5000)
  })

  it('stops calling a listener after it unsubscribes', () => {
    const { store } = setup()
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.save(KEY)
    off()
    store.clear()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('talking to the extension', () => {
  it('says hello with what it holds', () => {
    const { store, sent } = setup({
      [KEY_STORAGE_NAME]: JSON.stringify({ key: KEY, updatedAt: 7 }),
    })
    store.hello()
    expect(sent).toEqual([
      { source: BRIDGE_PAGE_SOURCE, type: 'hello', state: { key: KEY, updatedAt: 7 } },
    ])
  })

  it('takes a newer key from the extension, saves it, and counts the extension as connected', () => {
    const { store, storage } = setup()
    expect(store.isConnected()).toBe(false)
    const listener = vi.fn()
    store.subscribe(listener)
    store.receive(fromExtension({ key: KEY, updatedAt: 2000 }))
    expect(store.getState()).toEqual({ key: KEY, updatedAt: 2000 })
    expect(JSON.parse(storage.data.get(KEY_STORAGE_NAME) as string).key).toBe(KEY)
    expect(store.isConnected()).toBe(true)
    expect(listener).toHaveBeenCalled()
  })

  it('keeps its own newer key against an older one from the extension', () => {
    const { store } = setup({ [KEY_STORAGE_NAME]: JSON.stringify({ key: OTHER, updatedAt: 9000 }) })
    store.receive(fromExtension({ key: KEY, updatedAt: 100 }))
    expect(store.getState().key).toBe(OTHER)
  })

  it('takes a removal from the extension', () => {
    const { store } = setup({ [KEY_STORAGE_NAME]: JSON.stringify({ key: KEY, updatedAt: 100 }) })
    store.receive(fromExtension({ key: null, updatedAt: 200 }))
    expect(store.getState()).toEqual({ key: null, updatedAt: 200 })
  })

  it('does not send anything back when it takes a key (no echo loop)', () => {
    const { store, sent } = setup()
    store.receive(fromExtension({ key: KEY, updatedAt: 2000 }))
    expect(sent).toEqual([])
  })

  it('answers "present" with a hello, once per message, and never with another "present"', () => {
    const { store, sent } = setup()
    store.receive({ source: BRIDGE_EXTENSION_SOURCE, type: 'present' })
    expect(sent).toEqual([
      { source: BRIDGE_PAGE_SOURCE, type: 'hello', state: { key: null, updatedAt: 0 } },
    ])
    expect(store.isConnected()).toBe(true)
  })

  it.each([
    null,
    'text',
    { source: 'other', type: 'state', state: { key: KEY, updatedAt: 9 } },
    { source: BRIDGE_PAGE_SOURCE, type: 'state', state: { key: KEY, updatedAt: 9 } },
    fromExtension({ key: 'bad key', updatedAt: 9 }),
  ])('ignores %j', (data) => {
    const { store, sent } = setup()
    store.receive(data)
    expect(store.getState().key).toBeNull()
    expect(store.isConnected()).toBe(false)
    expect(sent).toEqual([])
  })

  it('picks up a change made in another tab of the same site', () => {
    const { store, storage } = setup()
    storage.data.set(KEY_STORAGE_NAME, JSON.stringify({ key: KEY, updatedAt: 3000 }))
    store.reload()
    expect(store.getState().key).toBe(KEY)
  })
})

describe('the request carries the key', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stubFetch = () => {
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        const body = `${JSON.stringify({ type: 'started', total: 1 })}\n${JSON.stringify({
          type: 'done',
          summary: { total: 1 },
        })}\n`
        return new Response(body, { status: 200 })
      }),
    )
    return calls
  }
  const run = (parseMode: 'llm' | 'regex', options = {}) =>
    streamCheck(['a'], parseMode, () => {}, new AbortController().signal, options)
  const headerOf = (c: { init: RequestInit }) => c.init.headers as Record<string, string>

  it('sends the key in one header, for the AI reader only', async () => {
    const calls = stubFetch()
    await run('llm', { key: KEY })
    expect(headerOf(calls[0] as never)['x-gemini-key']).toBe(KEY)
  })

  it('sends no key with the no-AI reader, nor when there is no key', async () => {
    const calls = stubFetch()
    await run('regex', { key: KEY })
    await run('llm', { key: null })
    await run('llm')
    for (const c of calls) expect(headerOf(c)).not.toHaveProperty('x-gemini-key')
  })

  it('never puts the key in the URL or the body', async () => {
    const calls = stubFetch()
    await run('llm', { key: KEY })
    expect(calls[0]?.url).not.toContain(KEY)
    expect(String(calls[0]?.init.body)).not.toContain(KEY)
  })

  it('goes to the server named by the extension, or to the site itself', async () => {
    const calls = stubFetch()
    await run('llm', { baseUrl: 'https://example.test' })
    await run('llm')
    expect(calls.map((c) => c.url)).toEqual(['https://example.test/api/check', '/api/check'])
  })

  it('asks the named server for its config', async () => {
    const calls = stubFetch()
    await fetchConfig(undefined, { baseUrl: 'https://example.test' })
    expect(calls[0]?.url).toBe('https://example.test/api/config')
  })
})

describe('what the page does with the answer', () => {
  it('knows a refused key by its code', () => {
    expect(toClientCode(400, 'invalid_api_key')).toBe('invalid_api_key')
  })

  it('remembers whether a check used the own key', () => {
    const own = checkReducer(initialCheckState, {
      type: 'start',
      references: ['a'],
      parseMode: 'llm',
      ownKey: true,
    })
    expect(own.ownKey).toBe(true)
    const shared = checkReducer(initialCheckState, {
      type: 'start',
      references: ['a'],
      parseMode: 'llm',
    })
    expect(shared.ownKey).toBe(false)
  })
})
