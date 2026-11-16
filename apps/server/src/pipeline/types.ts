import type { MatchedRecord, Scores, Thresholds } from '@cekkutip/shared'
import { DEFAULT_THRESHOLDS } from '../config/thresholds.js'

/**
 * What the pipeline does. The same code serves the product and the evaluation harness:
 * the ablations (A1 to A4) are switches here, not copies of the code.
 */
export interface PipelineOptions {
  parseMode: 'llm' | 'regex'
  /** A2 turns this off: Crossref only. */
  useOpenAlex: boolean
  /** A1 turns this off: Out-of-index is folded into Suspect. */
  abstain: boolean
  /** A4 turns this off: authors are neither compared nor used in the decision. */
  checkAuthors: boolean
  thresholds: Thresholds
}

export const DEFAULT_OPTIONS: PipelineOptions = {
  parseMode: 'llm',
  useOpenAlex: true,
  abstain: true,
  checkAuthors: true,
  thresholds: DEFAULT_THRESHOLDS,
}

export type AblationName = 'a1' | 'a2' | 'a3' | 'a4'
export const ABLATIONS: readonly AblationName[] = ['a1', 'a2', 'a3', 'a4']

export function applyAblation(options: PipelineOptions, name: AblationName): PipelineOptions {
  switch (name) {
    case 'a1':
      return { ...options, abstain: false }
    case 'a2':
      return { ...options, useOpenAlex: false }
    case 'a3':
      return { ...options, parseMode: 'regex' }
    case 'a4':
      return { ...options, checkAuthors: false }
  }
}

/** What the lookup stage found. Failures are not an outcome here: they throw ServiceUnavailableError. */
export type Retrieval =
  | { kind: 'service_failed' }
  | { kind: 'insufficient' }
  | { kind: 'doi_not_registered' }
  | { kind: 'doi_other_registry'; agency: string }
  | { kind: 'doi_record'; record: MatchedRecord }
  | { kind: 'candidates'; candidates: MatchedRecord[] }

/** Which cited fields were present and comparable. A field that was not written is never held against the reference. */
export interface MatchFlags {
  titleCited: boolean
  authorsCited: boolean
  yearCited: boolean
  /** Venue was cited and the record has one, so the two could be compared. */
  venueCompared: boolean
}

export interface Scored {
  record: MatchedRecord
  scores: Scores
  flags: MatchFlags
}
