import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'
import { StreamEventSchema } from '@cekkutip/shared'
import type { StreamEvent } from '@cekkutip/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import type { GeminiClient } from '../src/clients/gemini.js'
import { loadEnv } from '../src/config/env.js'
import { loadLimits } from '../src/config/limits.js'
import type { Limits } from '../src/config/limits.js'
import { createLogger, silentLogger } from '../src/lib/logger.js'
import type { AppLogger } from '../src/lib/logger.js'
import { TOOL_VERSION } from '../src/version.js'
import { fixtureText, ok, status } from './helpers.js'
import type { Rule } from './helpers.js'
import { FIXTURE_RULES, REF_FAKE_DOI, REF_OK, THESIS, world } from './world.js'

const servers: Server[] = []
const dirs: string[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))))
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})

interface Opts {
  rules?: Rule[]
  limits?: Partial<Limits>
  env?: NodeJS.ProcessEnv
  logger?: AppLogger
  gemini?: GeminiClient
  staticDir?: string
}

async function start(o: Opts = {}) {
  const w = world(o.rules ?? FIXTURE_RULES, o.gemini)
  const env = loadEnv({ NODE_ENV: 'test', ...o.env })
  const app = createApp({
    pipeline: w.deps,
    limits: { ...loadLimits({}), ...o.limits },
    env,
    logger: o.logger ?? silentLogger,
    staticDir: o.staticDir,
  })
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  servers.push(server)
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { base, w }
}

const post = (base: string, body: unknown, init: RequestInit = {}) =>
  fetch(`${base}/api/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  })

async function events(res: Response): Promise<StreamEvent[]> {
  const text = await res.text()
  return text
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => StreamEventSchema.parse(JSON.parse(l)))
}

async function errorOf(res: Response) {
  const body = (await res.json()) as { error: { code: string; message: string } }
  return body.error
}

describe('GET /api/health and /api/config', () => {
  it('reports status and version', async () => {
    const { base } = await start()
    const res = await fetch(`${base}/api/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', version: TOOL_VERSION })
  })

  it('keeps the tool version equal to package.json', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string
    }
    expect(TOOL_VERSION).toBe(pkg.version)
  })

  it('exposes only public limits, and whether AI is available', async () => {
    const { base } = await start({ limits: { maxReferences: 12, maxReferenceChars: 300 } })
    const body = await (await fetch(`${base}/api/config`)).json()
    expect(body).toEqual({
      maxReferences: 12,
      maxReferenceChars: 300,
      toolVersion: TOOL_VERSION,
      aiAvailable: false,
    })
  })
})

