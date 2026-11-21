/**
 * Text that was selected on a web page while the extension's side panel is open.
 * The rule that protects what the person typed themselves: a selection may replace the box only when
 * the box is empty, or still holds exactly what an earlier selection put there.
 */

export type SelectionAction = 'fill' | 'ask' | 'ignore'

export function decideSelection(input: {
  /** What is in the box now. */
  box: string
  /** What the page last put in the box, or null if the page has not (or the person added to it since). */
  lastFilled: string | null
  /** The newly selected text. */
  incoming: string
}): SelectionAction {
  if (input.incoming === input.box) return 'ignore'
  if (input.box.trim() === '' || input.box === input.lastFilled) return 'fill'
  return 'ask'
}

/** The start of a selection, for showing it in a short notice. */
export function snippet(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max).trimEnd()}…`
}
