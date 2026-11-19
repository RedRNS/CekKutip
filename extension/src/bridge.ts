import { KEY_STORAGE_NAME, parseStoredKey } from '@cekkutip/shared/apikey'
import type { StoredKey } from '@cekkutip/shared/apikey'
import { createBridgeCore } from './bridge-core'

/**
 * Content script, injected only on the CekKutip website (see manifest.json). It carries the Gemini
 * key between the page and the extension's storage. It never reads anything else from the page and
 * never sends anything over the network.
 */

const read = async (): Promise<StoredKey> => {
  const stored = await chrome.storage.local.get(KEY_STORAGE_NAME)
  return parseStoredKey(stored[KEY_STORAGE_NAME])
}

const core = createBridgeCore({
  read,
  write: (state) => chrome.storage.local.set({ [KEY_STORAGE_NAME]: JSON.stringify(state) }),
  post: (message) => window.postMessage(message, window.location.origin),
})

// Only messages that this same window sent, from the site's own origin.
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.origin !== window.location.origin) return
  core.fromPage(event.data).catch(() => {
    /* the extension was reloaded or updated while the page stayed open: nothing to do */
  })
})

// The popup changed the key: tell the open page at once.
chrome.storage.onChanged.addListener((changes, area) => {
  const change = changes[KEY_STORAGE_NAME]
  if (area !== 'local' || !change) return
  core.changed(parseStoredKey(change.newValue))
})

core.announce()
