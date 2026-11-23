import { normalizeText } from '../normalize.js'
import { formatArticle } from './format.js'
import { parseReference } from './parse.js'
import { plain } from './pieces.js'
import { FIELDS } from './types.js'
import type { FieldName, FormatStyle, NoteCode, Piece } from './types.js'

export interface FormatListOptions {
  style: FormatStyle
  /** Put titles into sentence case. */
  sentenceCase: boolean
  /** Order APA and Harvard lists by the first author. IEEE is numbered in the order given and never sorted. */
  sort: boolean
}

export interface FieldChange {
  field: FieldName
  /** As it was written. Empty when the text had nothing there. */
  before: string
  /** As the style writes it. Empty when the style has no such part (the year, for IEEE). */
  after: string
}

export interface FormatItem {
  /** Where the reference was in the list that was given. */
  index: number
  raw: string
  /**
   * `changed`: rewritten, and different from what was written. `same`: rewritten, and nothing changes.
   * `not_rewritten`: not a journal article it can read, so only cleaned.
   */
  status: 'changed' | 'same' | 'not_rewritten'
  reason: 'not_journal_article' | 'unreadable' | null
  /** "[1]" for IEEE. */
  label: string | null
  pieces: Piece[]
  text: string
  changes: FieldChange[]
  notes: NoteCode[]
}

const collapse = (s: string) => s.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim()

interface Keyed {
  item: FormatItem
  key: string
}

/**
 * Rewrite every reference of a list in one style. Journal articles it can read are written out; the rest
 * are kept as they were (cleaned of list numbers, spaces, and DOI forms) with the reason. Empty entries
 * are left out.
 */
export function formatReferences(raws: readonly string[], opts: FormatListOptions): FormatItem[] {
  const keyed: Keyed[] = []
  raws.forEach((raw, index) => {
    if (raw.trim() === '') return
    const parsed = parseReference(raw)
    if (!parsed.ok) {
      keyed.push({
        key: normalizeText(parsed.cleaned),
        item: {
          index,
          raw,
          status: 'not_rewritten',
          reason: parsed.reason,
          label: null,
          pieces: [{ text: parsed.cleaned }],
          text: parsed.cleaned,
          changes: [],
          notes: [],
        },
      })
      return
    }

    const f = formatArticle(parsed.ref, opts.style, { sentenceCase: opts.sentenceCase })
    const text = plain(f.pieces)
    const same = collapse(text) === collapse(parsed.compare)
    const changes: FieldChange[] = []
    if (!same) {
      for (const field of FIELDS) {
        const before = field === 'doi' ? (parsed.written.doi ?? '') : parsed.written[field]
        const after = f.parts[field]
        if (collapse(before) !== collapse(after)) changes.push({ field, before, after })
      }
    }
    const first = parsed.ref.authors[0]
    const year = parsed.ref.year.replace(/\D/g, '') || '9999'
    keyed.push({
      key: `${normalizeText(first?.family ?? '')} ${year} ${normalizeText(parsed.ref.title)}`,
      item: {
        index,
        raw,
        status: same ? 'same' : 'changed',
        reason: null,
        label: null,
        pieces: f.pieces,
        text,
        changes,
        notes: [...(parsed.ref.namesUncertain ? (['names_uncertain'] as const) : []), ...f.notes],
      },
    })
  })

  if (opts.sort && opts.style !== 'ieee') {
    keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.item.index - b.item.index))
  }
  return keyed.map(({ item }, position) => ({
    ...item,
    label: opts.style === 'ieee' ? `[${position + 1}]` : null,
  }))
}
