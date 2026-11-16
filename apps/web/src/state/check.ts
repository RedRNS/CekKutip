import type { CheckStatus, CheckSummary, ReferenceResult, StreamEvent } from '@cekkutip/shared'
import type { ClientErrorCode } from '../lib/api'

export interface CheckState {
  phase: 'idle' | 'running' | 'done' | 'error'
  /** The references that were sent, in order. Lets pending rows show their text. */
  references: string[]
  parseMode: 'llm' | 'regex'
  /** Results by reference index. Results arrive in any order. */
  results: Record<number, ReferenceResult>
  received: number
  summary: CheckSummary | null
  error: ClientErrorCode | null
}

export const initialCheckState: CheckState = {
  phase: 'idle',
  references: [],
  parseMode: 'llm',
  results: {},
  received: 0,
  summary: null,
  error: null,
}

export type CheckAction =
  | { type: 'start'; references: string[]; parseMode: 'llm' | 'regex' }
  | { type: 'event'; event: StreamEvent }
  | { type: 'fail'; code: ClientErrorCode }
  | { type: 'reset' }

export function checkReducer(state: CheckState, action: CheckAction): CheckState {
  switch (action.type) {
    case 'start':
      return {
        ...initialCheckState,
        phase: 'running',
        references: action.references,
        parseMode: action.parseMode,
      }
    case 'event': {
      const e = action.event
      if (state.phase !== 'running') return state
      if (e.type === 'result') {
        const i = e.result.index
        if (i < 0 || i >= state.references.length || state.results[i]) return state
        return {
          ...state,
          results: { ...state.results, [i]: e.result },
          received: state.received + 1,
        }
      }
      if (e.type === 'done') return { ...state, phase: 'done', summary: e.summary }
      return state
    }
    case 'fail':
      // Keep whatever arrived: partial results are still shown, with a notice.
      return { ...state, phase: 'error', error: action.code }
    case 'reset':
      return initialCheckState
  }
}

export const STATUS_ORDER: CheckStatus[] = [
  'verified',
  'mismatch',
  'suspect',
  'out_of_index',
  'check_failed',
]

export type Counts = Record<CheckStatus, number>

export function countByStatus(results: Record<number, ReferenceResult>): Counts {
  const counts: Counts = { verified: 0, mismatch: 0, suspect: 0, out_of_index: 0, check_failed: 0 }
  for (const r of Object.values(results)) counts[r.status] += 1
  return counts
}
