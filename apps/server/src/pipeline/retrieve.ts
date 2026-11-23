import type { MatchedRecord, ParsedReference } from '@cekkutip/shared'
import type { CrossrefClient } from '../clients/crossref.js'
import type { DataciteClient } from '../clients/datacite.js'
import type { GarudaClient } from '../clients/garuda.js'
import type { DoiClient } from '../clients/doi.js'
import type { OpenAlexClient } from '../clients/openalex.js'
import { ServiceUnavailableError } from '../lib/http.js'
import { normalizeText } from '../lib/normalize.js'
import { titleSimilarity } from '../lib/similarity.js'
import { isCitedLikeAJournalArticle } from './decide.js'
import type { PipelineOptions, Retrieval } from './types.js'

export interface RetrieveDeps {
  crossref: CrossrefClient
  openalex: OpenAlexClient
  datacite: DataciteClient
  doi: DoiClient
  /** Absent when Garuda is switched off (GARUDA_ENABLED=false). */
  garuda?: GarudaClient
}

/** A title shorter than this (after normalization) is too little to search with. */
const MIN_TITLE_CHARS = 4

const recordKey = (r: MatchedRecord) =>
  r.doi ? `doi:${r.doi.toLowerCase()}` : `t:${normalizeText(r.title)}:${r.year ?? ''}`

/**
 * Look the work up (brief section 6.3).
 * - With a DOI: Crossref by DOI. If Crossref has no record, ask doi.org who registered it;
 *   a DataCite DOI (arXiv, Zenodo) is then fetched from DataCite.
 * - Without a DOI: Crossref bibliographic search; OpenAlex only when Crossref has no candidate
 *   whose title reaches TAU_L; then Garuda (the national index of Indonesian journals), only when
 *   neither has one, and only for a reference cited like a journal article (DECISIONS 140).
 *
 * Throws ServiceUnavailableError when a service fails. The caller reports `check_failed`;
 * a service failure is never turned into "not found".
 */
export async function retrieve(
  parsed: ParsedReference,
  deps: RetrieveDeps,
  opts: Pick<PipelineOptions, 'useOpenAlex' | 'useGaruda' | 'thresholds'>,
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
    if (agency.agency.toLowerCase() === 'datacite') {
      const dc = await deps.datacite.getByDoi(parsed.doi)
      if (dc.found) return { kind: 'doi_record', record: dc.record }
      // doi.org says DataCite holds it, but DataCite has no record: same contradiction as above.
      throw new ServiceUnavailableError('datacite', 'bad_response')
    }
    // Other agencies (mEDRA, JaLC, ...): not searched, so the tool says so.
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

  const bestTitle = (list: MatchedRecord[]) =>
    list.reduce((m, c) => Math.max(m, titleSimilarity(title, c.title)), 0)
  const merge = (have: MatchedRecord[], extra: MatchedRecord[]) => {
    const seen = new Set(have.map(recordKey))
    return [...have, ...extra.filter((r) => !seen.has(recordKey(r)))]
  }

  let all = candidates
  let openAlexUsed = false
  // No Crossref candidate reaches the minimum: try OpenAlex.
  if (opts.useOpenAlex && bestTitle(all) < opts.thresholds.tauL) {
    all = merge(all, await deps.openalex.searchTitle(title))
    openAlexUsed = true
  }
  // Still none: a journal article that Crossref and OpenAlex do not hold may be in Garuda. A failure
  // here throws, so the reference becomes check_failed and never a suspect.
  if (
    opts.useGaruda &&
    deps.garuda !== undefined &&
    isCitedLikeAJournalArticle(parsed) &&
    bestTitle(all) < opts.thresholds.tauL
  ) {
    all = merge(all, await deps.garuda.searchTitle(title))
  }
  return { kind: 'candidates', candidates: all, openAlexUsed }
}
