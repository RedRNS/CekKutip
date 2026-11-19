import {
  BRIDGE_EXTENSION_SOURCE,
  BRIDGE_PAGE_SOURCE,
  EMPTY_KEY_STATE,
  KEY_STORAGE_NAME,
  parseStoredKey,
} from '@cekkutip/shared/apikey'
import type { ExtensionMessage, PageMessage, StoredKey } from '@cekkutip/shared/apikey'
import { describe, expect, it } from 'vitest'
import { createKeyStore } from '../../apps/web/src/lib/apiKey'
import type { KeyStore } from '../../apps/web/src/lib/apiKey'
import { createBridgeCore } from '../src/bridge-core'

const KEY_A = 'AIzaSyA-1234567890abcdefghijklmnopqrstu'
const KEY_B = 'AIzaSyB-0987654321zyxwvutsrqponmlkjihgf'

/**
 * The website's store, the bridge, and the popup's store, wired the way the browser wires them:
 * the page talks to the bridge by messages, and the bridge and the popup share one storage.
 * Messages are delivered one at a time and counted, so a loop would show up as a runaway count.
 */
function world(opts: { start?: number } = {}) {
  let clock = opts.start ?? 1000
  const now = () => (clock += 1)
  let extension: StoredKey = EMPTY_KEY_STATE
  const toPage: ExtensionMessage[] = []
  const toBridge: PageMessage[] = []
  let pageOpen = false
  let page: KeyStore

  const pending: Promise<void>[] = []
  const bridge = createBridgeCore({
    read: async () => extension,
    write: async (state) => setExtension(state),
    post: (message) => {
      toPage.push(message)
      if (pageOpen) page.receive(message)
    },
  })

  /** The extension's storage changed: the popup and the bridge hear about it (chrome.storage.onChanged). */
  function setExtension(state: StoredKey) {
    extension = state
    popup?.reload()
    if (pageOpen) bridge.changed(state)
  }

  const pageStorage = new Map<string, string>()
  const makePage = () => {
    pageOpen = true
    page = createKeyStore({
      storage: {
        getItem: (k) => pageStorage.get(k) ?? null,
        setItem: (k, v) => void pageStorage.set(k, v),
        removeItem: (k) => void pageStorage.delete(k),
      },
      post: (message) => {
        toBridge.push(message)
        pending.push(bridge.fromPage(message))
      },
      now,
    })
    return page
  }

  const popup: KeyStore = createKeyStore({
    storage: {
      getItem: (k) =>
        k === KEY_STORAGE_NAME && extension.updatedAt > 0 ? JSON.stringify(extension) : null,
      setItem: (k, v) => {
        if (k === KEY_STORAGE_NAME) setExtension(parseStoredKey(v))
      },
      removeItem: () => {},
    },
    now,
  })

  return {
    popup,
    get page() {
      return page
    },
    /** The website is opened: its store starts and says hello, and the bridge announces itself. */
    async openPage() {
      makePage()
      page.hello()
      bridge.announce()
      await settle()
    },
    /** The website is closed: nothing more reaches it. Its own storage stays, as local storage does. */
    closePage() {
      pageOpen = false
    },
    /** The website is opened again later, reading what its storage kept. */
    async reopenPage() {
      await this.openPage()
    },
    settle,
    messageCount: () => toPage.length + toBridge.length,
    extension: () => extension,
    toPage,
  }

  async function settle() {
    // Messages can trigger more messages: wait until none are pending.
    for (let i = 0; i < 10; i++) {
      const before = pending.length
      await Promise.all(pending.splice(0))
      if (pending.length === 0 && before === 0) break
    }
  }
}

describe('a key saved in the extension', () => {
  it('shows up on the website when it is opened', async () => {
    const w = world()
    w.popup.save(KEY_A)
    await w.openPage()
    expect(w.page.getState().key).toBe(KEY_A)
    expect(w.page.isConnected()).toBe(true)
  })

  it('shows up on a website that is already open, at once', async () => {
    const w = world()
    await w.openPage()
    expect(w.page.getState().key).toBeNull()
    w.popup.save(KEY_A)
    await w.settle()
    expect(w.page.getState().key).toBe(KEY_A)
  })

  it('replaces an older key the website held', async () => {
    const w = world()
    await w.openPage()
    w.page.save(KEY_A)
    await w.settle()
    w.popup.save(KEY_B)
    await w.settle()
    expect(w.page.getState().key).toBe(KEY_B)
    expect(w.extension().key).toBe(KEY_B)
  })
})

