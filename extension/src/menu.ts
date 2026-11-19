/** The right-click item "Check selection with CekKutip". Logic only, so it can be tested without a browser. */

export const MENU_ID = 'cekkutip-check-selection'
/** Where the selected text waits for the side panel. Session storage: it is gone when the browser closes. */
export const PENDING_KEY = 'pendingText'
/** The server takes a 64 KB request body, so a selection is cut well under that. */
export const MAX_PENDING_CHARS = 30_000

export interface MenuApi {
  setPending(text: string): Promise<void>
  openPanel(): Promise<void>
  setBadge(text: string): Promise<void>
}

export type MenuOutcome = 'opened' | 'badge' | 'ignored'

/**
 * The person chose the menu item. The side panel is opened and the selected text is put aside for it.
 * Nothing is sent to any server here: the person still has to choose "Check references".
 * If the browser will not open the panel, the icon shows a badge instead.
 *
 * The panel is opened first, before anything is awaited. Opening a side panel needs the click's user
 * gesture, and the browser lets that lapse after a few awaits. The text is stored while the panel
 * loads: the panel reads it when it starts, and again whenever it changes, so order does not matter.
 */
export async function handleMenuClick(
  info: { menuItemId: string | number; selectionText?: string },
  api: MenuApi,
): Promise<MenuOutcome> {
  if (info.menuItemId !== MENU_ID) return 'ignored'
  const text = (info.selectionText ?? '').slice(0, MAX_PENDING_CHARS).trim()
  if (text === '') return 'ignored'
  const opening = api.openPanel().then(
    () => true,
    () => false,
  )
  await api.setPending(text)
  if (await opening) return 'opened'
  await api.setBadge('1')
  return 'badge'
}
