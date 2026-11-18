import { parseEvaluationSummary } from '@cekkutip/shared/evaluation'
import type { EvaluationSummary } from '@cekkutip/shared/evaluation'
import { useEffect, useState } from 'react'

export type EvaluationState =
  { phase: 'loading' } | { phase: 'empty' } | { phase: 'ready'; summary: EvaluationSummary }

/** Must match EVALUATION_ELEMENT_ID in the server. */
const DATA_ELEMENT_ID = 'cekkutip-evaluation'

/**
 * On a direct visit to /evaluation the server puts the state into the page. Using it means there is
 * no loading state, no extra request, and nothing moves after the first paint.
 */
function readInjected(): EvaluationState | null {
  const text = document.getElementById(DATA_ELEMENT_ID)?.textContent
  if (!text) return null
  try {
    const summary = parseEvaluationSummary(JSON.parse(text))
    return summary ? { phase: 'ready', summary } : { phase: 'empty' }
  } catch {
    return { phase: 'empty' }
  }
}

/**
 * Loads eval/results/summary.json through the server. Anything other than a complete summary of real
 * results (no file, a failed request, invalid data, template data) is the honest empty state:
 * the page then shows no numbers at all.
 */
export function useEvaluation(): EvaluationState {
  const [state, setState] = useState<EvaluationState>(() => readInjected() ?? { phase: 'loading' })

  useEffect(() => {
    if (state.phase !== 'loading') return
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch('/api/evaluation', { signal: ac.signal })
        if (!res.ok) return setState({ phase: 'empty' })
        const summary = parseEvaluationSummary(await res.json())
        setState(summary ? { phase: 'ready', summary } : { phase: 'empty' })
      } catch {
        if (!ac.signal.aborted) setState({ phase: 'empty' })
      }
    })()
    return () => ac.abort()
  }, [])

  return state
}
