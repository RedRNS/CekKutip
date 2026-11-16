/**
 * Server for end-to-end tests and screenshots: the built web app plus the API, with every lookup
 * answered from the recorded cache in apps/web/e2e/cache. No network, no AI key, no contact address.
 *
 * Usage: npx tsx scripts/e2e-server.ts        (builds the web app first)
 *        E2E_SKIP_BUILD=1 npx tsx scripts/e2e-server.ts
 *
 * Re-record the cache after changing the example list:
 *   start a server with RETRIEVAL_CACHE_DIR=apps/web/e2e/cache and no GEMINI_API_KEY,
 *   then run: npx tsx scripts/check-examples.ts <baseUrl> regex
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

if (process.env.E2E_SKIP_BUILD !== '1') {
  // CEKKUTIP_ALLOW_TODO lets this local build pass while site.config.ts still has placeholders.
  execSync('npm run build -w @cekkutip/web', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CEKKUTIP_ALLOW_TODO: '1' },
  })
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: process.env.E2E_PORT ?? '8799',
  GEMINI_API_KEY: '',
  CROSSREF_MAILTO: '',
  OPENALEX_API_KEY: '',
  RETRIEVAL_CACHE_DIR: fileURLToPath(new URL('../apps/web/e2e/cache', import.meta.url)),
  RETRIEVAL_CACHE_REPLAY_ONLY: 'true',
  RATE_LIMIT_MAX: '100000',
  MAX_REFERENCES: process.env.E2E_MAX_REFERENCES ?? '12',
  STATIC_DIR: fileURLToPath(new URL('../apps/web/dist', import.meta.url)),
  LOG_LEVEL: 'warn',
})

await import('../apps/server/src/index.js')
