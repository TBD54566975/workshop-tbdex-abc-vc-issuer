import { log } from '../logger.js'

import audit from 'express-requests-logger'

export const auditLogger = audit({
  logger: log,
  request: { maskHeaders: ['authorization'] }
})