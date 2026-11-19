import { useCallback, useEffect, useReducer, useRef } from 'react'
import { CheckError, streamCheck } from '../lib/api'
import type { ApiTarget } from '../lib/api'
import { checkReducer, initialCheckState } from './check'

export interface UseCheckOptions extends ApiTarget {
  /** Called when a check starts: the person's own Gemini key, or null to use the shared reader. */
  getKey?: () => string | null
}

/** Runs a check and keeps its state. Starting a new check cancels the one in flight. */
export function useCheck(options: UseCheckOptions = {}) {
  const [state, dispatch] = useReducer(checkReducer, initialCheckState)
  const controller = useRef<AbortController | null>(null)

  const { baseUrl, getKey } = options
  const run = useCallback(
    async (references: string[], parseMode: 'llm' | 'regex') => {
      controller.current?.abort()
      const ac = new AbortController()
      controller.current = ac
      // The key goes out only with the AI reader: a person who chose "no AI" sends no key.
      const key = parseMode === 'llm' ? (getKey?.() ?? null) : null
      dispatch({ type: 'start', references, parseMode, ownKey: key !== null })
      try {
        await streamCheck(
          references,
          parseMode,
          (event) => dispatch({ type: 'event', event }),
          ac.signal,
          { baseUrl, key },
        )
      } catch (err) {
        if (ac.signal.aborted) return
        dispatch({ type: 'fail', code: err instanceof CheckError ? err.code : 'generic' })
      }
    },
    [baseUrl, getKey],
  )

  const reset = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    dispatch({ type: 'reset' })
  }, [])

  useEffect(() => () => controller.current?.abort(), [])

  return { state, run, reset }
}
