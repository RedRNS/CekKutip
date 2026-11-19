import {
  BRIDGE_PAGE_SOURCE,
  KEY_STORAGE_NAME,
  isPlausibleGeminiKey,
  normalizeKeyInput,
  parseExtensionMessage,
  parseStoredKey,
} from '@cekkutip/shared/apikey'
import type { PageMessage, StoredKey } from '@cekkutip/shared/apikey'
import { useSyncExternalStore } from 'react'

/**
 * The person's own Gemini key, kept in this browser. Nothing here talks to the network: the key is
 * handed to the check request by the caller, and shared with the CekKutip browser extension (if the
 * person has it) through the extension's page bridge. Whichever side changed the key last wins.
 */

export { KEY_STORAGE_NAME }

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface KeyStore {
  getState(): StoredKey
  /** True once the extension has answered on this page. */
  isConnected(): boolean
  subscribe(listener: () => void): () => void
  /** Validate and keep a key typed or pasted by the person. */
  save(raw: string): 'ok' | 'invalid'
  clear(): void
  /** A message from the extension's bridge. Anything that is not one is ignored. */
  receive(data: unknown): void
  /** Another tab of this site changed the stored key. */
  reload(): void
  /** Say hello to the extension, with the key held here. */
  hello(): void
}

export interface KeyStoreDeps {
  /** Null when storage is blocked: the key then lasts for this visit only. */
  storage: KeyStorage | null
  post?: (message: PageMessage) => void
  now?: () => number
}

function readStored(storage: KeyStorage | null): StoredKey {
  try {
    return parseStoredKey(storage?.getItem(KEY_STORAGE_NAME))
  } catch {
    return parseStoredKey(null)
  }
}

export function createKeyStore(deps: KeyStoreDeps): KeyStore {
  const now = deps.now ?? Date.now
  let state = readStored(deps.storage)
  let connected = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  const persist = () => {
    try {
      deps.storage?.setItem(KEY_STORAGE_NAME, JSON.stringify(state))
    } catch {
      /* storage can be full or blocked: the key still works for this visit */
    }
  }

  /** Take a state from elsewhere only if it is newer than what is held. */
  const adopt = (next: StoredKey) => {
    if (next.updatedAt <= state.updatedAt) return
    state = next
    persist()
    emit()
  }

  const change = (key: string | null) => {
    // Never go backwards in time, even if the clock does.
    state = { key, updatedAt: Math.max(now(), state.updatedAt + 1) }
    persist()
    deps.post?.({ source: BRIDGE_PAGE_SOURCE, type: 'set', state })
    emit()
  }

  return {
    getState: () => state,
    isConnected: () => connected,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    save(raw) {
      const key = normalizeKeyInput(raw)
      if (!isPlausibleGeminiKey(key)) return 'invalid'
      change(key)
      return 'ok'
    },
    clear() {
      if (state.key === null) return
      change(null)
    },
    receive(data) {
      const message = parseExtensionMessage(data)
      if (message === null) return
      if (!connected) {
        connected = true
        emit()
      }
      if (message.type === 'present') {
        // The extension may have been ready before this page was: tell it what is held here.
        deps.post?.({ source: BRIDGE_PAGE_SOURCE, type: 'hello', state })
        return
      }
      if (message.state) adopt(message.state)
    },
    reload() {
      adopt(readStored(deps.storage))
    },
    hello() {
      deps.post?.({ source: BRIDGE_PAGE_SOURCE, type: 'hello', state })
    },
  }
}

// ---------- The one store this app uses ----------

function browserStorage(): KeyStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Created on first use, so importing this module never touches the browser. */
let singleton: KeyStore | null = null
export function getKeyStore(): KeyStore {
  singleton ??= createKeyStore({
    storage: browserStorage(),
    post: (message) => window.postMessage(message, window.location.origin),
  })
  return singleton
}

/**
 * Start listening: messages from the extension's bridge, and changes made in another tab.
 * A message counts only if this same window sent it, from this site's own origin.
 */
export function startKeySync(): void {
  const store = getKeyStore()
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) return
    store.receive(event.data)
  })
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === KEY_STORAGE_NAME) store.reload()
  })
  store.hello()
}

export interface ApiKeyView {
  key: string | null
  /** The extension answered on this page. */
  connected: boolean
  save: (raw: string) => 'ok' | 'invalid'
  clear: () => void
}

/** The view of a key store that the tool needs. The website passes its own store; the extension, its. */
export function useKeyStore(store: KeyStore): ApiKeyView {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const connected = useSyncExternalStore(store.subscribe, store.isConnected)
  return { key: state.key, connected, save: store.save, clear: store.clear }
}

export function useApiKey(): ApiKeyView {
  return useKeyStore(getKeyStore())
}
