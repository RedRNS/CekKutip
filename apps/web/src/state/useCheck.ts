import { useCallback, useEffect, useReducer, useRef } from 'react'
import { CheckError, streamCheck } from '../lib/api'
import { checkReducer, initialCheckState } from './check'

/** Runs a check and keeps its state. Starting a new check cancels the one in flight. */
export function useCheck() {
  const [state, dispatch] = useReducer(checkReducer, initialCheckState)
  const controller = useRef<AbortController | null>(null)

  const run = useCallback(async (references: string[], parseMode: 'llm' | 'regex') => {
    controller.current?.abort()
    const ac = new AbortController()
    controller.current = ac
    dispatch({ type: 'start', references, parseMode })
    try {
      await streamCheck(
        references,
        parseMode,
        (event) => dispatch({ type: 'event', event }),
        ac.signal,
      )
    } catch (err) {
      if (ac.signal.aborted) return
      dispatch({ type: 'fail', code: err instanceof CheckError ? err.code : 'generic' })
    }
  }, [])

  const reset = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    dispatch({ type: 'reset' })
  }, [])

  useEffect(() => () => controller.current?.abort(), [])

  return { state, run, reset }
}
