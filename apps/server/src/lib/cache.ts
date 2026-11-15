import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizeText } from './normalize.js'

/** Stable cache key: SHA-256 of the normalized parts. The raw text is never stored in a key. */
export function hashKey(...parts: (string | number | null | undefined)[]): string {
  const joined = parts.map((p) => normalizeText(String(p ?? ''))).join('\u001f')
  return createHash('sha256').update(joined).digest('hex')
}

/** In-memory LRU with a time-to-live. Holds public metadata only. */
export class LruTtlCache<V> {
  private readonly map = new Map<string, { value: V; expires: number }>()

  constructor(
    private readonly maxEntries = 1000,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (hit.expires <= this.now()) {
      this.map.delete(key)
      return undefined
    }
    // Refresh recency: re-insert at the end.
    this.map.delete(key)
    this.map.set(key, hit)
    return hit.value
  }

  set(key: string, value: V): void {
    this.map.delete(key)
    this.map.set(key, { value, expires: this.now() + this.ttlMs })
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  get size(): number {
    return this.map.size
  }
}

export class CacheMissError extends Error {
  constructor() {
    super('Retrieval cache miss in replay-only mode')
    this.name = 'CacheMissError'
  }
}

export interface RetrievalCacheOptions {
  /** Directory for the file cache (RETRIEVAL_CACHE_DIR). Omit for memory only. */
  dir?: string
  /** Never touch the network: a miss throws CacheMissError. For repeatable evaluation runs. */
  replayOnly?: boolean
  maxEntries?: number
  ttlMs?: number
  now?: () => number
}

/**
 * Two layers: memory LRU (24 h) in front of an optional file store.
 * Values are public bibliographic metadata, keyed by a hash of the normalized query.
 * The file store is for the evaluation harness (record once, replay for free and identically).
 */
export class RetrievalCache {
  private readonly memory: LruTtlCache<unknown>
  private readonly dir: string | undefined
  readonly replayOnly: boolean

  constructor(opts: RetrievalCacheOptions = {}) {
    this.memory = new LruTtlCache(
      opts.maxEntries ?? 1000,
      opts.ttlMs ?? 24 * 60 * 60 * 1000,
      opts.now,
    )
    this.dir = opts.dir
    this.replayOnly = opts.replayOnly ?? false
  }

  async get<V>(key: string): Promise<V | undefined> {
    const mem = this.memory.get(key)
    if (mem !== undefined) return mem as V
    if (this.dir) {
      try {
        const text = await readFile(this.file(key), 'utf8')
        const value = (JSON.parse(text) as { value: V }).value
        this.memory.set(key, value)
        return value
      } catch {
        /* not recorded yet, or unreadable: treat as a miss */
      }
    }
    return undefined
  }

  async set(key: string, value: unknown): Promise<void> {
    this.memory.set(key, value)
    if (this.dir) {
      await mkdir(this.dir, { recursive: true })
      await writeFile(this.file(key), JSON.stringify({ value }), 'utf8')
    }
  }

  /** Read through the cache; on a miss run `load`, store the result, and return it. */
  async wrap<V>(key: string, load: () => Promise<V>): Promise<V> {
    const hit = await this.get<V>(key)
    if (hit !== undefined) return hit
    if (this.replayOnly) throw new CacheMissError()
    const value = await load()
    await this.set(key, value)
    return value
  }

  private file(key: string): string {
    return path.join(this.dir as string, `${key}.json`)
  }
}
