import type { Scheduler } from './scheduler.js'

/** The only hosts this server may call (brief section 11). */
export const ALLOWED_HOSTS: readonly string[] = [
  'api.crossref.org',
  'api.openalex.org',
  'api.datacite.org',
  'doi.org',
]

export type ServiceErrorCode =
  'timeout' | 'network' | 'rate_limited' | 'server_error' | 'blocked' | 'bad_response'

/**
 * A lookup service could not give an answer. The pipeline turns this into `check_failed`,
 * never into a verdict. The message never contains the request URL, because URLs carry user text.
 */
export class ServiceUnavailableError extends Error {
  constructor(
    readonly service: string,
    readonly code: ServiceErrorCode,
    readonly status?: number,
  ) {
    super(`${service} unavailable (${code}${status ? ` ${status}` : ''})`)
    this.name = 'ServiceUnavailableError'
  }
}

/** A code path tried to call a host outside the allow-list. This is a bug, not a service outage. */
export class DisallowedHostError extends Error {
  constructor(host: string) {
    super(`Host not allowed: ${host}`)
    this.name = 'DisallowedHostError'
  }
}

export function assertAllowedUrl(raw: string, allowed: readonly string[] = ALLOWED_HOSTS): URL {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    throw new DisallowedHostError(url.host)
  }
  if (!allowed.includes(url.hostname)) throw new DisallowedHostError(url.hostname)
  return url
}

export interface HttpResult {
  status: number
  /** Parsed JSON for 2xx responses; null for 404. */
  json: unknown
  headers: Headers
}

export interface HttpClientOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** Retries after the first attempt. Total attempts = maxRetries + 1. */
  maxRetries?: number
  baseDelayMs?: number
  /** A Retry-After longer than this fails fast instead of waiting. */
  maxRetryAfterMs?: number
  userAgent?: string
  allowedHosts?: readonly string[]
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  now?: () => number
}

export interface GetJsonOptions {
  service: string
  scheduler?: Scheduler
  headers?: Record<string, string>
  /** Called with the headers of every response, so a client can adapt to advertised limits. */
  onResponse?: (headers: Headers) => void
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const MAX_REDIRECTS = 3

export function parseRetryAfter(value: string | null, now: number): number | null {
  if (value === null) return null
  const v = value.trim()
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number(v) * 1000)
  const date = Date.parse(v)
  return Number.isNaN(date) ? null : Math.max(0, date - now)
}

export class HttpClient {
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly baseDelayMs: number
  private readonly maxRetryAfterMs: number
  private readonly userAgent: string
  private readonly allowedHosts: readonly string[]
  private readonly sleep: (ms: number) => Promise<void>
  private readonly random: () => number
  private readonly now: () => number

  constructor(opts: HttpClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.timeoutMs = opts.timeoutMs ?? 8000
    this.maxRetries = opts.maxRetries ?? 2
    this.baseDelayMs = opts.baseDelayMs ?? 500
    this.maxRetryAfterMs = opts.maxRetryAfterMs ?? 10_000
    this.userAgent = opts.userAgent ?? 'CekKutip'
    this.allowedHosts = opts.allowedHosts ?? ALLOWED_HOSTS
    this.sleep = opts.sleep ?? realSleep
    this.random = opts.random ?? Math.random
    this.now = opts.now ?? Date.now
  }

  /**
   * GET a JSON document. 2xx returns the parsed body, 404 returns `json: null`.
   * 429 and 5xx and network failures are retried with exponential backoff and jitter
   * (honouring Retry-After). When retries run out this throws ServiceUnavailableError.
   */
  async getJson(rawUrl: string, opts: GetJsonOptions): Promise<HttpResult> {
    assertAllowedUrl(rawUrl, this.allowedHosts)
    let lastError: ServiceUnavailableError | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let waitMs = this.backoff(attempt)
      try {
        const run = () => this.fetchOnce(rawUrl, opts)
        const res = opts.scheduler ? await opts.scheduler.run(run) : await run()
        opts.onResponse?.(res.headers)

        if (res.status >= 200 && res.status < 300) {
          let json: unknown
          try {
            json = JSON.parse(res.text)
          } catch {
            throw new ServiceUnavailableError(opts.service, 'bad_response', res.status)
          }
          return { status: res.status, json, headers: res.headers }
        }
        if (res.status === 404) return { status: 404, json: null, headers: res.headers }
        if (res.status === 403) throw new ServiceUnavailableError(opts.service, 'blocked', 403)
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = parseRetryAfter(res.headers.get('retry-after'), this.now())
          if (retryAfter !== null) {
            if (retryAfter > this.maxRetryAfterMs) {
              throw new ServiceUnavailableError(opts.service, 'rate_limited', res.status)
            }
            waitMs = Math.max(waitMs, retryAfter)
          }
          lastError = new ServiceUnavailableError(
            opts.service,
            res.status === 429 ? 'rate_limited' : 'server_error',
            res.status,
          )
        } else {
          throw new ServiceUnavailableError(opts.service, 'bad_response', res.status)
        }
      } catch (err) {
        // Anything thrown deliberately above is final. Retryable statuses are recorded in
        // `lastError` without throwing, so only raw fetch failures (network, timeout) land here.
        if (err instanceof ServiceUnavailableError || err instanceof DisallowedHostError) throw err
        lastError = new ServiceUnavailableError(
          opts.service,
          isTimeout(err) ? 'timeout' : 'network',
        )
      }

      if (attempt < this.maxRetries) await this.sleep(waitMs)
    }
    throw lastError ?? new ServiceUnavailableError(opts.service, 'network')
  }

  private backoff(attempt: number): number {
    const exp = this.baseDelayMs * 2 ** attempt
    return Math.round(exp * (0.75 + this.random() * 0.5))
  }

  private async fetchOnce(
    rawUrl: string,
    opts: GetJsonOptions,
  ): Promise<{ status: number; text: string; headers: Headers }> {
    let url = rawUrl
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertAllowedUrl(url, this.allowedHosts)
      const res = await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { accept: 'application/json', 'user-agent': this.userAgent, ...opts.headers },
      })
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) throw new ServiceUnavailableError(opts.service, 'bad_response', res.status)
        url = new URL(location, url).toString() // re-checked against the allow-list on the next hop
        continue
      }
      return { status: res.status, text: await res.text(), headers: res.headers }
    }
    throw new ServiceUnavailableError(opts.service, 'bad_response', 310)
  }
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
}
