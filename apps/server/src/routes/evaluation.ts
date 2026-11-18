import { readFile, stat } from 'node:fs/promises'
import { Router } from 'express'
import { parseEvaluationSummary } from '@cekkutip/shared/evaluation'
import type { EvaluationSummary } from '@cekkutip/shared/evaluation'

export type EvaluationLoader = () => Promise<EvaluationSummary | null>

/**
 * Reads eval/results/summary.json and returns it only when it is complete and shows real results.
 * Returns null for everything else: no file, unreadable or invalid JSON, an incomplete summary, or one
 * made from the template data (`sample: true`). The file is re-read when it changes, so new results
 * appear without a restart.
 */
export function createEvaluationLoader(summaryFile: string | undefined): EvaluationLoader {
  let cached: { mtimeMs: number; size: number; summary: EvaluationSummary | null } | null = null

  return async () => {
    if (!summaryFile) return null
    try {
      const info = await stat(summaryFile)
      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
        return cached.summary
      }
      let summary: EvaluationSummary | null = null
      try {
        summary = parseEvaluationSummary(JSON.parse(await readFile(summaryFile, 'utf8')))
      } catch {
        summary = null // not valid JSON
      }
      cached = { mtimeMs: info.mtimeMs, size: info.size, summary }
      return summary
    } catch {
      return null // the file does not exist
    }
  }
}

/**
 * GET /api/evaluation: the evaluation summary, when real results exist.
 *
 * Answers 200 with `{ "available": false }` when there is nothing to show. It is 200 and not 404 on
 * purpose: "no results yet" is a normal state, and a 404 would put an error line in every visitor's
 * browser console.
 */
export function createEvaluationRouter(load: EvaluationLoader): Router {
  const router = Router()
  router.get('/', async (_req, res) => {
    const summary = await load()
    res.set('cache-control', 'no-cache')
    res.json(summary ?? { available: false })
  })
  return router
}

export const EVALUATION_ELEMENT_ID = 'cekkutip-evaluation'

/**
 * The evaluation state as a data block for index.html, so a direct visit to /evaluation needs no extra
 * request and the page does not change shape after it first paints. A `<script type="application/json">`
 * is data, not code, so it is allowed by the strict Content Security Policy.
 * "<" is escaped so that nothing inside the JSON can end the block early.
 */
export function evaluationDataBlock(summary: EvaluationSummary | null): string {
  const lessThan = String.fromCharCode(92) + 'u003c'
  const json = JSON.stringify(summary ?? { available: false }).replaceAll('<', lessThan)
  return `<script id="${EVALUATION_ELEMENT_ID}" type="application/json">${json}</script>`
}
