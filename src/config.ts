import type { LogLevelDesc } from 'loglevel'

export type Config = {
  logLevel: LogLevelDesc
  host: string
  port: number
}

export const config: Config = {
  logLevel: (process.env['LOG_LEVEL'] as LogLevelDesc) || 'info',
  host: process.env['HOST'] || 'http://localhost',
  port: parseInt(process.env['PORT'] || '9000'),
}