describe('a key saved on the website', () => {
  it('reaches the extension as soon as it is saved', async () => {
    const w = world()
    await w.openPage()
    w.page.save(KEY_A)
    await w.settle()
    expect(w.extension().key).toBe(KEY_A)
    expect(w.popup.getState().key).toBe(KEY_A)
  })

  it('reaches the extension when the website held it from before the extension was installed', async () => {
    // The page already had a key in its storage when the bridge first met it; the extension is empty.
    let extension: StoredKey = EMPTY_KEY_STATE
    const replies: ExtensionMessage[] = []
    const core = createBridgeCore({
      read: async () => extension,
      write: async (s) => void (extension = s),
      post: (m) => replies.push(m),
    })
    const page = createKeyStore({
      storage: {
        getItem: () => JSON.stringify({ key: KEY_A, updatedAt: 500 }),
        setItem: () => {},
        removeItem: () => {},
      },
      post: (m) => void core.fromPage(m),
    })
    page.hello()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(extension).toEqual({ key: KEY_A, updatedAt: 500 })
    expect(replies.at(-1)).toMatchObject({ type: 'state', state: { key: KEY_A } })
  })
})

describe('removing the key', () => {
  it('on the website removes it from the extension, and the old copy does not come back', async () => {
    const w = world()
    w.popup.save(KEY_A)
    await w.openPage()
    expect(w.page.getState().key).toBe(KEY_A)
    w.page.clear()
    await w.settle()
    expect(w.extension().key).toBeNull()
    expect(w.popup.getState().key).toBeNull()
    // Closing and reopening the website must not bring the key back from either side.
    w.closePage()
    await w.reopenPage()
    expect(w.page.getState().key).toBeNull()
    expect(w.popup.getState().key).toBeNull()
  })

  it('in the extension removes it from the website', async () => {
    const w = world()
    await w.openPage()
    w.page.save(KEY_A)
    await w.settle()
    w.popup.clear()
    await w.settle()
    expect(w.page.getState().key).toBeNull()
  })

  it('in the extension while the website is closed removes it when the website opens', async () => {
    const w = world()
    await w.openPage()
    w.page.save(KEY_A)
    await w.settle()
    w.closePage()
    w.popup.clear()
    await w.reopenPage()
    expect(w.page.getState().key).toBeNull()
  })
})

describe('two changes made while apart', () => {
  it('keep the newer one on both sides', async () => {
    const w = world()
    await w.openPage()
    w.page.save(KEY_A)
    await w.settle()
    w.closePage()
    // While the website is closed, the extension changes the key, then later the website's storage is
    // changed by another tab (simulated by saving on the closed store, which only reaches its storage).
    w.popup.save(KEY_B)
    await w.reopenPage()
    expect(w.page.getState().key).toBe(KEY_B)
    expect(w.extension().key).toBe(KEY_B)
  })
})

describe('the messages', () => {
  it('stay few: no loop between the two sides', async () => {
    const w = world()
    w.popup.save(KEY_A)
    await w.openPage()
    w.page.save(KEY_B)
    await w.settle()
    w.popup.save(KEY_A)
    await w.settle()
    w.page.clear()
    await w.settle()
    expect(w.messageCount()).toBeLessThan(25)
  })

  it('announce the extension once per page load, and the page answers with one hello', async () => {
    const w = world()
    await w.openPage()
    const present = w.toPage.filter((m) => m.type === 'present')
    expect(present).toHaveLength(1)
  })

  it('ignore anything that is not ours', async () => {
    const replies: ExtensionMessage[] = []
    let extension: StoredKey = EMPTY_KEY_STATE
    const core = createBridgeCore({
      read: async () => extension,
      write: async (s) => void (extension = s),
      post: (m) => replies.push(m),
    })
    for (const junk of [
      null,
      'hello',
      42,
      {},
      { source: BRIDGE_EXTENSION_SOURCE, type: 'hello', state: { key: KEY_A, updatedAt: 9 } },
      { source: BRIDGE_PAGE_SOURCE, type: 'hello' },
      { source: BRIDGE_PAGE_SOURCE, type: 'set', state: { key: 'not a key', updatedAt: 9 } },
      { source: BRIDGE_PAGE_SOURCE, type: 'other', state: { key: KEY_A, updatedAt: 9 } },
    ]) {
      await core.fromPage(junk)
    }
    expect(replies).toEqual([])
    expect(extension).toEqual(EMPTY_KEY_STATE)
  })

  it('never store or send a key that cannot be a key', async () => {
    const w = world()
    await w.openPage()
    expect(w.page.save('hello there')).toBe('invalid')
    await w.settle()
    expect(w.extension().key).toBeNull()
  })
})
