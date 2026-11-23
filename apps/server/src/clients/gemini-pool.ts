import { ServiceUnavailableError } from '../lib/http.js'
import type { GeminiClient } from './gemini.js'

/**
 * The server's own Gemini keys as one reader. Keys are tried in order. A key that hits its limit or
 * is refused is skipped for a while and the next key answers instead; once the wait is over the
 * earlier key is tried first again. Nothing else moves on to the next key (a timeout or a server
 * error is not the key's fault). Only the clients are held here, never the keys themselves.
 */

export interface GeminiPoolOptions {
  /** How long a key that hit its limit or was refused is skipped. */
  cooldownMs: number
  /** Replaces the clock in tests. */
  now?: () => number
}

/** Failures that belong to one key, so another key may well work. */
const KEY_CODES = new Set<string>(['rate_limited', 'blocked'])

export function createGeminiPool(clients: GeminiClient[], opts: GeminiPoolOptions): GeminiClient {
  if (clients.length === 0) throw new Error('A Gemini key pool needs at least one client.')
  const now = opts.now ?? Date.now
  const slots = clients.map((client) => ({
    client,
    /** Skipped until this time. */
    until: 0,
    /** Why it failed last. */
    error: null as ServiceUnavailableError | null,
  }))

  return {
    async extract(items) {
      for (const slot of slots) {
        if (now() < slot.until) continue
        try {
          return await slot.client.extract(items)
        } catch (err) {
          if (!(err instanceof ServiceUnavailableError) || !KEY_CODES.has(err.code)) throw err
          slot.until = now() + opts.cooldownMs
          slot.error = err
        }
      }
      // No key answered: each one failed just now or is still being skipped. The first key's error
      // stands, so what a visitor is told follows the key that is meant to carry the load.
      throw slots[0]?.error ?? new ServiceUnavailableError('gemini', 'network')
    },
  }
}
