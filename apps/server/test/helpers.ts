import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'
import { HttpClient } from '../src/lib/http.js'

export function fixturePath(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
}

export function fixtureText(name: string): string {
  return readFileSync(fixturePath(name), 'utf8')
}

export function fixtureJson<T = unknown>(name: string): T {
  return JSON.parse(fixtureText(name)) as T
}

export interface Rule {
  match: (url: string) => boolean
  respond: () => Response | Error | Promise<Response | Error>
  /** Keep answering matching requests instead of being used once. */
  repeat?: boolean
}

export const ok = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, headers })

export const status = (code: number, body = '', headers: Record<string, string> = {}) =>
  new Response(body, { status: code, headers })

/**
 * A fetch stand-in that answers from rules in order. Each rule is used once unless it is `repeat`.
 * Unmatched requests fail the test loudly: no test may reach the real network.
 */
export function stubFetch(rules: Rule[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const remaining = [...rules]
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const i = remaining.findIndex((r) => r.match(url))
    if (i < 0) throw new Error(`Unexpected request in test: ${new URL(url).pathname}`)
    const rule = remaining[i]
    if (!rule?.repeat) remaining.splice(i, 1)
    const result = await (rule as Rule).respond()
    if (result instanceof Error) throw result
    return result
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls }
}

export function testHttp(
  fetchImpl: typeof fetch,
  extra: ConstructorParameters<typeof HttpClient>[0] = {},
) {
  return new HttpClient({ fetchImpl, sleep: async () => {}, random: () => 0.5, ...extra })
}

export const urlHas =
  (...parts: string[]) =>
  (url: string) =>
    parts.every((p) => url.includes(p))
