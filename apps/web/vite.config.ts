import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Production builds fail while site.config.ts still contains TODO placeholders,
 * because those values appear on public pages (About, Footer).
 * CEKKUTIP_ALLOW_TODO=1 skips the check for local verification builds only.
 * Never set it in a deploy pipeline.
 */
function failOnTodoPlaceholders(): Plugin {
  const file = fileURLToPath(new URL('./src/site.config.ts', import.meta.url))
  return {
    name: 'cekkutip-fail-on-todo',
    apply: 'build',
    buildStart() {
      if (process.env.CEKKUTIP_ALLOW_TODO === '1') {
        this.warn('CEKKUTIP_ALLOW_TODO=1: site.config.ts placeholders are NOT being enforced.')
        return
      }
      const lines = readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .filter((l) => /:\s*['"`]TODO/.test(l))
      if (lines.length > 0) {
        this.error(
          `site.config.ts still has ${lines.length} TODO placeholder(s) that would show on public pages:\n` +
            lines.map((l) => `  ${l.trim()}`).join('\n'),
        )
      }
    },
  }
}

/**
 * Preload the two fonts the first screen needs (heading and body text), so the browser fetches them
 * together with the script instead of after the stylesheet. Other weights load when first used.
 */
function preloadFirstScreenFonts(): Plugin {
  return {
    name: 'cekkutip-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const wanted = [
          /newsreader-latin-500-normal.*\.woff2$/,
          /ibm-plex-sans-latin-400-normal.*\.woff2$/,
        ]
        return Object.keys(ctx.bundle ?? {})
          .filter((file) => wanted.some((re) => re.test(file)))
          .map((file) => ({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
              href: `/${file}`,
            },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), failOnTodoPlaceholders(), preloadFirstScreenFonts()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { target: 'es2022', sourcemap: false },
})
