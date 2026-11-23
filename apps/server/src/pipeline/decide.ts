import type { CheckStatus, ParsedReference, ReasonCode, ReferenceType } from '@cekkutip/shared'
import { MIN_SPECIFIC_TITLE_TOKENS } from '../config/thresholds.js'
import { tokenize } from '../lib/normalize.js'
import type { PipelineOptions, Retrieval, Scored } from './types.js'

export interface DecideInput {
  parsed: ParsedReference
  retrieval: Retrieval
  /**
   * The scored record: the record a DOI led to, or the best search candidate.
   * Required for `doi_record`; null for `candidates` when the search returned nothing.
   */
  best: Scored | null
  options: Pick<PipelineOptions, 'thresholds' | 'abstain' | 'checkAuthors'>
}

export interface Decision {
  status: CheckStatus
  reasons: ReasonCode[]
  /** Row of the brief's decision table (section 6.5) that produced this result. For audit and tests. */
  rule: number
}

/**
 * The decision table (brief section 6.5), evaluated in order. A pure function: no model, no network.
 *
 * Reading of the thresholds: "above" means `>=` (a score exactly at TAU_T counts as high),
 * "below" means `<`.
 *
 * Two gaps in the table were closed by decision (docs/DECISIONS.md, no. 6 and 7):
 * - A: a cited venue that clearly differs (score below TAU_V) blocks `verified` and gives `mismatch_venue`.
 * - B: a record reached through a cited DOI counts as the same work for rows 4 and 5 even when its
 *   title score is between TAU_L and TAU_T. Only a score below TAU_L means "a different work" (row 3).
 *
 * One more rule, added for evidence: a match needs at least two of title, authors, and year to have
 * been written and compared. A bare DOI or a bare title cannot be called Verified.
 *
 * Three refinements approved on 2026-11-16 after live runs (docs/DECISIONS.md, T1 to T3):
 * - T1: a search candidate whose title matches but in which none of the cited authors is found is
 *   another work with the same title, not this work cited wrongly. It does not count as a match.
 *   T1' (2026-11-19): only when the title is short or common (fewer than MIN_SPECIFIC_TITLE_TOKENS
 *   words). A long, specific title with wholly wrong authors is the same work, cited wrongly.
 * - T2 lives in run.ts (a second look in OpenAlex), not here.
 * - T3: for a thesis, book, book chapter, report, or web page, a venue is not "a journal name" (row 6).
 */
export function decide(input: DecideInput): Decision {
  const { parsed, retrieval, best, options } = input
  const { tauA, tauL, tauV } = options.thresholds

  const done = (rule: number, status: CheckStatus, reasons: ReasonCode[]): Decision => {
    if (!options.abstain && status === 'out_of_index') return { rule, status: 'suspect', reasons }
    return { rule, status, reasons }
  }

  // Row 1: a service failed after retries. Not a verdict.
  if (retrieval.kind === 'service_failed') return done(1, 'check_failed', ['check_failed_network'])

  // Row 2: a cited DOI that is registered nowhere.
  if (retrieval.kind === 'doi_not_registered') return done(2, 'suspect', ['suspect_doi_not_found'])

  // Row 9: a DOI that belongs to a registry we do not search.
  if (retrieval.kind === 'doi_other_registry') {
    return done(9, 'out_of_index', ['out_of_index_other_registry'])
  }

  // Row 8: nothing to search with.
  if (retrieval.kind === 'insufficient') {
    return done(8, 'out_of_index', ['out_of_index_insufficient_data'])
  }

  // Rows 3, 4, 5: a record is in hand and counts as the same work.
  const sameWork =
    retrieval.kind === 'doi_record'
      ? best !== null && !(best.flags.titleCited && best.scores.title < tauL)
      : best !== null && isSameWorkCandidate(best, options)

  if (retrieval.kind === 'doi_record') {
    if (best === null) throw new Error('decide: doi_record needs a scored record')
    // Row 3: the DOI leads to a clearly different work.
    if (best.flags.titleCited && best.scores.title < tauL) {
      return done(3, 'mismatch', ['mismatch_doi_other_work'])
    }
  }

  if (sameWork && best !== null) {
    const reasons: ReasonCode[] = []
    if (options.checkAuthors && best.flags.authorsCited && best.scores.authors < tauA) {
      reasons.push('mismatch_authors')
    }
    if (best.scores.yearDiff !== null && best.scores.yearDiff > 1) reasons.push('mismatch_year')
    if (best.flags.venueCompared && best.scores.venue < tauV) reasons.push('mismatch_venue')

    // Row 5: the work exists, but cited details do not agree.
    if (reasons.length > 0) return done(5, 'mismatch', reasons)

    // Evidence check: too little was cited to say that details agree.
    const comparable =
      Number(best.flags.titleCited) +
      Number(options.checkAuthors && best.flags.authorsCited) +
      Number(best.flags.yearCited && best.scores.yearDiff !== null)
    if (comparable < 2) return done(8, 'out_of_index', ['out_of_index_insufficient_data'])

    // Row 4: everything that was written agrees.
    return done(4, 'verified', ['verified_all_match'])
  }

  // No usable record. A candidate between TAU_L and TAU_T without a DOI counts as "not matched yet".
  // Row 6: cited like a journal article.
  if (isCitedLikeAJournalArticle(parsed)) {
    return done(6, 'suspect', ['suspect_no_record_journal'])
  }

  // Row 7: a type that Crossref and OpenAlex often do not hold. Abstain.
  return done(7, 'out_of_index', ['out_of_index_type'])
}

/** T3: for these types a venue is a repository, publisher, book, or site, never a journal name. */
const VENUE_IS_NOT_A_JOURNAL: ReadonlySet<ReferenceType> = new Set([
  'thesis',
  'book',
  'book_chapter',
  'report',
  'web_page',
])

/**
 * Row 6's condition: cited like something an index would hold (an article with a journal or volume, or
 * one that carries a DOI). The same test decides whether Garuda is worth asking: a reference that fails
 * it ends as Out-of-index whatever Garuda says.
 */
export function isCitedLikeAJournalArticle(parsed: ParsedReference): boolean {
  return (
    parsed.type === 'journal_article' ||
    (parsed.venue !== null && !VENUE_IS_NOT_A_JOURNAL.has(parsed.type)) ||
    parsed.volume !== null ||
    parsed.doi !== null
  )
}

/**
 * Whether a search candidate counts as the cited work: its title reaches TAU_T, and (T1) it is not a
 * title collision, meaning authors were cited and compared and none of them is in the record, and the
 * title is short or common (T1').
 */
export function isSameWorkCandidate(
  scored: Scored,
  options: Pick<PipelineOptions, 'thresholds' | 'checkAuthors'>,
): boolean {
  if (scored.scores.title < options.thresholds.tauT) return false
  const noAuthorFound =
    options.checkAuthors && scored.flags.authorsCited && scored.scores.authors === 0
  const commonTitle = tokenize(scored.record.title).length < MIN_SPECIFIC_TITLE_TOKENS
  return !(noAuthorFound && commonTitle)
}

/** A candidate whose title matches but that T1 rejects as another work. Used to trigger the second look. */
export function isTitleCollision(
  scored: Scored | null,
  options: Pick<PipelineOptions, 'thresholds' | 'checkAuthors'>,
): boolean {
  return (
    scored !== null &&
    scored.scores.title >= options.thresholds.tauT &&
    !isSameWorkCandidate(scored, options)
  )
}
