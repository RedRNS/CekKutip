import { normalizeDoi } from './doi.js'
import type { ReferenceResult } from './index.js'

/**
 * A note next to a result: something the verdict does not say, found by looking at the result (and, for
 * a repeated record, at the other results of the same list). A note never changes a verdict and is never
 * written by a language model. The text comes from fixed templates in the client, one per code.
 */
export type ResultNote =
  /** Verified, but the year written is a year away from the record's. */
  | { code: 'year_differs'; cited: number; found: number }
  /** Verified, but fewer authors are written than the record has, and there is no "et al.". */
  | { code: 'authors_partial'; cited: number; found: number }
  /** Another reference in the list leads to the same record. `others` are numbers as shown, from 1. */
  | { code: 'same_record'; others: number[] }

/** APA 7 writes at most 20 names (19, an ellipsis, and the last), so a list that long is not a short one. */
const APA_LISTED_NAMES = 20

/** The record a result leads to, as a key; null when it has no record or nothing to tell it apart by. */
function recordKey(r: ReferenceResult): string | null {
  const rec = r.record
  if (rec === null) return null
  if (rec.doi !== null) {
    const doi = normalizeDoi(rec.doi)
    if (doi !== null) return `doi:${doi.toLowerCase()}`
  }
  return rec.url !== null && rec.url !== '' ? `url:${rec.source}:${rec.url}` : null
}

/**
 * Notes for a list of results, by result index. Results with nothing to note are left out.
 * Works on whatever has arrived so far, so a note about a repeated record appears when the second of
 * the two results does, whichever order they came in.
 */
export function resultNotes(results: readonly ReferenceResult[]): Map<number, ResultNote[]> {
  const out = new Map<number, ResultNote[]>()
  const add = (index: number, note: ResultNote) => out.set(index, [...(out.get(index) ?? []), note])

  for (const r of results) {
    const rec = r.record
    if (r.status !== 'verified' || rec === null) continue
    const { year } = r.parsed
    if (year !== null && rec.year !== null && year !== rec.year) {
      add(r.index, { code: 'year_differs', cited: year, found: rec.year })
    }
    const cited = r.parsed.authors.length
    if (!r.parsed.hasEtAl && cited > 0 && cited < APA_LISTED_NAMES && rec.authors.length > cited) {
      add(r.index, { code: 'authors_partial', cited, found: rec.authors.length })
    }
  }

  const byRecord = new Map<string, ReferenceResult[]>()
  for (const r of results) {
    if (r.status !== 'verified' && r.status !== 'mismatch') continue
    const key = recordKey(r)
    if (key !== null) byRecord.set(key, [...(byRecord.get(key) ?? []), r])
  }
  for (const group of byRecord.values()) {
    if (group.length < 2) continue
    for (const r of group) {
      const others = group
        .filter((o) => o !== r)
        .map((o) => o.index + 1)
        .sort((a, b) => a - b)
      add(r.index, { code: 'same_record', others })
    }
  }
  return out
}
