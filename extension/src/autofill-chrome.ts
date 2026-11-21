import { AUTOFILL_FLAG, PAGE_ORIGINS, SCRIPT_ID } from './autofill'
import type { AutoFillApi } from './autofill'

/** The browser's side of "fill the box from a selection". The rules are in autofill.ts. */
export function chromeAutoFillApi(): AutoFillApi {
  return {
    requestOrigins: (origins) => chrome.permissions.request({ origins }),
    hasOrigins: (origins) => chrome.permissions.contains({ origins }),
    removeOrigins: async (origins) => {
      // A permission the extension was installed with cannot be removed (a test build): the choice is
      // already off, which is what matters, so a refusal is not an error.
      await chrome.permissions.remove({ origins }).catch(() => undefined)
    },
    getFlag: async () => (await chrome.storage.local.get(AUTOFILL_FLAG))[AUTOFILL_FLAG] === true,
    setFlag: (on) => chrome.storage.local.set({ [AUTOFILL_FLAG]: on }),
    isRegistered: async () =>
      (await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] })).length > 0,
    register: async () => {
      await chrome.scripting.registerContentScripts([
        {
          id: SCRIPT_ID,
          matches: PAGE_ORIGINS,
          js: ['selection.js'],
          runAt: 'document_idle',
          allFrames: false,
          persistAcrossSessions: true,
        },
      ])
    },
    unregister: async () => {
      await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }).catch(() => undefined)
    },
    injectIntoOpenTabs: async () => {
      const tabs = await chrome.tabs.query({ url: PAGE_ORIGINS })
      await Promise.all(
        tabs.map(async (tab) => {
          if (tab.id === undefined) return
          // Pages the browser does not let an extension read (its store, error pages) refuse: skip them.
          await chrome.scripting
            .executeScript({ target: { tabId: tab.id }, files: ['selection.js'] })
            .catch(() => undefined)
        }),
      )
    },
  }
}
