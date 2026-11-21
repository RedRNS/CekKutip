import { AUTOFILL_FLAG, SELECTION_MESSAGE, selectionToSend } from './autofill'

/**
 * Runs on ordinary web pages, only after the person turned on "Fill the box when I select text".
 * When a selection is finished, it sends the selected text to the extension's side panel, and does
 * nothing else: it does not read the page, and it sends nothing to any server.
 *
 * Text selected inside a form field is never sent: that is what the person typed, not what they are
 * reading. If the side panel is not open, nobody receives the message and it is dropped.
 */

const root = globalThis as { __cekkutipSelection?: boolean }

// The script may be injected into a page that already has it (turning the choice off and on again).
if (!root.__cekkutipSelection) {
  root.__cekkutipSelection = true

  let timer: number | undefined
  /** The last text that reached the panel, so one selection is not sent again and again. */
  let last: string | null = null

  const inFormField = (): boolean => {
    const el = document.activeElement as HTMLElement | null
    return (
      !!el &&
      (el.isContentEditable ||
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT')
    )
  }

  const send = async (): Promise<void> => {
    if (document.hidden || inFormField()) return
    const text = selectionToSend(window.getSelection()?.toString() ?? '', last)
    if (text === null) return
    try {
      // Read at the moment of sending, so a page that was open when the choice was turned off stops at once.
      const stored = await chrome.storage.local.get(AUTOFILL_FLAG)
      if (stored[AUTOFILL_FLAG] !== true) return
      await chrome.runtime.sendMessage({ type: SELECTION_MESSAGE, text })
      last = text
    } catch {
      // The panel is not open, or the extension was reloaded under this page: nothing to do.
    }
  }

  const finished = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void send(), 300)
  }

  // A new selection starts with a press, so the same text can be chosen again after it was cleared.
  document.addEventListener('mousedown', () => (last = null), true)
  document.addEventListener('mouseup', finished, true)
  document.addEventListener('keyup', finished, true) // a selection made with the keyboard
}