describe('POST /api/check', () => {
  it('streams started, results, and done as JSON lines', async () => {
    const { base } = await start()
    const res = await post(base, {
      references: [REF_OK, REF_FAKE_DOI, THESIS],
      options: { parseMode: 'regex' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/x-ndjson')
    expect(res.headers.get('cache-control')).toBe('no-store')

    const evs = await events(res)
    expect(evs[0]).toEqual({ type: 'started', total: 3 })
    expect(evs.at(-1)?.type).toBe('done')
    const results = evs.filter((e) => e.type === 'result')
    expect(results).toHaveLength(3)
    const done = evs.at(-1)
    expect(done?.type === 'done' && done.summary).toMatchObject({
      total: 3,
      verified: 1,
      suspect: 1,
      outOfIndex: 1,
      toolVersion: TOOL_VERSION,
    })
  })

  it('splits a single string of pasted text', async () => {
    const { base } = await start()
    const text = `1. ${REF_OK}\n2. ${REF_FAKE_DOI}`
    const evs = await events(await post(base, { references: text }))
    expect(evs[0]).toEqual({ type: 'started', total: 2 })
  })

  it('works when the client asks for AI but none is configured: it uses the no-AI reader', async () => {
    const { base } = await start()
    const evs = await events(
      await post(base, { references: [REF_OK], options: { parseMode: 'llm' } }),
    )
    const r = evs.find((e) => e.type === 'result')
    expect(r?.type === 'result' && r.result.parsed.parseMode).toBe('regex')
    expect(r?.type === 'result' && r.result.status).toBe('verified')
  })

  it('uses the model when one is configured and asked for', async () => {
    const gemini: GeminiClient = {
      extract: async (items) => ({
        usage: { inputTokens: 1, outputTokens: 1 },
        results: items.map((it) => ({
          i: it.i,
          authors: ['Walters', 'Wilder'],
          hasEtAl: false,
          year: 2023,
          title: 'Fabrication and errors in the bibliographic citations generated by ChatGPT',
          venue: 'Scientific Reports',
          volume: '13',
          issue: '1',
          pages: '14045',
          doi: null,
          type: 'journal_article',
        })),
      }),
    }
    const { base } = await start({ gemini })
    const config = (await (await fetch(`${base}/api/config`)).json()) as { aiAvailable: boolean }
    expect(config.aiAvailable).toBe(true)
    const evs = await events(
      await post(base, { references: [REF_OK], options: { parseMode: 'llm' } }),
    )
    const r = evs.find((e) => e.type === 'result')
    expect(r?.type === 'result' && r.result.parsed.parseMode).toBe('llm')
  })

  it('a lookup outage still ends in a complete stream, with check_failed', async () => {
    const { base } = await start({
      rules: [{ repeat: true, match: () => true, respond: () => status(503) }],
    })
    const evs = await events(await post(base, { references: [REF_OK] }))
    const done = evs.at(-1)
    expect(done?.type === 'done' && done.summary.checkFailed).toBe(1)
    expect(done?.type === 'done' && done.summary.suspect).toBe(0)
  })
})

describe('request validation: errors are consistent and human', () => {
  it('rejects a body that is not the expected shape', async () => {
    const { base } = await start()
    const res = await post(base, { nope: true })
    expect(res.status).toBe(400)
    const err = await errorOf(res)
    expect(err.code).toBe('invalid_request')
    expect(err.message).toMatch(/references/)
  })

  it('rejects text that is not JSON', async () => {
    const { base } = await start()
    const res = await post(base, '{not json')
    expect(res.status).toBe(400)
    expect((await errorOf(res)).code).toBe('invalid_json')
  })

  it('rejects a body over 64 KB with 413', async () => {
    const { base } = await start()
    const res = await post(base, { references: ['x'.repeat(70 * 1024)] })
    expect(res.status).toBe(413)
    expect((await errorOf(res)).code).toBe('payload_too_large')
  })

  it('rejects a list with nothing in it', async () => {
    const { base } = await start()
    for (const references of ['   ', [], ['', '  ']]) {
      const res = await post(base, { references })
      expect(res.status).toBe(400)
      expect((await errorOf(res)).code).toBe('no_references')
    }
  })

  it('rejects too many references with the copy-deck sentence, and does not run any of them', async () => {
    const { base, w } = await start({ limits: { maxReferences: 3 } })
    const res = await post(base, { references: ['a', 'b', 'c', 'd'] })
    expect(res.status).toBe(400)
    const err = await errorOf(res)
    expect(err.code).toBe('too_many_references')
    expect(err.message).toBe(
      'You can check up to 3 references at a time. Split your list and check it in parts.',
    )
    expect(w.calls).toHaveLength(0)
  })

  it('rejects an over-long reference instead of cutting it', async () => {
    const { base } = await start({ limits: { maxReferenceChars: 50 } })
    const res = await post(base, { references: ['short', 'x'.repeat(51)] })
    expect(res.status).toBe(400)
    const err = await errorOf(res)
    expect(err.code).toBe('reference_too_long')
    expect(err.message).toContain('Reference 2')
  })

  it('answers unknown API paths with the same error shape', async () => {
    const { base } = await start()
    const res = await fetch(`${base}/api/nothing-here`)
    expect(res.status).toBe(404)
    expect((await errorOf(res)).code).toBe('not_found')
  })
})

describe('experiment options', () => {
  const thesisBody = { references: [THESIS], options: { parseMode: 'regex' as const } }

  it('are refused unless ENABLE_EXPERIMENT_MODES is on', async () => {
    const { base } = await start()
    for (const options of [{ ablation: 'a1' }, { system: 'cekkutip' }]) {
      const res = await post(base, { references: [REF_OK], options })
      expect(res.status).toBe(400)
      expect((await errorOf(res)).code).toBe('experiment_modes_disabled')
    }
  })

  it('are refused in production even if the variable is set', async () => {
    const { base } = await start({
      env: { NODE_ENV: 'production', ENABLE_EXPERIMENT_MODES: 'true' },
    })
    const res = await post(base, { references: [REF_OK], options: { ablation: 'a1' } })
    expect((await errorOf(res)).code).toBe('experiment_modes_disabled')
  })

  it('apply an ablation when enabled', async () => {
    const { base } = await start({ env: { ENABLE_EXPERIMENT_MODES: 'true' } })
    const normal = await events(await post(base, thesisBody))
    const a1 = await events(
      await post(base, { ...thesisBody, options: { ...thesisBody.options, ablation: 'a1' } }),
    )
    const status = (evs: StreamEvent[]) => {
      const r = evs.find((e) => e.type === 'result')
      return r?.type === 'result' ? r.result.status : null
    }
    expect(status(normal)).toBe('out_of_index')
    expect(status(a1)).toBe('suspect')
  })

  it('reject unknown ablations and systems', async () => {
    const { base } = await start({ env: { ENABLE_EXPERIMENT_MODES: 'true' } })
    expect(
      (await errorOf(await post(base, { references: [REF_OK], options: { ablation: 'zz' } }))).code,
    ).toBe('unknown_ablation')
    expect(
      (
        await errorOf(
          await post(base, { references: [REF_OK], options: { system: 'b1_llm_only' } }),
        )
      ).code,
    ).toBe('unknown_system')
  })
})

describe('rate limit', () => {
  it('limits /api/check per client and answers with the standard error shape', async () => {
    const { base } = await start({ limits: { rateLimitMax: 2, rateLimitWindowMs: 60_000 } })
    const ok1 = await post(base, { references: [REF_OK] })
    await ok1.text()
    const ok2 = await post(base, { references: [REF_OK] })
    await ok2.text()
    const limited = await post(base, { references: [REF_OK] })
    expect(limited.status).toBe(429)
    const err = await errorOf(limited)
    expect(err.code).toBe('rate_limited')
    expect(err.message).not.toBe('')
    expect(limited.headers.get('ratelimit') ?? limited.headers.get('ratelimit-policy')).toBeTruthy()
  })

  it('does not limit health or config', async () => {
    const { base } = await start({ limits: { rateLimitMax: 1 } })
    for (let i = 0; i < 5; i++) expect((await fetch(`${base}/api/health`)).status).toBe(200)
  })
})

describe('security headers', () => {
  it('sends a strict same-origin CSP with no inline script or style', async () => {
    const { base } = await start()
    const csp = (await fetch(`${base}/api/health`)).headers.get('content-security-policy') ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("style-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).not.toContain('unsafe-eval')
  })

  it('does not advertise the framework and sends no CORS headers', async () => {
    const { base } = await start()
    const res = await fetch(`${base}/api/health`, { headers: { origin: 'https://evil.test' } })
    expect(res.headers.get('x-powered-by')).toBeNull()
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('privacy: user text never reaches the logs', () => {
  const SECRET = 'ZQXSECRETTHESISTITLE'
  const secretRef = `Wijaya, A. (2020). ${SECRET} dampak rahasia. Jurnal Rahasia, 3(2), 10-20. https://doi.org/10.9999/${SECRET}`

  function capture() {
    const lines: string[] = []
    const destination = new Writable({
      write(chunk: Buffer, _enc, cb) {
        lines.push(chunk.toString())
        cb()
      },
    })
    return { lines, logger: createLogger({ level: 'debug', destination }) }
  }

  it('keeps reference text, titles, and DOIs out of every log line, success or failure', async () => {
    const { lines, logger } = capture()
    const failingRules: Rule[] = [{ repeat: true, match: () => true, respond: () => status(503) }]

    // 1. a normal check, 2. a check where every lookup fails, 3. invalid input, 4. over the limit.
    const a = await start({ logger })
    await (await post(a.base, { references: [secretRef, REF_OK] })).text()
    const b = await start({ logger, rules: failingRules })
    await (await post(b.base, { references: [secretRef] })).text()
    await post(a.base, { references: secretRef.repeat(1), nope: SECRET })
    const c = await start({ logger, limits: { maxReferences: 1 } })
    await post(c.base, { references: [secretRef, secretRef] })
    await post(c.base, `{"references": "${SECRET}`)

    const log = lines.join('')
    expect(log.length).toBeGreaterThan(0)
    expect(log).not.toContain(SECRET)
    expect(log.toLowerCase()).not.toContain('rahasia')
    expect(log).not.toContain('Wijaya')
    expect(log).not.toContain('10.9999')
    expect(log).not.toContain('Walters')
    expect(log).not.toContain('crossref.org') // no URLs either
  })

  it('logs only ids, counts, timings, and codes', async () => {
    const { lines, logger } = capture()
    const failing: Rule[] = [{ repeat: true, match: () => true, respond: () => status(503) }]
    const { base } = await start({ logger, rules: failing })
    await (await post(base, { references: [REF_OK, REF_OK + ' x'] })).text()

    const entries = lines.map((l) => JSON.parse(l) as Record<string, unknown>)
    const allowed = new Set([
      'level',
      'time',
      'event',
      'reqId',
      'count',
      'parseMode',
      'latencyMs',
      'checkFailed',
      'aborted',
      'code',
      'port',
      'aiAvailable',
      'version',
      'msg',
    ])
    for (const e of entries)
      for (const k of Object.keys(e)) expect(allowed, `unexpected log field "${k}"`).toContain(k)

    const check = entries.find((e) => e.event === 'check')
    expect(check).toMatchObject({ count: 2, parseMode: 'regex', checkFailed: 2, aborted: false })
    expect(entries.some((e) => e.event === 'lookup_error' && e.code === 'server_error')).toBe(true)
  })

  it('records an aborted check when the browser goes away', async () => {
    const { lines, logger } = capture()
    const slow: Rule[] = [
      {
        repeat: true,
        match: () => true,
        respond: async () => {
          await new Promise((r) => setTimeout(r, 300))
          return ok(fixtureText('crossref-search-walters.json'))
        },
      },
    ]
    const { base } = await start({ logger, rules: slow })
    const controller = new AbortController()
    const res = await post(base, { references: [REF_OK] }, { signal: controller.signal })
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    await reader.read() // the "started" line
    controller.abort()
    await reader.cancel().catch(() => {})
    for (let i = 0; i < 40 && !lines.join('').includes('"event":"check"'); i++)
      await new Promise((r) => setTimeout(r, 25))
    const check = lines
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((e) => e.event === 'check')
    expect(check).toMatchObject({ aborted: true })
  })
})

describe('serving the built web app', () => {
  async function site() {
    const dir = await mkdtemp(path.join(tmpdir(), 'cekkutip-web-'))
    dirs.push(dir)
    await mkdir(path.join(dir, 'assets'))
    await writeFile(
      path.join(dir, 'index.html'),
      '<!doctype html><title>CekKutip</title><div id="root"></div>',
    )
    await writeFile(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)')
    await writeFile(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    return dir
  }

  it('serves index.html at / and for client-side routes', async () => {
    const { base } = await start({ staticDir: await site() })
    for (const p of ['/', '/how-it-works', '/evaluation', '/some/deep/link']) {
      const res = await fetch(base + p)
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('id="root"')
      expect(res.headers.get('cache-control')).toBe('no-cache')
    }
  })

  it('serves hashed assets with long-lived caching and other files normally', async () => {
    const { base } = await start({ staticDir: await site() })
    const asset = await fetch(`${base}/assets/app-abc123.js`)
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toContain('immutable')
    expect((await fetch(`${base}/favicon.svg`)).status).toBe(200)
  })

  it('never answers an unknown API path with the web page', async () => {
    const { base } = await start({ staticDir: await site() })
    const res = await fetch(`${base}/api/unknown`)
    expect(res.status).toBe(404)
    expect((await errorOf(res)).code).toBe('not_found')
  })

  it('still serves the API next to the site', async () => {
    const { base } = await start({ staticDir: await site() })
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
  })

  it('serves only the API when there is no build', async () => {
    const { base } = await start()
    expect((await fetch(`${base}/`)).status).toBe(404)
  })
})
