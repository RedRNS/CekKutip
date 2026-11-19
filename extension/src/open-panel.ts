/**
 * Opening the extension's panel. Logic only, so it can be tested without a browser.
 *
 * The panel is a Chrome side panel. A browser that has no side panel API (the extension is built for
 * Chrome and Edge, and has not been tested elsewhere) gets the same page in a new tab instead, so the
 * toolbar icon and the right-click item never do nothing.
 */

export interface PanelApi {
  /** The browser's side panel call, when it has one. */
  openSidePanel?: (windowId: number) => Promise<void>
  /** The same page as an ordinary tab. */
  openTab: () => Promise<void>
}

/**
 * Opens the side panel of a window. When the browser cannot (no side panel API, or no window to
 * name), opens the tab. A side panel call that the browser refuses throws: the caller decides what
 * to tell the person.
 */
export async function openPanel(windowId: number | undefined, api: PanelApi): Promise<void> {
  if (api.openSidePanel && windowId !== undefined) {
    await api.openSidePanel(windowId)
    return
  }
  await api.openTab()
}
