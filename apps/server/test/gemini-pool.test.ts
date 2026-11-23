import { describe, expect, it, vi } from 'vitest'
import type { GeminiClient } from '../src/clients/gemini.js'
import { createGeminiPool } from '../src/clients/gemini-pool.js'
import { ServiceUnavailableError } from '../src/lib/http.js'

/**
 * Backup keys: the server's own Gemini keys are tried in order, and a key that is at its limit or
 * refused is skipped for a while. Only a key's own failures move on to the next key.
 */

type Code = ConstructorParameters<typeof ServiceUnavailableError>[1]

const ITEMS = [{ i: 0, text: 'a reference' }]
const answer = (tag: string) => ({
  results: [{ tag }],
  usage: { inputTokens: 0, outputTokens: 0 },
})

/** A key that works, and records how often it was asked. */
function working(tag: string) {
  const extract = vi.fn<GeminiClient['extract']>(async () => answer(tag))
  return { client: { extract } as GeminiClient, extract }
}

/** A key that fails with the given code until `heal()` is called. */
function failing(code: Code, status?: number, tag = 'healed') {
  let broken = true
  const extract = vi.fn<GeminiClient['extract']>(async () => {
    if (broken) throw new ServiceUnavailableError('gemini', code, status)
    return answer(tag)
  })
  return {
    client: { extract } as GeminiClient,
    extract,
    heal: () => {
      broken = false
    },
  }
}

const COOL = 1000
function clock() {
  let t = 0
  return { now: () => t, set: (n: number) => void (t = n) }
}
const poolOf = (clients: GeminiClient[], c = clock()) => ({
  pool: createGeminiPool(clients, { cooldownMs: COOL, now: c.now }),
  clock: c,
})

describe('createGeminiPool', () => {
  it('uses the first key while it works', async () => {
    const a = working('a')
    const b = working('b')
    const out = await poolOf([a.client, b.client]).pool.extract(ITEMS)
    expect(out.results).toEqual([{ tag: 'a' }])
    expect(a.extract).toHaveBeenCalledTimes(1)
    expect(b.extract).not.toHaveBeenCalled()
  })

  it('moves to the next key when one is at its limit', async () => {
    const a = failing('rate_limited', 429)
    const b = working('b')
    const out = await poolOf([a.client, b.client]).pool.extract(ITEMS)
    expect(out.results).toEqual([{ tag: 'b' }])
    expect(a.extract).toHaveBeenCalledTimes(1)
    expect(b.extract).toHaveBeenCalledTimes(1)
  })

  it('moves to the next key when one is refused', async () => {
    const a = failing('blocked', 403)
    const b = working('b')
    const out = await poolOf([a.client, b.client]).pool.extract(ITEMS)
    expect(out.results).toEqual([{ tag: 'b' }])
  })

  it.each(['timeout', 'network', 'server_error', 'bad_response'] as const)(
    "does not move on for failures that are not the key's fault (%s)",
    async (code) => {
      const a = failing(code)
      const b = working('b')
      const { pool } = poolOf([a.client, b.client])
      await expect(pool.extract(ITEMS)).rejects.toMatchObject({ code })
      expect(b.extract).not.toHaveBeenCalled()
      // The key was not marked, so the next request asks it again.
      await expect(pool.extract(ITEMS)).rejects.toMatchObject({ code })
      expect(a.extract).toHaveBeenCalledTimes(2)
    },
  )

  it('rethrows an error that is not a service error, without moving on', async () => {
    const boom = new Error('bug')
    const a = { extract: vi.fn(async () => Promise.reject(boom)) } as unknown as GeminiClient
    const b = working('b')
    await expect(poolOf([a, b.client]).pool.extract(ITEMS)).rejects.toBe(boom)
    expect(b.extract).not.toHaveBeenCalled()
  })

  it('skips a key that just failed, for the cooldown', async () => {
    const a = failing('rate_limited', 429)
    const b = working('b')
    const { pool, clock: c } = poolOf([a.client, b.client])
    await pool.extract(ITEMS)
    c.set(COOL - 1)
    await pool.extract(ITEMS)
    expect(a.extract).toHaveBeenCalledTimes(1)
    expect(b.extract).toHaveBeenCalledTimes(2)
  })

  it('tries a failed key again once its cooldown has passed', async () => {
    const a = failing('rate_limited', 429, 'a')
    const b = working('b')
    const { pool, clock: c } = poolOf([a.client, b.client])
    await pool.extract(ITEMS)
    a.heal()
    c.set(COOL)
    const out = await pool.extract(ITEMS)
    expect(out.results).toEqual([{ tag: 'a' }])
    expect(a.extract).toHaveBeenCalledTimes(2)
    expect(b.extract).toHaveBeenCalledTimes(1)
  })

  it("rethrows the first key's error when every key fails", async () => {
    const first = poolOf([
      failing('rate_limited', 429).client,
      failing('blocked', 403).client,
      failing('rate_limited', 429).client,
    ])
    await expect(first.pool.extract(ITEMS)).rejects.toMatchObject({ code: 'rate_limited' })

    const second = poolOf([failing('blocked', 403).client, failing('rate_limited', 429).client])
    await expect(second.pool.extract(ITEMS)).rejects.toMatchObject({ code: 'blocked' })
  })

  it('answers from memory, without calling anyone, while every key is cooling', async () => {
    const a = failing('rate_limited', 429)
    const b = failing('blocked', 403)
    const { pool, clock: c } = poolOf([a.client, b.client])
    await expect(pool.extract(ITEMS)).rejects.toMatchObject({ code: 'rate_limited' })
    c.set(COOL - 1)
    await expect(pool.extract(ITEMS)).rejects.toMatchObject({ code: 'rate_limited' })
    expect(a.extract).toHaveBeenCalledTimes(1)
    expect(b.extract).toHaveBeenCalledTimes(1)
  })

  it('serves two requests at once while the first key is failing', async () => {
    const a = failing('rate_limited', 429)
    const b = working('b')
    const { pool } = poolOf([a.client, b.client])
    const both = await Promise.all([pool.extract(ITEMS), pool.extract(ITEMS)])
    expect(both.map((o) => o.results)).toEqual([[{ tag: 'b' }], [{ tag: 'b' }]])
  })

  it('refuses an empty list', () => {
    expect(() => createGeminiPool([], { cooldownMs: COOL })).toThrow()
  })
})
