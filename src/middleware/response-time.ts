import type { Request, Response } from 'express'

import { default as responseTimeMiddleware } from 'response-time'
import { responseHistogram } from '../metrics.js'
import { log } from '../logger.js'



export const responseTime = responseTimeMiddleware((req: Request, res: Response, time) => {
  const route = (req.method + req.url)
    .toLowerCase()
    .replace(/[:.]/g, '')
    .replace(/\//g, '_')

  const statusCode = res.statusCode.toString()
  responseHistogram.labels(route, statusCode).observe(time)
  log.info(req.method, decodeURI(req.url), res.statusCode)
})