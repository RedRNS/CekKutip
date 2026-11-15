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

export const DEFAULT_THRESHOLDS: Thresholds = {
  tauT: TAU_T,
  tauA: TAU_A,
  tauL: TAU_L,
  tauV: TAU_V,
}
