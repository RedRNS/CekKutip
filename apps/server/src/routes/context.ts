import type { Response } from 'express'
import type { Env } from '../config/env.js'
import type { Limits } from '../config/limits.js'
import type { AppLogger } from '../lib/logger.js'
import type { PipelineDeps } from '../pipeline/run.js'

export interface AppContext {
  pipeline: PipelineDeps
  limits: Limits
  env: Pick<Env, 'enableExperimentModes' | 'trustProxy' | 'nodeEnv' | 'geminiModel'>
  logger: AppLogger
  /** Built web app to serve. Omit in tests and when running the API alone. */
  staticDir?: string
}

/** Errors always have this shape: a stable code and a message a person can read. */
export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } })
}
