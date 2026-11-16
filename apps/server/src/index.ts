import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { loadEnv } from './config/env.js'
import { loadLimits } from './config/limits.js'
import { createLogger } from './lib/logger.js'
import { TOOL_VERSION } from './version.js'
import { buildPipelineDeps } from './wiring.js'

const env = loadEnv()
const limits = loadLimits()
const logger = createLogger({ level: env.logLevel })
const pipeline = buildPipelineDeps(env, limits)

const defaultStatic = fileURLToPath(new URL('../../web/dist', import.meta.url))
const staticDir =
  process.env.STATIC_DIR?.trim() || (existsSync(defaultStatic) ? defaultStatic : undefined)

const app = createApp({ pipeline, limits, env, logger, staticDir })

const server = app.listen(env.port, () => {
  logger.started({
    port: env.port,
    aiAvailable: pipeline.gemini !== undefined,
    version: TOOL_VERSION,
  })
})

const stop = () => server.close(() => process.exit(0))
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
