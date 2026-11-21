/**
 * "Fill the box when I select text on a page". Logic only, so it can be tested without a browser.
 *
 * This is the one feature that needs more than the CekKutip site: to see what a person selects on
 * another page, the extension needs permission to read the text they select on websites. So it is
 * off by default, it asks the browser for that permission only when the person turns it on, and
 * turning it off gives the permission back. Nothing it collects leaves the browser: a selection goes
 * to the side panel and into the text box, and nothing is sent anywhere until the person chooses
 * "Check references".
 */

/** Where the on/off choice is kept (chrome.storage.local, which the page script can read). */
export const AUTOFILL_FLAG = 'cekkutip.autoFill'
/** The message the page script sends. Only the side panel listens: the service worker has no listener. */
export const SELECTION_MESSAGE = 'cekkutip:selection'
export const SCRIPT_ID = 'cekkutip-selection'
/** Ordinary web pages. Not file:, chrome:, or the browser's own pages. */
export const PAGE_ORIGINS = ['http://*/*', 'https://*/*']
/** The server takes a 64 KB request body, so a selection is cut well under that. */
export const MAX_SELECTION_CHARS = 30_000
/** Fewer words than this is a word picked by a double click, not a reference. */
export const MIN_WORDS = 3

const DOI = /\b10\.\d{4,9}\/\S+/

/**
 * Whether a selection is worth putting in the box, and what to put. Returns null for nothing, for a
 * word or two (a double click), and for the same text as last time. A DOI alone counts: it is one
 * word, and it is a reference.
 */
export function selectionToSend(raw: string, last: string | null): string | null {
  const text = raw.trim().slice(0, MAX_SELECTION_CHARS).trim()
  if (text === '' || text === last) return null
  const words = text.split(/\s+/).length
  if (words < MIN_WORDS && !DOI.test(text)) return null
  return text
}

export interface AutoFillApi {
  /** Asks the browser, and so must be the first call made in answer to the person's click. */
  requestOrigins(origins: string[]): Promise<boolean>
  hasOrigins(origins: string[]): Promise<boolean>
  removeOrigins(origins: string[]): Promise<void>
  getFlag(): Promise<boolean>
  setFlag(on: boolean): Promise<void>
  isRegistered(): Promise<boolean>
  register(): Promise<void>
  unregister(): Promise<void>
  /** Pages that were already open when the person turned it on get the script now. */
  injectIntoOpenTabs(): Promise<void>
}

export type AutoFillState = 'on' | 'off'

/**
 * The person turned it on. The permission is asked first, in the same turn as the click, because the
 * browser only shows its question in answer to a click. If the person says no, nothing changes.
 */
export async function turnOn(api: AutoFillApi): Promise<AutoFillState | 'denied'> {
  const granted = await api.requestOrigins(PAGE_ORIGINS)
  if (!granted) return 'denied'
  await api.register()
  await api.setFlag(true)
  await api.injectIntoOpenTabs()
  return 'on'
}

/**
 * The person turned it off. The flag goes first, so pages that already have the script stop sending
 * at once (a script cannot be taken out of an open page). Then the script and the permission go.
 */
export async function turnOff(api: AutoFillApi): Promise<void> {
  await api.setFlag(false)
  await api.unregister()
  await api.removeOrigins(PAGE_ORIGINS)
}

/**
 * Brings the browser in line with what the person chose, whenever the extension starts or the panel
 * opens: the choice and the permission must agree. If the person took the permission away in the
 * browser's own settings, the choice is switched off too, so the panel never says "on" for nothing.
 */
export async function ensureAutoFill(api: AutoFillApi): Promise<AutoFillState> {
  const wanted = await api.getFlag()
  const allowed = await api.hasOrigins(PAGE_ORIGINS)
  if (wanted && allowed) {
    if (!(await api.isRegistered())) await api.register()
    return 'on'
  }
  if (wanted) await api.setFlag(false)
  if (await api.isRegistered()) await api.unregister()
  return 'off'
}
