import { BRIDGE_EXTENSION_SOURCE, parsePageMessage } from '@cekkutip/shared/apikey'
import type { ExtensionMessage, StoredKey } from '@cekkutip/shared/apikey'

/**
 * The extension's half of the key sync. It runs as a content script on the CekKutip website and
 * connects two places that cannot see each other: the website's own storage (reached by messages
 * from the page) and the extension's storage (reached here). Whichever side changed the key last wins.
 *
 * This file holds the logic only, with no browser calls, so it can be tested on its own.
 */

export interface BridgeDeps {
  /** The key as the extension holds it. */
  read(): Promise<StoredKey>
  write(state: StoredKey): Promise<void>
  /** Send a message to the page. */
  post(message: ExtensionMessage): void
}

export function createBridgeCore(deps: BridgeDeps) {
  const say = (message: Omit<ExtensionMessage, 'source'>) =>
    deps.post({ source: BRIDGE_EXTENSION_SOURCE, ...message })

  return {
    /** Tell the page the extension is here. Sent once when the page loads. */
    announce(): void {
      say({ type: 'present' })
    },

    /**
     * A message from the page. Anything that is not one of ours is ignored.
     * A key the page holds that is newer than the extension's is stored here. The page gets an answer
     * to "hello" always, and to "set" only when the extension's own key is the newer one.
     */
    async fromPage(data: unknown): Promise<void> {
      const message = parsePageMessage(data)
      if (message === null) return
      const mine = await deps.read()
      const pageIsNewer = message.state.updatedAt > mine.updatedAt
      if (pageIsNewer) await deps.write(message.state)
      if (message.type === 'hello' || !pageIsNewer)
        say({ type: 'state', state: pageIsNewer ? message.state : mine })
    },

    /** The extension's key changed (in the side panel, or by this bridge): tell the open page. */
    changed(state: StoredKey): void {
      say({ type: 'state', state })
    },
  }
}
