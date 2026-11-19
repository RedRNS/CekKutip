import type { PublicConfig, StreamEvent } from '@cekkutip/shared'
import { GEMINI_KEY_HEADER } from '@cekkutip/shared/apikey'

export type ClientErrorCode =
  | 'network'
  | 'rate_limited'
  | 'too_many_references'
  | 'reference_too_long'
  | 'no_references'
  | 'invalid_api_key'
  | 'incomplete'
  | 'generic'

/** A check could not start or finish. The code selects a fixed, translated message. */
export class CheckError extends Error {
  constructor(readonly code: ClientErrorCode) {
    super(code)
    this.name = 'CheckError'
  }
}

const KNOWN: readonly ClientErrorCode[] = [
  'rate_limited',
  'too_many_references',
  'reference_too_long',
  'no_references',
  'invalid_api_key',
]

export function toClientCode(status: number, serverCode: unknown): ClientErrorCode {
  if (status === 429) return 'rate_limited'
  if (status === 413) return 'too_many_references'
  return KNOWN.includes(serverCode as ClientErrorCode) ? (serverCode as ClientErrorCode) : 'generic'
}

export const DEFAULT_CONFIG: PublicConfig = {
  maxReferences: 40,
  maxReferenceChars: 600,
  toolVersion: '',
  aiAvailable: true,
}

/** Where the server is. The website uses its own origin (an empty string); the extension names it. */
export interface ApiTarget {
  baseUrl?: string
}

export async function fetchConfig(
  signal?: AbortSignal,
  target: ApiTarget = {},
): Promise<PublicConfig> {
  try {
    const res = await fetch(`${target.baseUrl ?? ''}/api/config`, { signal })
    if (!res.ok) return DEFAULT_CONFIG
    const body = (await res.json()) as Partial<PublicConfig>
    return {
      maxReferences: Number(body.maxReferences) || DEFAULT_CONFIG.maxReferences,
      maxReferenceChars: Number(body.maxReferenceChars) || DEFAULT_CONFIG.maxReferenceChars,
      toolVersion: typeof body.toolVersion === 'string' ? body.toolVersion : '',
      aiAvailable: body.aiAvailable !== false,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

/** Collects text chunks and calls `onLine` once per complete, non-empty line. */
export function createLineParser(onLine: (line: string) => void) {
  let buffer = ''
  return {
    push(chunk: string) {
      buffer += chunk
      let nl = buffer.indexOf('\n')
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (line !== '') onLine(line)
        nl = buffer.indexOf('\n')
      }
    },
    flush() {
      const line = buffer.trim()
      buffer = ''
      if (line !== '') onLine(line)
    },
  }
}

/** Parse one stream line. Unknown or malformed lines are ignored rather than trusted. */
export function parseEvent(line: string): StreamEvent | null {
  try {
    const e = JSON.parse(line) as {
      type?: unknown
      total?: unknown
      result?: unknown
      summary?: unknown
    }
    if (e.type === 'started' && typeof e.total === 'number') return e as StreamEvent
    if (e.type === 'result' && typeof e.result === 'object' && e.result !== null)
      return e as StreamEvent
    if (e.type === 'done' && typeof e.summary === 'object' && e.summary !== null)
      return e as StreamEvent
    return null
  } catch {
    return null
  }
}

/**
 * Send references and read the NDJSON stream. Resolves after the `done` event.
 * Rejects with CheckError when the check cannot start, or stops before `done`.
 */
export interface StreamOptions extends ApiTarget {
  /** The person's own Gemini key. Sent only when the AI reader is used, and only in a header. */
  key?: string | null
}

export async function streamCheck(
  references: string[],
  parseMode: 'llm' | 'regex',
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
  options: StreamOptions = {},
): Promise<void> {
  let res: Response
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.key && parseMode === 'llm') headers[GEMINI_KEY_HEADER] = options.key
  try {
    res = await fetch(`${options.baseUrl ?? ''}/api/check`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ references, options: { parseMode } }),
      signal,
    })
  } catch (err) {
    if (signal.aborted) throw err
    throw new CheckError('network')
  }

  if (!res.ok) {
    let serverCode: unknown
    try {
      serverCode = ((await res.json()) as { error?: { code?: unknown } }).error?.code
    } catch {
      /* not JSON: fall through to the generic message */
    }
    throw new CheckError(toClientCode(res.status, serverCode))
  }
  if (!res.body) throw new CheckError('generic')

  let finished = false
  const parser = createLineParser((line) => {
    const event = parseEvent(line)
    if (!event) return
    if (event.type === 'done') finished = true
    onEvent(event)
  })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    parser.flush()
  } catch (err) {
    if (signal.aborted) throw err
    throw new CheckError('incomplete')
  }
  if (!finished) throw new CheckError('incomplete')
}
