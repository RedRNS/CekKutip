import type { FieldComparison, MatchedRecord, ParsedReference, Thresholds } from '@cekkutip/shared'
import type { Scored } from './types.js'

const MAX_AUTHORS_SHOWN = 8

function authorsText(names: string[], etAl: boolean): string | null {
  if (names.length === 0) return null
  const shown = names.slice(0, MAX_AUTHORS_SHOWN).join(', ')
  return names.length > MAX_AUTHORS_SHOWN || etAl ? `${shown}, et al.` : shown
}

/**
 * Side-by-side comparison for the evidence panel (brief section 7, FieldComparison).
 * Plain data, no prose: the explanation texts are fixed templates chosen by reason code in the client.
 *
 * `scored` is null when no record is being shown. `viaDoi` lowers the bar for "title agrees" to TAU_L,
 * matching the decision rule for records reached through a cited DOI (docs/DECISIONS.md, no. 7).
 */
export function buildComparison(
  parsed: ParsedReference,
  scored: Scored | null,
  thresholds: Thresholds,
  viaDoi: boolean,
): FieldComparison[] {
  const record: MatchedRecord | null = scored?.record ?? null
  const flags = scored?.flags
  const scores = scored?.scores

  const state = (cited: boolean, found: boolean, agree: boolean): FieldComparison['state'] => {
    if (!cited) return 'not_cited'
    if (!found) return 'not_found'
    return agree ? 'agree' : 'differs'
  }

  const titleAgree = scores ? scores.title >= (viaDoi ? thresholds.tauL : thresholds.tauT) : false
  const yearAgree = scores?.yearDiff != null && scores.yearDiff <= 1

  const citedAuthors = authorsText(parsed.authors, parsed.hasEtAl)

  const citedDoi = parsed.doi
  const foundDoi = record?.doi ?? null
  const doiState: FieldComparison['state'] =
    citedDoi === null
      ? 'not_cited'
      : foundDoi === null
        ? 'not_found'
        : citedDoi.toLowerCase() === foundDoi.toLowerCase()
          ? 'agree'
          : 'differs'

  return [
    {
      field: 'title',
      cited: parsed.title,
      found: record?.title ?? null,
      state: state(flags?.titleCited ?? parsed.title !== null, record !== null, titleAgree),
      note: null,
    },
    {
      field: 'authors',
      cited: citedAuthors,
      found: record ? authorsText(record.authors, false) : null,
      state: state(
        flags ? flags.authorsCited : parsed.authors.length > 0,
        record !== null && record.authors.length > 0,
        scores ? scores.authors >= thresholds.tauA : false,
      ),
      note: null,
    },
    {
      field: 'year',
      cited: parsed.year === null ? null : String(parsed.year),
      found: record?.year == null ? null : String(record.year),
      state: state(parsed.year !== null, record?.year != null, yearAgree),
      note: null,
    },
    {
      field: 'venue',
      cited: parsed.venue,
      found: record?.venue ?? null,
      state: state(
        parsed.venue !== null,
        record?.venue != null,
        scores ? scores.venue >= thresholds.tauV : false,
      ),
      note: null,
    },
    { field: 'doi', cited: citedDoi, found: foundDoi, state: doiState, note: null },
  ]
}
