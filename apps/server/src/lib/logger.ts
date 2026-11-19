import { pino } from 'pino'
import type { DestinationStream } from 'pino'

/**
 * The only logger the app uses. Privacy by construction: it has a fixed set of methods that accept
 * only ids, counts, timings, and error codes. There is no way to hand it a reference, a title, a URL,
 * or a request body, so user text cannot reach the logs. (A test checks the output.)
 */
export interface AppLogger {
  started(info: { port: number; aiAvailable: boolean; version: string }): void
  check(info: {
    reqId: string
    count: number
    parseMode: 'llm' | 'regex'
    /** True when the person sent their own AI key. A flag only: the key is never logged. */
    ownKey: boolean
    latencyMs: number
    checkFailed: number
    aborted: boolean
  }): void
  /** A lookup or parse step failed. `code` is a short machine code such as "timeout". */
  lookupError(info: { reqId: string; code: string }): void
  rejected(info: { reqId: string; code: string }): void
  failure(info: { reqId?: string; code: string }): void
}

export function createLogger(
  opts: { level?: string; destination?: DestinationStream } = {},
): AppLogger {
  const log = pino({ level: opts.level ?? 'info', base: undefined }, opts.destination)
  return {
    started: (i) => log.info({ event: 'started', ...i }),
    check: (i) => log.info({ event: 'check', ...i }),
    lookupError: (i) => log.warn({ event: 'lookup_error', ...i }),
    rejected: (i) => log.info({ event: 'rejected', ...i }),
    failure: (i) => log.error({ event: 'failure', ...i }),
  }
}

export const silentLogger: AppLogger = {
  started: () => {},
  check: () => {},
  lookupError: () => {},
  rejected: () => {},
  failure: () => {},
}
