import type { Response } from 'express'
import type { GeminiClient } from '../clients/gemini.js'
import type { Env } from '../config/env.js'
import type { Limits } from '../config/limits.js'
import type { AppLogger } from '../lib/logger.js'
import type { PipelineDeps } from '../pipeline/run.js'

export interface AppContext {
  pipeline: PipelineDeps
  /**
   * Builds a model client from a person's own key, for the one request that carries it.
   * Absent in tests that do not need it: a key sent then is refused, not ignored.
   */
  createGemini?: (apiKey: string) => GeminiClient
  limits: Limits
  env: Pick<Env, 'enableExperimentModes' | 'trustProxy' | 'nodeEnv' | 'geminiModel'>
  logger: AppLogger
  /** Built web app to serve. Omit in tests and when running the API alone. */
  staticDir?: string
  /** eval/results/summary.json. The Evaluation page shows it when it holds real results. */
  evaluationFile?: string
}

/** Errors always have this shape: a stable code and a message a person can read. */
export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } })
}
