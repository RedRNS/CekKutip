import { z } from 'zod'

import { DOI_PATTERN } from './patterns.js'

export { normalizeText, stripDiacritics, tokenize } from './normalize.js'
export { DOI_PATTERN, MIN_YEAR } from './patterns.js'
export { extractDoi, normalizeDoi } from './doi.js'
export { checkLimits, splitReferences } from './split.js'
export type { LimitError, Limits } from './split.js'
export { resultNotes } from './notes.js'
export type { ResultNote } from './notes.js'

export const VerdictSchema = z.enum(['verified', 'mismatch', 'suspect', 'out_of_index'])
export type Verdict = z.infer<typeof VerdictSchema>

export const CheckStatusSchema = z.enum([
  'verified',
  'mismatch',
  'suspect',
  'out_of_index',
  'check_failed',
])
export type CheckStatus = z.infer<typeof CheckStatusSchema>

export const ReferenceTypeSchema = z.enum([
  'journal_article',
  'book',
  'book_chapter',
  'conference_paper',
  'thesis',
  'report',
  'web_page',
  'other',
])
export type ReferenceType = z.infer<typeof ReferenceTypeSchema>

export const ReasonCodeSchema = z.enum([
  'verified_all_match',
  'mismatch_authors',
  'mismatch_year',
  'mismatch_venue',
  'mismatch_doi_other_work',
  'suspect_doi_not_found',
  'suspect_no_record_journal',
  'out_of_index_type',
  'out_of_index_insufficient_data',
  'out_of_index_other_registry',
  'check_failed_network',
])
export type ReasonCode = z.infer<typeof ReasonCodeSchema>

export const ParsedReferenceSchema = z.object({
  raw: z.string(),
  authors: z.array(z.string()),
  hasEtAl: z.boolean(),
  year: z.number().int().nullable(),
  title: z.string().nullable(),
  venue: z.string().nullable(),
  volume: z.string().nullable(),
  issue: z.string().nullable(),
  pages: z.string().nullable(),
  doi: z.string().regex(DOI_PATTERN).nullable(),
  type: ReferenceTypeSchema,
  parseMode: z.enum(['llm', 'regex']),
})
export type ParsedReference = z.infer<typeof ParsedReferenceSchema>

export const MatchedRecordSchema = z.object({
  source: z.enum(['crossref', 'openalex', 'datacite', 'garuda']),
  doi: z.string().nullable(),
  url: z.string().nullable(),
  title: z.string(),
  /** Family names (or organisation names), in order. The matcher compares these. */
  authors: z.array(z.string()),
  /** Full display names ("William H. Walters"), same order. Used for display and APA output. */
  authorsFull: z.array(z.string()).optional(),
  year: z.number().int().nullable(),
  venue: z.string().nullable(),
  volume: z.string().nullable(),
  issue: z.string().nullable(),
  pages: z.string().nullable(),
})
export type MatchedRecord = z.infer<typeof MatchedRecordSchema>

export const FieldComparisonSchema = z.object({
  field: z.enum(['title', 'authors', 'year', 'venue', 'doi']),
  cited: z.string().nullable(),
  found: z.string().nullable(),
  state: z.enum(['agree', 'differs', 'not_cited', 'not_found']),
  note: z.string().nullable(),
})
export type FieldComparison = z.infer<typeof FieldComparisonSchema>

export const ScoresSchema = z.object({
  title: z.number(),
  authors: z.number(),
  yearDiff: z.number().nullable(),
  venue: z.number(),
})
export type Scores = z.infer<typeof ScoresSchema>

export const ReferenceResultSchema = z.object({
  index: z.number().int().nonnegative(),
  raw: z.string(),
  status: CheckStatusSchema,
  reasons: z.array(ReasonCodeSchema),
  parsed: ParsedReferenceSchema,
  record: MatchedRecordSchema.nullable(),
  comparison: z.array(FieldComparisonSchema),
  scores: ScoresSchema,
  latencyMs: z.number(),
})
export type ReferenceResult = z.infer<typeof ReferenceResultSchema>

export const ThresholdsSchema = z.object({
  tauT: z.number(),
  tauA: z.number(),
  tauL: z.number(),
  /** Venue score below which a cited venue counts as clearly different (PLAN.md section 7, gap A). */
  tauV: z.number(),
})
export type Thresholds = z.infer<typeof ThresholdsSchema>

/**
 * Why the language model could not be used for part of a check, when it could not.
 * rejected: the AI service refused the key. quota: the key's usage limit was reached.
 * The check still finishes, with the no-AI reader for the references the model could not read.
 */
export const AiIssueSchema = z.enum(['rejected', 'quota'])
export type AiIssue = z.infer<typeof AiIssueSchema>

export const CheckSummarySchema = z.object({
  total: z.number().int(),
  verified: z.number().int(),
  mismatch: z.number().int(),
  suspect: z.number().int(),
  outOfIndex: z.number().int(),
  checkFailed: z.number().int(),
  medianLatencyMs: z.number(),
  thresholds: ThresholdsSchema,
  toolVersion: z.string(),
  aiIssue: AiIssueSchema.nullable().optional(),
})
export type CheckSummary = z.infer<typeof CheckSummarySchema>

export const CheckRequestSchema = z.object({
  references: z.union([z.string(), z.array(z.string())]),
  options: z
    .object({
      parseMode: z.enum(['llm', 'regex']).default('llm'),
      system: z.string().optional(),
      ablation: z.string().optional(),
    })
    .default({ parseMode: 'llm' }),
})
export type CheckRequest = z.infer<typeof CheckRequestSchema>

export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started'), total: z.number().int() }),
  z.object({ type: z.literal('result'), result: ReferenceResultSchema }),
  z.object({ type: z.literal('done'), summary: CheckSummarySchema }),
])
export type StreamEvent = z.infer<typeof StreamEventSchema>

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

export interface PublicConfig {
  maxReferences: number
  maxReferenceChars: number
  toolVersion: string
  /** False when no AI service key is configured: checks then always use the no-AI reader. */
  aiAvailable: boolean
}
