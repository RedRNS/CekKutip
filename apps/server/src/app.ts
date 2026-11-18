import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import compression from 'compression'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { createCheckRouter } from './routes/check.js'
import { sendError } from './routes/context.js'
import type { AppContext } from './routes/context.js'
import {
  createEvaluationLoader,
  createEvaluationRouter,
  evaluationDataBlock,
} from './routes/evaluation.js'
import { createConfigRouter, createHealthRouter } from './routes/health.js'

export function createApp(ctx: AppContext): express.Express {
  const app = express()
  app.set('trust proxy', ctx.env.trustProxy)

  // Strict CSP: same-origin only, no inline script or style (docs/DESIGN.md keeps the UI free of both).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(ctx.env.nodeEnv === 'production' ? { upgradeInsecureRequests: [] } : {}),
        },
      },
    }),
  )

  // Compress text responses (the page, scripts, styles, JSON). The check stream is left alone: gzip
  // would hold lines back until a buffer fills, and results must reach the browser one by one.
  app.use(
    compression({
      filter: (req, res) => !req.path.startsWith('/api/check') && compression.filter(req, res),
    }),
  )

  app.use('/api/health', createHealthRouter())
  app.use('/api/config', createConfigRouter(ctx))
  const loadEvaluation = createEvaluationLoader(ctx.evaluationFile)
  app.use('/api/evaluation', createEvaluationRouter(loadEvaluation))

  const limiter = rateLimit({
    windowMs: ctx.limits.rateLimitWindowMs,
    limit: ctx.limits.rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      sendError(
        res,
        429,
        'rate_limited',
        'You have reached the limit of checks for now. Wait a few minutes and try again.',
      ),
  })
  app.use('/api/check', limiter, createCheckRouter(ctx))

  app.use('/api', (_req, res) =>
    sendError(res, 404, 'not_found', 'There is nothing at this address.'),
  )

  // The built web app, with fallback to index.html for client-side routes.
  if (ctx.staticDir && existsSync(path.join(ctx.staticDir, 'index.html'))) {
    const dir = ctx.staticDir
    app.use(
      '/assets',
      express.static(path.join(dir, 'assets'), { immutable: true, maxAge: '1y', index: false }),
    )
    app.use(express.static(dir, { index: false, maxAge: '1h' }))
    const indexFile = path.join(dir, 'index.html')
    app.use(async (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      res.set('cache-control', 'no-cache')
      if (req.path !== '/evaluation') return res.sendFile(indexFile)
      try {
        // A direct visit to the Evaluation page gets its state in the page itself.
        const html = (await readFile(indexFile, 'utf8')).replace(
          '</head>',
          `${evaluationDataBlock(await loadEvaluation())}</head>`,
        )
        res.type('html').send(html)
      } catch (err) {
        next(err)
      }
    })
  }

  const onError: ErrorRequestHandler = (
    err: { type?: string; status?: number },
    _req,
    res,
    next,
  ) => {
    if (res.headersSent) return next(err)
    if (err.type === 'entity.too.large') {
      return sendError(
        res,
        413,
        'payload_too_large',
        'That is too much text for one request. Split your list and check it in parts.',
      )
    }
    if (
      err.type === 'entity.parse.failed' ||
      err.type === 'encoding.unsupported' ||
      err.type === 'charset.unsupported'
    ) {
      return sendError(res, 400, 'invalid_json', 'The request body is not valid JSON.')
    }
    return sendError(
      res,
      500,
      'internal_error',
      'Something went wrong on our side. Your text was not stored. Try again in a moment.',
    )
  }
  app.use(onError)

  return app
}
