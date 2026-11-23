import { html } from '@cekkutip/shared/refformat'
import type { FormatItem } from '@cekkutip/shared/refformat'

/** One reference as plain text, with its IEEE number in front. */
export const itemText = (item: FormatItem): string =>
  item.label === null ? item.text : `${item.label} ${item.text}`

/** A reference list as plain text: a blank line between references. */
export const listText = (items: readonly FormatItem[]): string => items.map(itemText).join('\n\n')

/** A hanging indent of half an inch, as APA and Harvard lists have. Word keeps it when it is pasted. */
const HANGING = 'margin:0 0 0 36pt;text-indent:-36pt'

/**
 * One reference as HTML for the clipboard, with the journal in italics (and the volume, in APA). This is put
 * on the clipboard only. It is never put into the page, and every piece of text in it is escaped.
 */
export const itemHtml = (item: FormatItem): string => {
  const label = item.label === null ? [] : [{ text: `${item.label} ` }]
  return `<p style="${HANGING}">${html([...label, ...item.pieces])}</p>`
}

export const listHtml = (items: readonly FormatItem[]): string => items.map(itemHtml).join('')
