import { KEY_STORAGE_NAME } from '@cekkutip/shared/apikey'
import { createKeyStore } from '../../../apps/web/src/lib/apiKey'
import type { KeyStore } from '../../../apps/web/src/lib/apiKey'
import { PENDING_KEY } from '../menu'

/**
 * The popup's key store. It is the website's store (same rules: validate, newer change wins), kept
 * in chrome.storage.local instead of the page's local storage. chrome.storage is asynchronous, so the
 * value is read once up front and mirrored in memory; every change is written through.
 * The content script on the website reads the same storage, which is how the two stay in step.
 */
export async function createExtensionKeyStore(): Promise<KeyStore> {
  const stored = await chrome.storage.local.get(KEY_STORAGE_NAME)
  const mirror = new Map<string, string>()
  const first = stored[KEY_STORAGE_NAME]
  if (typeof first === 'string') mirror.set(KEY_STORAGE_NAME, first)

  const store = createKeyStore({
    storage: {
      getItem: (name) => mirror.get(name) ?? null,
      setItem: (name, value) => {
        mirror.set(name, value)
        void chrome.storage.local.set({ [name]: value })
      },
      removeItem: (name) => {
        mirror.delete(name)
        void chrome.storage.local.remove(name)
      },
    },
  })

  // A change made elsewhere (the website, through the content script) while the popup is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    const change = changes[KEY_STORAGE_NAME]
    if (area !== 'local' || !change) return
    if (typeof change.newValue === 'string') mirror.set(KEY_STORAGE_NAME, change.newValue)
    store.reload()
  })
  return store
}

/** Text waiting from the right-click menu. Taken once: it is removed as it is read. */
export async function takePendingText(): Promise<string> {
  const stored = await chrome.storage.session.get(PENDING_KEY)
  const text = stored[PENDING_KEY]
  if (typeof text !== 'string') return ''
  await chrome.storage.session.remove(PENDING_KEY)
  await chrome.action.setBadgeText({ text: '' })
  return text
}
