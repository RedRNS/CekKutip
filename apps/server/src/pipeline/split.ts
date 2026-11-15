import { checkLimits, splitReferences } from '@cekkutip/shared'
import type { LimitError, Limits } from '@cekkutip/shared'

export { checkLimits, splitReferences }

/** The request is over a limit. Never truncated silently: the caller must say so to the user. */
export class LimitExceededError extends Error {
  constructor(readonly detail: LimitError) {
    super(
      detail.error === 'too_many_references'
        ? `You can check up to ${detail.limit} references at a time. Split your list and check it in parts.`
        : `Reference ${detail.index + 1} is longer than ${detail.limit} characters. Shorten it or split it.`,
    )
    this.name = 'LimitExceededError'
  }
}

/**
 * Turn the request's `references` field into a clean list.
 * A string is split deterministically. An array is taken as already split: each item is only
 * cleaned (invisible characters, spacing, list numbers, NFC), never split further.
 */
export function prepareReferences(input: string | string[], limits: Limits): string[] {
  const refs =
    typeof input === 'string'
      ? splitReferences(input)
      : input.map((item) => splitReferences(item).join(' ')).filter((r) => r !== '')
  const problem = checkLimits(refs, limits)
  if (problem) throw new LimitExceededError(problem)
  return refs
}
