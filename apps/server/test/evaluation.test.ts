import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fixtureSummary } from '@cekkutip/shared/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import { loadLimits } from '../src/config/limits.js'
import { silentLogger } from '../src/lib/logger.js'
import { world } from './world.js'

const servers: Server[] = []
const dirs: string[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))))
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function folder() {
  const d = mkdtempSync(path.join(tmpdir(), 'cekkutip-evalapi-'))
  dirs.push(d)
  return d
}

async function start(evaluationFile: string | undefined, staticDir?: string) {
  const app = createApp({
    pipeline: world().deps,
    limits: loadLimits({}),
    env: loadEnv({ NODE_ENV: 'test' }),
    logger: silentLogger,
    evaluationFile,
    staticDir,
  })
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  servers.push(server)
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const get = (base: string) => fetch(`${base}/api/evaluation`)

describe('GET /api/evaluation', () => {
  it('serves a complete summary of real results', async () => {
    const file = path.join(folder(), 'summary.json')
    writeFileSync(file, JSON.stringify(fixtureSummary()))
    const res = await get(await start(file))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(await res.json()).toEqual(fixtureSummary())
  })

  it('says there are no results, with a normal 200, when there is no file', async () => {
    const res = await get(await start(path.join(folder(), 'missing.json')))
    expect(res.status).toBe(200) // not an error: it must not put a line in the browser console
    expect(await res.json()).toEqual({ available: false })
  })

  it('says there are no results when no file is configured', async () => {
    expect(await (await get(await start(undefined))).json()).toEqual({ available: false })
  })

  it('never serves a summary made from the template data', async () => {
    const file = path.join(folder(), 'summary.json')
    writeFileSync(file, JSON.stringify(fixtureSummary({ sample: true })))
    expect(await (await get(await start(file))).json()).toEqual({ available: false })
  })

  it('says there are no results for invalid JSON and for an incomplete summary', async () => {
    const file = path.join(folder(), 'summary.json')
    writeFileSync(file, '{not json')
    const base = await start(file)
    expect(await (await get(base)).json()).toEqual({ available: false })
    writeFileSync(file, JSON.stringify({ sample: false, runs: [] }))
    const later = new Date(Date.now() + 5000)
    utimesSync(file, later, later)
    expect(await (await get(base)).json()).toEqual({ available: false })
  })

  it('picks up new results without a restart', async () => {
    const dir = folder()
    const file = path.join(dir, 'summary.json')
    const base = await start(file)
    expect(await (await get(base)).json()).toEqual({ available: false })
    writeFileSync(file, JSON.stringify(fixtureSummary()))
    expect(((await (await get(base)).json()) as { sample: boolean }).sample).toBe(false)
    writeFileSync(file, JSON.stringify(fixtureSummary({ commit: 'newer00' })))
    const later = new Date(Date.now() + 5000)
    utimesSync(file, later, later)
    expect(((await (await get(base)).json()) as { commit: string }).commit).toBe('newer00')
  })

  it('is not rate limited and sends the security headers', async () => {
    const file = path.join(folder(), 'summary.json')
    writeFileSync(file, JSON.stringify(fixtureSummary()))
    const res = await get(await start(file))
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'")
  })
})

describe('the Evaluation page gets its state inside the HTML on a direct visit', () => {
  const MARK = '<script id="cekkutip-evaluation" type="application/json">'

  function site() {
    const dir = folder()
    mkdirSync(path.join(dir, 'assets'))
    writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><html><head><title>CekKutip</title></head><body><div id="root"></div></body></html>',
    )
    return dir
  }

  const html = async (base: string, route: string) => (await fetch(base + route)).text()
  const blockOf = (page: string) => {
    const start = page.indexOf(MARK)
    return start < 0 ? null : page.slice(start + MARK.length, page.indexOf('</script>', start))
  }

  it('carries the summary of real results in a data block before the end of the head', async () => {
    const file = path.join(folder(), 'summary.json')
    writeFileSync(file, JSON.stringify(fixtureSummary()))
    const page = await html(await start(file, site()), '/evaluation')
    expect(JSON.parse(blockOf(page) as string)).toEqual(fixtureSummary())
    expect(page.indexOf(MARK)).toBeLessThan(page.indexOf('</head>'))
    expect(page).toContain('<div id="root"></div>') // the rest of the page is untouched
  })

  it('carries { available: false } when there are no results, or only sample data', async () => {
    const base = await start(path.join(folder(), 'missing.json'), site())
    expect(JSON.parse(blockOf(await html(base, '/evaluation')) as string)).toEqual({
      available: false,
    })
    const file = path.join(folder(), 'summary.json')
    writeFileSync(file, JSON.stringify(fixtureSummary({ sample: true })))
    const sample = await start(file, site())
    expect(JSON.parse(blockOf(await html(sample, '/evaluation')) as string)).toEqual({
      available: false,
    })
  })

  it('cannot be broken out of: text that looks like HTML inside the data stays inert', async () => {
    const file = path.join(folder(), 'summary.json')
    const evil = '</script><img src=x onerror=alert(1)><!--'
    writeFileSync(file, JSON.stringify(fixtureSummary({ commit: evil })))
    const page = await html(await start(file, site()), '/evaluation')
    expect(page).not.toContain('<img src=x')
    expect(page.split('</script>').length).toBe(2) // only the real closing tag of the data block
    expect((JSON.parse(blockOf(page) as string) as { commit: string }).commit).toBe(evil) // and the data is intact
  })

  it('is added to the Evaluation address only, not to other pages', async () => {
    const base = await start(path.join(folder(), 'missing.json'), site())
    for (const route of ['/', '/about', '/how-it-works', '/privacy']) {
      expect(await html(base, route)).not.toContain('cekkutip-evaluation')
    }
  })

  it('is not cached, so new results show up on the next visit', async () => {
    const base = await start(path.join(folder(), 'missing.json'), site())
    expect((await fetch(base + '/evaluation')).headers.get('cache-control')).toBe('no-cache')
  })

  it('follows a change of the summary file without a restart', async () => {
    const dir = site()
    const file = path.join(folder(), 'summary.json')
    const base = await start(file, dir)
    expect(JSON.parse(blockOf(await html(base, '/evaluation')) as string)).toEqual({
      available: false,
    })
    writeFileSync(file, JSON.stringify(fixtureSummary()))
    expect(
      (JSON.parse(blockOf(await html(base, '/evaluation')) as string) as { commit: string }).commit,
    ).toBe('abc1234')
  })
})
