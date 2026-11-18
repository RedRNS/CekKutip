/**
 * Check the production artifact the way the Docker image will run it, without Docker.
 *
 *   npm run build            (needs the web build to pass the placeholder check, or CEKKUTIP_ALLOW_TODO=1)
 *   npx tsx scripts/verify-production.ts
 *
 * It copies only what the image contains into a clean folder (the bundle, the built web app, and the
 * lockfile), installs production dependencies only, starts the server with NODE_ENV=production, and
 * checks it over HTTP. Lookups are answered from the recorded cache, so no network and no keys are used.
 */
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const bundle = path.join(root, 'dist', 'server')
const web = path.join(root, 'apps', 'web', 'dist')
for (const p of [path.join(bundle, 'index.js'), path.join(web, 'index.html')]) {
  if (!existsSync(p))
    throw new Error(`Missing ${path.relative(root, p)}. Run "npm run build" first.`)
}

const results: { ok: boolean; name: string; detail?: string }[] = []
const check = (name: string, ok: boolean, detail?: string) => {
  results.push({ ok, name, detail })
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${!ok && detail ? `  (${detail})` : ''}`)
}

const dir = mkdtempSync(path.join(tmpdir(), 'cekkutip-prod-'))
let child: ReturnType<typeof spawn> | null = null
const cleanup = () => {
  child?.kill()
  rmSync(dir, { recursive: true, force: true })
}

try {
  // 1. Only what the image has: package files, the lockfile, the bundle, the web build, eval/results.
  for (const f of [
    'package.json',
    'package-lock.json',
    'apps/server/package.json',
    'apps/web/package.json',
    'packages/shared/package.json',
  ]) {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    cpSync(path.join(root, f), path.join(dir, f))
  }
  cpSync(bundle, path.join(dir, 'server'), { recursive: true })
  cpSync(web, path.join(dir, 'web'), { recursive: true })
  mkdirSync(path.join(dir, 'eval', 'results'), { recursive: true })

  // 2. Production dependencies of the server only.
  console.log('installing production dependencies (npm ci --omit=dev) ...')
  const install = await new Promise<number>((resolve) => {
    const p = spawn(
      'npm',
      ['ci', '--omit=dev', '-w', '@cekkutip/server', '--ignore-scripts', '--no-audit', '--no-fund'],
      {
        cwd: dir,
        shell: true,
        stdio: 'ignore',
      },
    )
    p.on('close', (code) => resolve(code ?? 1))
  })
  check('npm ci --omit=dev succeeds from the lockfile', install === 0)
  if (install !== 0) throw new Error('npm ci failed')
  const has = (name: string) => existsSync(path.join(dir, 'node_modules', name))
  check(
    'runtime packages are installed',
    [
      'express',
      'pino',
      'helmet',
      'zod',
      'compression',
      'express-rate-limit',
      '@google/genai',
    ].every(has),
  )
  check(
    'development tools are NOT installed',
    !['vite', 'vitest', 'typescript', 'esbuild', '@playwright/test', 'tsx', 'eslint'].some(has),
  )

  // 3. Start it like the image does.
  const port = await new Promise<number>((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })
  const env = {
    PATH: process.env.PATH ?? '',
    SYSTEMROOT: process.env.SYSTEMROOT ?? '',
    NODE_ENV: 'production',
    PORT: String(port),
    STATIC_DIR: path.join(dir, 'web'),
    EVALUATION_SUMMARY: path.join(dir, 'eval', 'results', 'summary.json'),
    RETRIEVAL_CACHE_DIR: path.join(root, 'apps', 'web', 'e2e', 'cache'),
    RETRIEVAL_CACHE_REPLAY_ONLY: 'true',
    RATE_LIMIT_MAX: '1000',
    LOG_LEVEL: 'warn',
  }
  child = spawn(process.execPath, [path.join(dir, 'server', 'index.js')], {
    cwd: dir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr?.on('data', (c) => (stderr += String(c)))
  const base = `http://127.0.0.1:${port}`
  let up = false
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 250))
    up = await fetch(`${base}/api/health`).then(
      (r) => r.ok,
      () => false,
    )
  }
  check('the server starts from the bundle in a clean folder', up, stderr.slice(0, 300))
  if (!up) throw new Error('server did not start')

  const get = (p: string, init?: RequestInit) => fetch(base + p, init)
  const health = (await (await get('/api/health')).json()) as { status: string; version: string }
  check(
    'GET /api/health is ok and reports a version',
    health.status === 'ok' && /^\d+\.\d+\.\d+/.test(health.version),
  )
  const config = (await (await get('/api/config')).json()) as { aiAvailable: boolean }
  check('without a key it reports that AI is not available', config.aiAvailable === false)

  const home = await get('/')
  const html = await home.text()
  check(
    'GET / serves the web app, not cached',
    home.status === 200 &&
      html.includes('id="root"') &&
      home.headers.get('cache-control') === 'no-cache',
  )
  check(
    'a client-side route falls back to the app',
    (await (await get('/about')).text()).includes('id="root"'),
  )
  const csp = home.headers.get('content-security-policy') ?? ''
  check(
    'CSP is strict and upgrades insecure requests in production',
    csp.includes("script-src 'self'") &&
      csp.includes('upgrade-insecure-requests') &&
      !csp.includes('unsafe'),
  )
  check('no framework banner', home.headers.get('x-powered-by') === null)

  const evalPage = await (await get('/evaluation')).text()
  check(
    '/evaluation carries its state in the page',
    evalPage.includes('id="cekkutip-evaluation"') && evalPage.includes('{"available":false}'),
  )
  check(
    '/api/evaluation says there are no results yet',
    JSON.stringify(await (await get('/api/evaluation')).json()) === '{"available":false}',
  )

  const asset = /assets\/index-[^"']+\.js/.exec(html)?.[0]
  const jsRes = asset ? await get(`/${asset}`, { headers: { 'accept-encoding': 'gzip' } }) : null
  check(
    'the script is cached for a year and compressed',
    !!jsRes &&
      (jsRes.headers.get('cache-control') ?? '').includes('immutable') &&
      jsRes.headers.get('content-encoding') === 'gzip',
  )

  const experiment = await get('/api/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ references: ['x'], options: { ablation: 'a1' } }),
  })
  check('experiment options are refused in production', experiment.status === 400)

  // 4. A real check over the stream, answered from the recorded cache.
  const refs = [
    'Walters, W. H., & Wilder, E. I. (2023). Fabrication and errors in the bibliographic citations generated by ChatGPT. Scientific Reports, 13(1), 14045. https://doi.org/10.1038/s41598-023-41032-5',
    'Sugiyono. (2017). Metode penelitian kuantitatif, kualitatif, dan R&D. Bandung: Alfabeta.',
  ]
  const checkRes = await get('/api/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ references: refs, options: { parseMode: 'llm' } }),
  })
  const lines = (await checkRes.text())
    .split(String.fromCharCode(10))
    .filter(Boolean)
    .map(
      (l) =>
        JSON.parse(l) as {
          type: string
          result?: { status: string; parsed: { parseMode: string } }
          summary?: { verified: number; outOfIndex: number }
        },
    )
  check(
    'POST /api/check streams started, results, done, uncompressed',
    checkRes.status === 200 &&
      checkRes.headers.get('content-encoding') === null &&
      lines[0]?.type === 'started' &&
      lines.at(-1)?.type === 'done',
  )
  const statuses = lines
    .filter((l) => l.type === 'result')
    .map((l) => l.result?.status)
    .sort()
  check(
    'the verdicts are right (Verified, Out-of-index)',
    JSON.stringify(statuses) === JSON.stringify(['out_of_index', 'verified']),
    String(statuses),
  )
  const modes = lines.filter((l) => l.type === 'result').map((l) => l.result?.parsed.parseMode)
  check(
    'a request for the model without a key falls back to the no-AI reader',
    modes.length === 2 && modes.every((m) => m === 'regex'),
    String(modes),
  )

  // 5. Shutdown.
  const exited = new Promise<number | null>((resolve) =>
    child?.once('exit', (code) => resolve(code)),
  )
  child.kill('SIGTERM')
  const code = await Promise.race([
    exited,
    new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 5000)),
  ])
  check(
    'the process stops when told to (on Windows SIGTERM is a forced stop; the Linux image handles it gracefully)',
    code !== 'timeout',
  )
  child = null
} catch (err) {
  console.log(`ERROR: ${(err as Error).message}`)
  results.push({ ok: false, name: 'run', detail: (err as Error).message })
} finally {
  cleanup()
}

const failed = results.filter((r) => !r.ok).length
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`)
writeFileSync(
  path.join(tmpdir(), 'cekkutip-verify-production.txt'),
  results.map((r) => `${r.ok ? 'pass' : 'FAIL'} ${r.name}`).join('\n'),
)
process.exit(failed ? 1 : 0)
