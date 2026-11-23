import { describe, expect, it, vi } from 'vitest'
import {
  DisallowedHostError,
  HttpClient,
  ServiceUnavailableError,
  assertAllowedUrl,
  parseRetryAfter,
} from '../src/lib/http.js'

const URL_OK = 'https://api.crossref.org/works/10.1/x'

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new Response(status === 404 ? 'Resource not found.' : text, { status, headers })
}

function client(
  responses: (Response | Error)[],
  extra: ConstructorParameters<typeof HttpClient>[0] = {},
) {
  const queue = [...responses]
  const fetchImpl = vi.fn(async () => {
    const next = queue.shift()
    if (next === undefined) throw new Error('no more scripted responses')
    if (next instanceof Error) throw next
    return next
  })
  const sleep = vi.fn(async (_ms: number) => {})
  const http = new HttpClient({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep,
    random: () => 0.5,
    ...extra,
  })
  return { http, fetchImpl, sleep }
}

const timeoutError = () => new DOMException('timed out', 'TimeoutError')

describe('HttpClient.getJson', () => {
  it('returns parsed JSON on 200', async () => {
    const { http } = client([json(200, { ok: true })])
    const r = await http.getJson(URL_OK, { service: 'crossref' })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
  })

  it('returns json null on 404 without retrying', async () => {
    const { http, fetchImpl } = client([json(404, '')])
    const r = await http.getJson(URL_OK, { service: 'crossref' })
    expect(r).toMatchObject({ status: 404, json: null })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries a 500 and then succeeds', async () => {
    const { http, fetchImpl, sleep } = client([json(500, ''), json(200, { ok: 1 })])
    const r = await http.getJson(URL_OK, { service: 'crossref' })
    expect(r.json).toEqual({ ok: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('uses exponential backoff between attempts', async () => {
    const { http, sleep } = client([json(503, ''), json(503, ''), json(200, {})], { maxRetries: 2 })
    await http.getJson(URL_OK, { service: 'crossref' })
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000]) // random() = 0.5 gives factor 1
  })

  it('honours Retry-After on 429', async () => {
    const { http, sleep } = client([json(429, '', { 'retry-after': '3' }), json(200, {})])
    await http.getJson(URL_OK, { service: 'crossref' })
    expect(sleep).toHaveBeenCalledWith(3000)
  })

  it('fails fast when Retry-After is longer than the cap', async () => {
    const { http, fetchImpl } = client([json(429, '', { 'retry-after': '3600' })])
    await expect(http.getJson(URL_OK, { service: 'openalex' })).rejects.toMatchObject({
      name: 'ServiceUnavailableError',
      code: 'rate_limited',
      status: 429,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws server_error after retries run out on 5xx', async () => {
    const { http, fetchImpl } = client([json(502, ''), json(502, ''), json(502, '')])
    await expect(http.getJson(URL_OK, { service: 'crossref' })).rejects.toMatchObject({
      code: 'server_error',
      status: 502,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('throws rate_limited after repeated 429 without Retry-After', async () => {
    const { http } = client([json(429, ''), json(429, ''), json(429, '')])
    await expect(http.getJson(URL_OK, { service: 'crossref' })).rejects.toMatchObject({
      code: 'rate_limited',
    })
  })

  it('retries timeouts, then reports timeout', async () => {
    const { http, fetchImpl } = client([timeoutError(), timeoutError(), timeoutError()])
    await expect(http.getJson(URL_OK, { service: 'crossref' })).rejects.toMatchObject({
      code: 'timeout',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('retries a network error and recovers', async () => {
    const { http } = client([new TypeError('fetch failed'), json(200, { a: 1 })])
    const r = await http.getJson(URL_OK, { service: 'crossref' })
    expect(r.json).toEqual({ a: 1 })
  })

  it('does not retry 403 (blocked)', async () => {
    const { http, fetchImpl } = client([json(403, '')])
    await expect(http.getJson(URL_OK, { service: 'openalex' })).rejects.toMatchObject({
      code: 'blocked',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('treats other 4xx as a bad response, without retrying', async () => {
    const { http, fetchImpl } = client([json(400, '')])
    await expect(http.getJson(URL_OK, { service: 'crossref' })).rejects.toMatchObject({
      code: 'bad_response',
      status: 400,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reports invalid JSON as a bad response', async () => {
    const { http } = client([json(200, '<html>not json</html>')])
    await expect(http.getJson(URL_OK, { service: 'crossref' })).rejects.toMatchObject({
      code: 'bad_response',
    })
  })

  it('passes response headers to onResponse', async () => {
    const { http } = client([json(200, {}, { 'x-rate-limit-limit': '10' })])
    const seen: (string | null)[] = []
    await http.getJson(URL_OK, {
      service: 'crossref',
      onResponse: (h) => seen.push(h.get('x-rate-limit-limit')),
    })
    expect(seen).toEqual(['10'])
  })

  it('sends accept and user-agent headers', async () => {
    const { http, fetchImpl } = client([json(200, {})], { userAgent: 'CekKutip/test' })
    await http.getJson(URL_OK, { service: 'crossref', headers: { authorization: 'Bearer k' } })
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.headers).toMatchObject({
      accept: 'application/json',
      'user-agent': 'CekKutip/test',
      authorization: 'Bearer k',
    })
  })

  it('never puts the request URL (and so user text) into an error message', async () => {
    const secret = 'my-private-thesis-title-xyz'
    const { http } = client([json(500, ''), json(500, ''), json(500, '')])
    const err = await http
      .getJson(`https://api.crossref.org/works?query.bibliographic=${secret}`, {
        service: 'crossref',
      })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ServiceUnavailableError)
    expect(String((err as Error).message)).not.toContain(secret)
  })
})

describe('HttpClient.getText', () => {
  const PAGE = 'https://garuda.kemdiktisaintek.go.id/documents?q=x'
  const html = (status: number, body = '<p>Found 0 documents</p>') =>
    new Response(body, { status, headers: { 'content-type': 'text/html' } })

  it('returns the body as text on 200, asking for HTML', async () => {
    const { http, fetchImpl } = client([html(200)], { userAgent: 'CekKutip/test' })
    const r = await http.getText(PAGE, { service: 'garuda', headers: { accept: 'text/html' } })
    expect(r).toMatchObject({ status: 200, text: '<p>Found 0 documents</p>' })
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.headers).toMatchObject({ accept: 'text/html', 'user-agent': 'CekKutip/test' })
  })

  it('returns text null on 404 without retrying', async () => {
    const { http, fetchImpl } = client([html(404, 'gone')])
    const r = await http.getText(PAGE, { service: 'garuda' })
    expect(r).toMatchObject({ status: 404, text: null })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries a 500 and then succeeds, like getJson', async () => {
    const { http, fetchImpl } = client([html(500, ''), html(200, 'ok')])
    const r = await http.getText(PAGE, { service: 'garuda' })
    expect(r.text).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('reports 403 as blocked, without retrying', async () => {
    const { http, fetchImpl } = client([html(403, 'Forbidden')])
    await expect(http.getText(PAGE, { service: 'garuda' })).rejects.toMatchObject({
      service: 'garuda',
      code: 'blocked',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('refuses a page larger than the limit, so a wrong answer cannot fill memory', async () => {
    const { http } = client([html(200, 'x'.repeat(1_000_001))])
    await expect(http.getText(PAGE, { service: 'garuda' })).rejects.toMatchObject({
      code: 'bad_response',
    })
  })

  it('never puts the request URL into an error message', async () => {
    const secret = 'my-private-thesis-title-xyz'
    const { http } = client([html(500, ''), html(500, ''), html(500, '')])
    const err = await http
      .getText(`https://garuda.kemdiktisaintek.go.id/documents?q=${secret}`, { service: 'garuda' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ServiceUnavailableError)
    expect(String((err as Error).message)).not.toContain(secret)
  })
})

describe('host allow-list', () => {
  it.each([
    'https://api.crossref.org/works',
    'https://api.openalex.org/works',
    'https://api.datacite.org/dois/10.1/x',
    'https://doi.org/doiRA/10.1/x',
    'https://garuda.kemdiktisaintek.go.id/documents?q=x',
  ])('allows %s', (u) => {
    expect(assertAllowedUrl(u).protocol).toBe('https:')
  })

  it.each([
    'http://api.crossref.org/works',
    'https://example.com/works',
    'https://api.crossref.org.evil.test/works',
    'https://user:pw@api.crossref.org/works',
    'https://doi.org.evil.test/x',
    'https://garuda.kemdiktisaintek.go.id.evil.test/documents',
    'http://garuda.kemdiktisaintek.go.id/documents',
    'https://sinta.kemdiktisaintek.go.id/', // SINTA answers 403 to programs and is not used
  ])('rejects %s', (u) => {
    expect(() => assertAllowedUrl(u)).toThrow(DisallowedHostError)
  })

  it('refuses to call a disallowed host at all', async () => {
    const { http, fetchImpl } = client([json(200, {})])
    await expect(http.getJson('https://example.com/x', { service: 'x' })).rejects.toBeInstanceOf(
      DisallowedHostError,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('follows a redirect to an allowed host', async () => {
    const { http, fetchImpl } = client([
      new Response(null, {
        status: 301,
        headers: { location: 'https://api.crossref.org/works/10.1/y' },
      }),
      json(200, { moved: true }),
    ])
    const r = await http.getJson(URL_OK, { service: 'crossref' })
    expect(r.json).toEqual({ moved: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('blocks a redirect to a disallowed host', async () => {
    const { http } = client([
      new Response(null, { status: 302, headers: { location: 'https://evil.test/steal' } }),
    ])
    await expect(http.getJson(URL_OK, { service: 'crossref' })).rejects.toBeInstanceOf(
      DisallowedHostError,
    )
  })
})

describe('parseRetryAfter', () => {
  it('parses seconds and HTTP dates', () => {
    expect(parseRetryAfter('5', 0)).toBe(5000)
    expect(parseRetryAfter('1.5', 0)).toBe(1500)
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:10 GMT', now)).toBe(10_000)
    expect(parseRetryAfter('Wed, 31 Dec 2025 23:00:00 GMT', now)).toBe(0)
  })

  it('returns null for missing or junk values', () => {
    expect(parseRetryAfter(null, 0)).toBeNull()
    expect(parseRetryAfter('soon', 0)).toBeNull()
  })
})
