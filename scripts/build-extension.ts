/**
 * Build the browser extension (Chrome, Edge, Brave: Manifest V3) into extension/dist.
 *
 *   npm run build:extension
 *   CEKKUTIP_URL=http://localhost:8799 EXTENSION_OUT=/some/dir npx tsx scripts/build-extension.ts
 *
 * The extension talks to one CekKutip server. By default that is the live site named in
 * apps/web/src/site.config.ts. CEKKUTIP_URL points a build somewhere else (a test server).
 * The manifest asks for access to that one site and nothing else.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { siteConfig } from '../apps/web/src/site.config.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const ext = path.join(root, 'extension')
const outDir = path.resolve(process.env.EXTENSION_OUT ?? path.join(ext, 'dist'))

const site = new URL(process.env.CEKKUTIP_URL ?? siteConfig.demoUrl)
if (site.protocol !== 'https:' && site.hostname !== 'localhost' && site.hostname !== '127.0.0.1') {
  throw new Error(`The server address must be https (or localhost for a test): ${site.origin}`)
}
if (siteConfig.demoUrl.startsWith('TODO') && !process.env.CEKKUTIP_URL) {
  throw new Error('site.config.ts has no demo URL yet. Fill it in, or set CEKKUTIP_URL.')
}
/** A match pattern names a host, not a port: "http://localhost/*" covers any local port. */
const matchPattern = `${site.protocol}//${site.hostname}/*`
const version = (
  JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }
).version

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

await build({
  entryPoints: {
    panel: path.join(ext, 'src/panel/main.tsx'),
    background: path.join(ext, 'src/background.ts'),
    bridge: path.join(ext, 'src/bridge.ts'),
  },
  outdir: outDir,
  bundle: true,
  format: 'iife', // a content script cannot be an ES module
  target: 'chrome127',
  minify: true,
  sourcemap: false,
  tsconfig: path.join(ext, 'tsconfig.json'),
  loader: { '.woff2': 'file', '.woff': 'file' },
  assetNames: 'assets/[name]-[hash]',
  define: {
    __SITE_URL__: JSON.stringify(site.origin),
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'warning',
})

// Chrome reads WOFF2. The older WOFF copies that the font packages also list are dead weight.
const cssFile = path.join(outDir, 'panel.css')
writeFileSync(
  cssFile,
  readFileSync(cssFile, 'utf8').replace(/,\s*url\("[^"]*\.woff"\)\s*format\("woff"\)/g, ''),
)
for (const name of readdirSync(path.join(outDir, 'assets'))) {
  if (name.endsWith('.woff')) rmSync(path.join(outDir, 'assets', name))
}

const icons = [16, 32, 48, 128]
const iconMap = Object.fromEntries(icons.map((n) => [String(n), `icons/${n}.png`]))
mkdirSync(path.join(outDir, 'icons'), { recursive: true })
for (const n of icons)
  copyFileSync(path.join(ext, `icons/${n}.png`), path.join(outDir, `icons/${n}.png`))

const manifest = {
  manifest_version: 3,
  name: 'CekKutip',
  version,
  description:
    'Check a reference list against Crossref, OpenAlex, and DataCite. Verdicts come from fixed rules.',
  icons: iconMap,
  // No default_popup: a popup closes the moment the person clicks outside it, and a check that is
  // running goes with it. The icon opens the side panel instead (background.js sets that up).
  action: { default_title: 'CekKutip', default_icon: iconMap },
  side_panel: { default_path: 'panel.html' },
  background: { service_worker: 'background.js' },
  // storage: the Gemini key and the text waiting from the right-click menu.
  // contextMenus: the item "Check selection with CekKutip".
  // sidePanel: show the extension's own panel. It gives no access to any page.
  permissions: ['storage', 'contextMenus', 'sidePanel'],
  // The CekKutip server and nothing else: the panel calls its API, and a small script runs on its
  // pages to share the Gemini key with the website.
  host_permissions: [matchPattern],
  content_scripts: [{ matches: [matchPattern], js: ['bridge.js'], run_at: 'document_start' }],
  // The side panel API itself needs 116 (sidePanel.open). 127 is the floor this extension was
  // published with, and it is tested on current Chromium only.
  minimum_chrome_version: '127',
}
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

writeFileSync(
  path.join(outDir, 'panel.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CekKutip</title>
    <link rel="stylesheet" href="panel.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="panel.js"></script>
  </body>
</html>
`,
)

console.log(`extension built: ${outDir}`)
console.log(`  server: ${site.origin}   version: ${version}`)
