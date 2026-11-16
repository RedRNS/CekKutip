/**
 * Run the example list (apps/web/src/data/example-list.ts) through a running server and print
 * the verdict of each entry. Use it to confirm the list before a demo, and to record the
 * retrieval cache that the end-to-end tests replay.
 * Usage: npx tsx scripts/check-examples.ts [baseUrl] [llm|regex]
 */
import type { StreamEvent } from '@cekkutip/shared'
import { EXAMPLES } from '../apps/web/src/data/example-list.js'

const base = process.argv[2] ?? 'http://localhost:8787'
const parseMode = process.argv[3] === 'llm' ? 'llm' : 'regex'

const t0 = Date.now()
const res = await fetch(`${base}/api/check`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ references: EXAMPLES.map((e) => e.text), options: { parseMode } }),
})
if (!res.ok) {
  console.log('HTTP', res.status, await res.text())
  process.exit(1)
}
const events = (await res.text())
  .split('\n')
  .filter((l) => l !== '')
  .map((l) => JSON.parse(l) as StreamEvent)

const rows: string[] = []
for (const e of events) {
  if (e.type !== 'result') continue
  const r = e.result
  rows[r.index] =
    `${String(r.index + 1).padStart(2)} ${EXAMPLES[r.index]!.kind.padEnd(12)} ${r.status.padEnd(12)} ` +
    `${r.reasons.join('+').padEnd(32)} ${r.parsed.parseMode.padEnd(5)} ${r.parsed.type.padEnd(16)} ` +
    `t=${r.scores.title.toFixed(2)} a=${r.scores.authors.toFixed(2)} src=${r.record?.source ?? '-'} | ${r.raw.slice(0, 40)}`
}
console.log(`mode=${parseMode}`)
console.log(rows.join('\n'))
const done = events.find((e) => e.type === 'done')
console.log(done ? `summary: ${JSON.stringify(done.summary)}` : 'NO done EVENT')
console.log(`total ${Date.now() - t0} ms`)
