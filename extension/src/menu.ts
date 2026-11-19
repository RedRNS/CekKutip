/** The right-click item "Check selection with CekKutip". Logic only, so it can be tested without a browser. */

export const MENU_ID = 'cekkutip-check-selection'
/** Where the selected text waits for the popup. Session storage: it is gone when the browser closes. */
export const PENDING_KEY = 'pendingText'
/** The server takes a 64 KB request body, so a selection is cut well under that. */
export const MAX_PENDING_CHARS = 30_000

export interface MenuApi {
  setPending(text: string): Promise<void>
  openPopup(): Promise<void>
  setBadge(text: string): Promise<void>
}

export type MenuOutcome = 'opened' | 'badge' | 'ignored'

/**
 * The person chose the menu item. The selected text is put aside for the popup and the popup is
 * opened. Nothing is sent to any server here: the person still has to choose "Check references".
 * If the browser will not open the popup, the icon shows a badge instead.
 */
export async function handleMenuClick(
  info: { menuItemId: string | number; selectionText?: string },
  api: MenuApi,
): Promise<MenuOutcome> {
  if (info.menuItemId !== MENU_ID) return 'ignored'
  const text = (info.selectionText ?? '').slice(0, MAX_PENDING_CHARS).trim()
  if (text === '') return 'ignored'
  await api.setPending(text)
  try {
    await api.openPopup()
    return 'opened'
  } catch {
    await api.setBadge('1')
    return 'badge'
  }
}
