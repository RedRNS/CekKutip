import type { Thresholds } from '@cekkutip/shared'

/**
 * Decision thresholds. These are PROVISIONAL starting values.
 * Final values must be tuned on the dev split only (`npm run eval:tune`),
 * then frozen and recorded in docs/DECISIONS.md with the commit hash.
 *
 * TAU_T: high title similarity. A candidate above it is "the same work".
 * TAU_A: share of cited author surnames that must appear in the record.
 * TAU_L: low title similarity. Below it, a candidate is "a different work".
 * TAU_V: venue similarity below which a cited venue is clearly different
 *        (added by decision, see docs/PLAN.md section 7, gap A).
 */
export const TAU_T = 0.9
export const TAU_A = 0.6
export const TAU_L = 0.6
export const TAU_V = 0.4

/**
 * T1' (DECISIONS 109): T1 (a matching title with none of the cited authors is another work) applies
 * only to titles shorter than this many words. A longer title is specific enough that the same title
 * on a different work is unlikely, so the work exists and its authors were cited wrongly: Mismatch.
 * Fixed in advance, not tuned on data. Like the thresholds it may be revisited on the dev split only.
 */
export const MIN_SPECIFIC_TITLE_TOKENS = 6

export const DEFAULT_THRESHOLDS: Thresholds = {
  tauT: TAU_T,
  tauA: TAU_A,
  tauL: TAU_L,
  tauV: TAU_V,
}
