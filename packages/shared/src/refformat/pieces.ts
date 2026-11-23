import type { Piece } from './types.js'

export const plain = (pieces: readonly Piece[]): string => pieces.map((p) => p.text).join('')

/** Italics as *...*. For tests and for showing a reference in a place that has no rich text. */
export const markdown = (pieces: readonly Piece[]): string =>
  pieces.map((p) => (p.italic ? `*${p.text}*` : p.text)).join('')

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Italics as <i>. Everything else is escaped, so the text of a reference cannot add markup. */
export const html = (pieces: readonly Piece[]): string =>
  pieces.map((p) => (p.italic ? `<i>${escapeHtml(p.text)}</i>` : escapeHtml(p.text))).join('')
