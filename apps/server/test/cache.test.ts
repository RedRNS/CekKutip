import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CacheMissError, LruTtlCache, RetrievalCache, hashKey } from '../src/lib/cache.js'

describe('hashKey', () => {
  it('is stable and ignores case, punctuation, and spacing', () => {
    expect(hashKey('Attention Is All You Need!', 'Vaswani', 2017)).toBe(
      hashKey('  attention is all you need', 'vaswani', '2017'),
    )
  })

  it('differs for different input and does not contain the input', () => {
    const a = hashKey('title one', 'x')
    expect(a).not.toBe(hashKey('title two', 'x'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('separates parts so ("ab","c") differs from ("a","bc")', () => {
    expect(hashKey('ab', 'c')).not.toBe(hashKey('a', 'bc'))
  })
})

describe('LruTtlCache', () => {
  it('evicts the least recently used entry', () => {
    const c = new LruTtlCache<number>(2)
    c.set('a', 1)
    c.set('b', 2)
    c.get('a') // a is now most recent
    c.set('c', 3)
    expect(c.get('b')).toBeUndefined()
    expect(c.get('a')).toBe(1)
    expect(c.get('c')).toBe(3)
  })

  it('expires entries after the TTL', () => {
    let t = 0
    const c = new LruTtlCache<string>(10, 1000, () => t)
    c.set('k', 'v')
    t = 999
    expect(c.get('k')).toBe('v')
    t = 1000
    expect(c.get('k')).toBeUndefined()
    expect(c.size).toBe(0)
  })
})

describe('RetrievalCache', () => {
  let dir: string | undefined
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('loads once and serves later reads from memory', async () => {
    const c = new RetrievalCache()
    let loads = 0
    const load = async () => (++loads, { title: 'T' })
    expect(await c.wrap('k', load)).toEqual({ title: 'T' })
    expect(await c.wrap('k', load)).toEqual({ title: 'T' })
    expect(loads).toBe(1)
  })

  it('caches falsy but defined values such as null (a recorded "not found")', async () => {
    const c = new RetrievalCache()
    let loads = 0
    await c.wrap('k', async () => (++loads, null))
    await c.wrap('k', async () => (++loads, null))
    expect(loads).toBe(1)
  })

  it('does not cache a failed load', async () => {
    const c = new RetrievalCache()
    await expect(c.wrap('k', async () => Promise.reject(new Error('down')))).rejects.toThrow('down')
    expect(await c.wrap('k', async () => 'recovered')).toBe('recovered')
  })

  it('records to files and replays them in a fresh instance', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cekkutip-cache-'))
    const key = hashKey('some title', 'author')
    await new RetrievalCache({ dir }).wrap(key, async () => ({ doi: '10.1/x' }))

    const replay = new RetrievalCache({ dir, replayOnly: true })
    expect(
      await replay.wrap(key, async () => Promise.reject(new Error('network must not be used'))),
    ).toEqual({
      doi: '10.1/x',
    })
  })

  it('throws CacheMissError in replay-only mode when nothing was recorded', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cekkutip-cache-'))
    const replay = new RetrievalCache({ dir, replayOnly: true })
    await expect(replay.wrap('missing', async () => 'x')).rejects.toBeInstanceOf(CacheMissError)
  })

  it('writes only the hashed key and the public value to disk', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cekkutip-cache-'))
    const rawTitle = 'A very private thesis title'
    const key = hashKey(rawTitle)
    await new RetrievalCache({ dir }).wrap(key, async () => ({ title: 'Public record title' }))
    const [file] = await readdir(dir)
    expect(file).toBe(`${key}.json`)
    const content = await readFile(path.join(dir, file as string), 'utf8')
    expect(content).not.toContain(rawTitle)
    expect(file).not.toContain('private')
  })
})
