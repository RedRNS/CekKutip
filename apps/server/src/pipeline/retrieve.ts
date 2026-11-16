import type { MatchedRecord, ParsedReference } from '@cekkutip/shared'
import type { CrossrefClient } from '../clients/crossref.js'
import type { DoiClient } from '../clients/doi.js'
import type { OpenAlexClient } from '../clients/openalex.js'
import { ServiceUnavailableError } from '../lib/http.js'
import { normalizeText } from '../lib/normalize.js'
import { titleSimilarity } from '../lib/similarity.js'
import type { PipelineOptions, Retrieval } from './types.js'

export interface RetrieveDeps {
  crossref: CrossrefClient
  openalex: OpenAlexClient
  doi: DoiClient
}

/** A title shorter than this (after normalization) is too little to search with. */
const MIN_TITLE_CHARS = 4

const recordKey = (r: MatchedRecord) =>
  r.doi ? `doi:${r.doi.toLowerCase()}` : `t:${normalizeText(r.title)}:${r.year ?? ''}`

/**
 * Look the work up (brief section 6.3).
 * - With a DOI: Crossref by DOI. If Crossref has no record, ask doi.org who registered it.
 * - Without a DOI: Crossref bibliographic search; OpenAlex only when Crossref has no candidate
 *   whose title reaches TAU_L.
 *
 * Throws ServiceUnavailableError when a service fails. The caller reports `check_failed`;
 * a service failure is never turned into "not found".
 */
export async function retrieve(
  parsed: ParsedReference,
  deps: RetrieveDeps,
  opts: Pick<PipelineOptions, 'useOpenAlex' | 'thresholds'>,
): Promise<Retrieval> {
  if (parsed.doi) {
    const found = await deps.crossref.getByDoi(parsed.doi)
    if (found.found) return { kind: 'doi_record', record: found.record }

    const agency = await deps.doi.getAgency(parsed.doi)
    if (agency.kind === 'not_registered') return { kind: 'doi_not_registered' }
    if (agency.agency.toLowerCase() === 'crossref') {
      // doi.org says Crossref holds it, but Crossref has no record. We cannot tell why, so we do not guess.
      throw new ServiceUnavailableError('crossref', 'bad_response')
    }
    // DataCite and others: not searched yet (DataCite arrives in P1).
    return { kind: 'doi_other_registry', agency: agency.agency }
  }

  const title = parsed.title
  if (title === null || normalizeText(title).length < MIN_TITLE_CHARS)
    return { kind: 'insufficient' }

  const candidates = await deps.crossref.search({
    title,
    firstAuthor: parsed.authors[0] ?? null,
    year: parsed.year,
  })

  const best = candidates.reduce((m, c) => Math.max(m, titleSimilarity(title, c.title)), 0)
  if (best >= opts.thresholds.tauL || !opts.useOpenAlex) return { kind: 'candidates', candidates }

  // No Crossref candidate reaches the minimum: try OpenAlex.
  const extra = await deps.openalex.searchTitle(title)
  const seen = new Set(candidates.map(recordKey))
  return {
    kind: 'candidates',
    candidates: [...candidates, ...extra.filter((r) => !seen.has(recordKey(r)))],
  }
}
