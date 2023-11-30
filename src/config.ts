import type { LogLevelDesc } from 'loglevel'
import type { PortableDid } from '@web5/dids'

import { DidDhtMethod } from '@web5/dids'

import 'dotenv/config'

export type Config = {
  logLevel: LogLevelDesc
  host: string
  port: number
  did: PortableDid,
  github: {
    oauth: {
      clientId: string
      clientSecret: string
    }
  }
}

export const config: Config = {
  logLevel: (process.env['LOG_LEVEL'] as LogLevelDesc) || 'info',
  host: process.env['HOST'] || 'http://localhost',
  port: parseInt(process.env['PORT'] || '9000'),
  did: process.env['SEC_DID'] ? JSON.parse(process.env['SEC_DID']) : await DidDhtMethod.create(),
  github: {
    oauth: {
      clientId: process.env['SEC_GH_OAUTH_CLIENT_ID'],
      clientSecret: process.env['SEC_GH_OAUTH_CLIENT_SECRET']
    }
  }
}