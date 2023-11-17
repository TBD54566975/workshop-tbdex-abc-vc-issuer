import { responseTime } from './middleware/response-time.js'
import { auditLogger } from './middleware/audit-logger.js'
import { register } from 'prom-client'
import { config } from './config.js'

import express from 'express'
import cors from 'cors'

export const api = express()
api.use(cors())
api.use(responseTime)

//! Note: uncomment to enable audit logging
// api.use(auditLogger)


api.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
  } catch (e) {
    res.status(500).end(e)
  }
})

api.get('/', async (req, res) => {
  return res.sendStatus(504)
})