import { Router } from 'express'
import type { PublicConfig } from '@cekkutip/shared'
import { TOOL_VERSION } from '../version.js'
import type { AppContext } from './context.js'

export function createHealthRouter(): Router {
  const router = Router()
  const startedAt = Date.now()
  router.get('/', (_req, res) => {
    res.set('cache-control', 'no-store')
    res.json({
      status: 'ok',
      version: TOOL_VERSION,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    })
  })
  return router
}

export function createConfigRouter(ctx: AppContext): Router {
  const router = Router()
  router.get('/', (_req, res) => {
    const body: PublicConfig = {
      maxReferences: ctx.limits.maxReferences,
      maxReferenceChars: ctx.limits.maxReferenceChars,
      toolVersion: TOOL_VERSION,
      aiAvailable: ctx.pipeline.gemini !== undefined,
    }
    res.set('cache-control', 'no-store')
    res.json(body)
  })
  return router
}
