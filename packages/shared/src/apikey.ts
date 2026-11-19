/**
 * A person's own Gemini API key, and how the website and the browser extension keep it in step.
 *
 * The key belongs to the person who typed it. It is kept in their browser (the website's local
 * storage, the extension's local storage) and sent to the CekKutip server in one request header
 * so the server can read the references with the person's quota instead of the shared one.
 * The server uses it for that request only. It never stores it and never writes it to a log.
 */

/** The request header that carries the key. Lower case, as Node reports it. */
export const GEMINI_KEY_HEADER = 'x-gemini-key'

export const MIN_KEY_LENGTH = 20
export const MAX_KEY_LENGTH = 200

/** Letters, digits, and the few symbols that appear in Google API keys. No spaces, no quotes. */
const KEY_SHAPE = /^[A-Za-z0-9._~-]+$/

/** Trim what people paste along with a key: spaces, line breaks, and wrapping quotes. */
export function normalizeKeyInput(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()
}

/**
 * Whether a string could be a key. This catches pasted junk early, before anything is sent.
 * It does not say the key works: only Google can say that.
 */
export function isPlausibleGeminiKey(value: string): boolean {
  return value.length >= MIN_KEY_LENGTH && value.length <= MAX_KEY_LENGTH && KEY_SHAPE.test(value)
}

/** Hide the middle of a key for display: the first four and last four characters. */
export function maskKey(key: string): string {
  return key.length <= 12 ? '*'.repeat(key.length) : `${key.slice(0, 4)}...${key.slice(-4)}`
}

// ---------- Keeping the website and the extension in step ----------

/**
 * What one side holds. `key: null` with a time means "removed on purpose": the time lets a removal
 * travel to the other side instead of the other side's old copy coming back.
 */
export interface StoredKey {
  key: string | null
  /** Milliseconds since the epoch, when this side last changed the key. 0 means never. */
  updatedAt: number
}

export const EMPTY_KEY_STATE: StoredKey = { key: null, updatedAt: 0 }

export function isStoredKey(value: unknown): value is StoredKey {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { key?: unknown; updatedAt?: unknown }
  const keyOk = v.key === null || (typeof v.key === 'string' && isPlausibleGeminiKey(v.key))
  return (
    keyOk && typeof v.updatedAt === 'number' && Number.isFinite(v.updatedAt) && v.updatedAt >= 0
  )
}

/** The name under which a side keeps its key, in the website's local storage and the extension's. */
export const KEY_STORAGE_NAME = 'cekkutip.geminiKey'

/** Read a stored value (a JSON string). Anything that is not a valid state reads as "never set". */
export function parseStoredKey(raw: unknown): StoredKey {
  if (typeof raw !== 'string' || raw === '') return EMPTY_KEY_STATE
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStoredKey(parsed) ? parsed : EMPTY_KEY_STATE
  } catch {
    return EMPTY_KEY_STATE
  }
}

/** The more recently changed of two states. On a tie, `a` stays. */
export function pickNewer(a: StoredKey, b: StoredKey): StoredKey {
  return b.updatedAt > a.updatedAt ? b : a
}

export const BRIDGE_PAGE_SOURCE = 'cekkutip-web'
export const BRIDGE_EXTENSION_SOURCE = 'cekkutip-extension'

/** Page to extension. `hello` announces the page and its key; `set` reports a change made on the page. */
export interface PageMessage {
  source: typeof BRIDGE_PAGE_SOURCE
  type: 'hello' | 'set'
  state: StoredKey
}

/** Extension to page. `present` says the extension is there; `state` carries the newest key it knows. */
export interface ExtensionMessage {
  source: typeof BRIDGE_EXTENSION_SOURCE
  type: 'present' | 'state'
  state?: StoredKey
}

export function parsePageMessage(data: unknown): PageMessage | null {
  if (typeof data !== 'object' || data === null) return null
  const m = data as { source?: unknown; type?: unknown; state?: unknown }
  if (m.source !== BRIDGE_PAGE_SOURCE) return null
  if (m.type !== 'hello' && m.type !== 'set') return null
  if (!isStoredKey(m.state)) return null
  return { source: BRIDGE_PAGE_SOURCE, type: m.type, state: m.state }
}

export function parseExtensionMessage(data: unknown): ExtensionMessage | null {
  if (typeof data !== 'object' || data === null) return null
  const m = data as { source?: unknown; type?: unknown; state?: unknown }
  if (m.source !== BRIDGE_EXTENSION_SOURCE) return null
  if (m.type === 'present') return { source: BRIDGE_EXTENSION_SOURCE, type: 'present' }
  if (m.type === 'state' && isStoredKey(m.state)) {
    return { source: BRIDGE_EXTENSION_SOURCE, type: 'state', state: m.state }
  }
  return null
}
