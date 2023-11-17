import { HttpServerShutdownHandler } from './http-shutdown-handler.js'
import { config } from './config.js'
import { log } from './logger.js'
import { api } from './api.js'

process.on('unhandledRejection', (reason: any, promise) => {
  log.error(`Unhandled promise rejection. Reason: ${reason}. Promise: ${JSON.stringify(promise)}. Stack: ${reason.stack}`)
})

process.on('uncaughtException', err => {
  log.error('Uncaught exception:', (err.stack || err))
})

// triggered by ctrl+c with no traps in between
process.on('SIGINT', async () => {
  log.info('exit signal received [SIGINT]. starting graceful shutdown')

  gracefulShutdown()
})

// triggered by docker, tiny etc.
process.on('SIGTERM', async () => {
  log.info('exit signal received [SIGTERM]. starting graceful shutdown')

  gracefulShutdown()
})

const server = api.listen(config.port, () => {
  log.info(`Server listening on port ${config.port}`)
})
const httpServerShutdownHandler = new HttpServerShutdownHandler(server)

function gracefulShutdown() {
  httpServerShutdownHandler.stop(async () => {
    log.info('http server stopped.')
    process.exit(0)
  })
}