/**
 * Bundle the server for production into dist/server/index.js.
 *
 * Our own code, including the shared workspace package (which is TypeScript source), is bundled.
 * Every other package stays external and is installed from package-lock.json in the image
 * (`npm ci --omit=dev`). Bundling third-party packages is avoided on purpose: pino and the Google SDK
 * use dynamic requires and worker threads that do not survive bundling.
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}dist/server`

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const result = await build({
  entryPoints: [`${root}apps/server/src/index.ts`],
  outfile: `${outDir}/index.js`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: 'linked',
  metafile: true,
  legalComments: 'none',
  logLevel: 'info',
  // CommonJS packages that are loaded from node_modules may call require() from this ES module.
  banner: {
    js: "import { createRequire as __cekkutipCreateRequire } from 'node:module'; const require = __cekkutipCreateRequire(import.meta.url);",
  },
  plugins: [
    {
      name: 'external-except-workspace',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) => {
          // The entry point, and absolute paths (on Windows they start with a drive letter): ours.
          if (args.kind === 'entry-point' || path.isAbsolute(args.path)) return undefined
          // Our own workspace packages are TypeScript source: bundle them.
          if (args.path.startsWith('@cekkutip/')) return undefined
          // Node built-ins and every other package are loaded from node_modules at run time.
          return { path: args.path, external: true }
        })
      },
    },
  ],
})

// Every package left external must be a production dependency of the server, or the image would
// start without it. Fail the build here rather than at the first request.
const declared = new Set(
  Object.keys(
    (
      JSON.parse(readFileSync(`${root}apps/server/package.json`, 'utf8')) as {
        dependencies: Record<string, string>
      }
    ).dependencies,
  ),
)
const packageOf = (spec: string) =>
  (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]) as string
const used = new Set<string>()
for (const output of Object.values(result.metafile.outputs)) {
  for (const imp of output.imports) {
    if (imp.external && !imp.path.startsWith('node:')) used.add(packageOf(imp.path))
  }
}
const missing = [...used].filter(
  (name) => !declared.has(name) && !name.startsWith('@cekkutip/') && !isBuiltin(name),
)
if (missing.length > 0) {
  throw new Error(
    `The server bundle imports packages that are not dependencies of @cekkutip/server: ${missing.join(', ')}`,
  )
}
console.log(`external packages (installed in the image): ${[...used].sort().join(', ')}`)

// Node reads index.js as an ES module only when the nearest package.json says so. The image has no
// package.json next to the bundle, so write the one line it needs.
writeFileSync(
  `${outDir}/package.json`,
  `${JSON.stringify({ type: 'module' })}
`,
)

console.log(`server bundle: ${(statSync(`${outDir}/index.js`).size / 1024).toFixed(0)} KB`)
