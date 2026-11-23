/**
 * Writing references in APA 7, IEEE, and Harvard. Fixed rules, no model, no network: it runs in the browser
 * and the text of a reference goes nowhere. Journal articles are rewritten in full; other kinds are kept
 * as they were and say why (DECISIONS 141).
 */
export { formatArticle } from './format.js'
export { formatReferences } from './list.js'
export type { FieldChange, FormatItem, FormatListOptions } from './list.js'
export { markChanges } from './diff.js'
export type { Mark } from './diff.js'
export { html, markdown, plain } from './pieces.js'
export { parseReference } from './parse.js'
export { FORMAT_STYLES } from './types.js'
export type {
  FieldName,
  FormatOptions,
  FormatStyle,
  JournalArticle,
  NoteCode,
  Person,
  Piece,
} from './types.js'
export { annotate } from './annotate.js'
export type { Run } from './annotate.js'
