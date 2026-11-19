import { randomUUID } from 'node:crypto'
import express, { Router } from 'express'
import { CheckRequestSchema } from '@cekkutip/shared'
import { GEMINI_KEY_HEADER, isPlausibleGeminiKey, normalizeKeyInput } from '@cekkutip/shared/apikey'
import type { StreamEvent } from '@cekkutip/shared'
import { LimitExceededError, prepareReferences } from '../pipeline/split.js'
import { runPipeline } from '../pipeline/run.js'
import { ABLATIONS, DEFAULT_OPTIONS, applyAblation } from '../pipeline/types.js'
import type { AblationName, PipelineOptions } from '../pipeline/types.js'
import { TOOL_VERSION } from '../version.js'
import { sendError } from './context.js'
import type { AppContext } from './context.js'

export function createCheckRouter(ctx: AppContext): Router {
  const router = Router()
  router.use(express.json({ limit: ctx.limits.maxBodyBytes }))

  router.post('/', async (req, res) => {
    const reqId = randomUUID()

    const body = CheckRequestSchema.safeParse(req.body)
    if (!body.success) {
      ctx.logger.rejected({ reqId, code: 'invalid_request' })
      return sendError(
        res,
        400,
        'invalid_request',
        'The request is not valid. Send JSON like {"references": ["..."]} or {"references": "text"}.',
      )
    }
    const { references, options: requested } = body.data

    // Experiment options exist for the evaluation harness only.
    let options: PipelineOptions = { ...DEFAULT_OPTIONS, parseMode: requested.parseMode }
    if (requested.system !== undefined || requested.ablation !== undefined) {
      if (!ctx.env.enableExperimentModes) {
        ctx.logger.rejected({ reqId, code: 'experiment_modes_disabled' })
        return sendError(
          res,
          400,
          'experiment_modes_disabled',
          'Experiment options are turned off on this server.',
        )
      }
      if (requested.system !== undefined && requested.system !== 'cekkutip') {
        return sendError(
          res,
          400,
          'unknown_system',
          'Only the "cekkutip" system is available over HTTP.',
        )
      }
      if (requested.ablation !== undefined) {
        if (!ABLATIONS.includes(requested.ablation as AblationName)) {
          return sendError(
            res,
            400,
            'unknown_ablation',
            `Ablation must be one of ${ABLATIONS.join(', ')}.`,
          )
        }
        options = applyAblation(options, requested.ablation as AblationName)
      }
    }
    // A person's own AI key travels in one header and lives only as long as this request.
    // It is checked for shape, handed to the model client, and never stored, logged, or echoed.
    let ownKey: string | null = null
    const header = req.header(GEMINI_KEY_HEADER)
    if (header !== undefined && header.trim() !== '') {
      const candidate = normalizeKeyInput(header)
      if (!isPlausibleGeminiKey(candidate) || ctx.createGemini === undefined) {
        ctx.logger.rejected({ reqId, code: 'invalid_api_key' })
        return sendError(
          res,
          400,
          'invalid_api_key',
          'The AI key you sent does not look like a Gemini API key. Check it, or remove it to use the shared reader.',
        )
      }
      ownKey = candidate
    }
    const pipeline = ownKey ? { ...ctx.pipeline, gemini: ctx.createGemini?.(ownKey) } : ctx.pipeline

    // Without any AI key, every check uses the no-AI reader instead of failing.
    if (pipeline.gemini === undefined) options = { ...options, parseMode: 'regex' }

    let list: string[]
    try {
      list = prepareReferences(references, ctx.limits)
    } catch (err) {
      if (err instanceof LimitExceededError) {
        ctx.logger.rejected({ reqId, code: err.detail.error })
        return sendError(res, 400, err.detail.error, err.message)
      }
      throw err
    }
    if (list.length === 0) {
      ctx.logger.rejected({ reqId, code: 'no_references' })
      return sendError(res, 400, 'no_references', 'Paste at least one reference to check.')
    }

    // From here on the response is a stream of JSON lines, one event per line.
    res.status(200)
    res.set({
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    })
    res.flushHeaders()

    const abort = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) abort.abort()
    })

    const write = (event: StreamEvent) =>
      new Promise<void>((resolve) => {
        if (res.writableEnded || res.destroyed) return resolve()
        const flushed = res.write(`${JSON.stringify(event)}\n`)
        if (flushed) return resolve()
        res.once('drain', resolve)
        res.once('close', resolve)
      })

    const t0 = performance.now()
    let checkFailed = 0
    try {
      const summary = await runPipeline(
        {
          references: list,
          options,
          parseBatchSize: ctx.limits.parseBatchSize,
          retrievalConcurrency: ctx.limits.retrievalConcurrency,
          toolVersion: TOOL_VERSION,
          signal: abort.signal,
          onEvent: write,
        },
        { ...pipeline, onError: (code) => ctx.logger.lookupError({ reqId, code }) },
      )
      checkFailed = summary.checkFailed
    } catch {
      // Headers are already sent, so the status cannot change. The stream just ends without "done",
      // which the browser reads as a failed check. Nothing about the request is logged but a code.
      ctx.logger.failure({ reqId, code: 'stream_failed' })
    } finally {
      ctx.logger.check({
        reqId,
        count: list.length,
        parseMode: options.parseMode,
        ownKey: ownKey !== null,
        latencyMs: Math.round(performance.now() - t0),
        checkFailed,
        aborted: abort.signal.aborted,
      })
      if (!res.writableEnded) res.end()
    }
  })

  return router
}
