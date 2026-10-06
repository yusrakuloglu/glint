import { type INestApplication } from '@nestjs/common'
import { json, type NextFunction, type Request, type Response } from 'express'

import { REQUEST_ID_HEADER } from './common/request-id.middleware.js'
import { ENV, type Env } from './config/env.js'
import { SAVE_LINK_BODY_LIMIT } from './links/links.contracts.js'

const saveLinkJson = json({ limit: SAVE_LINK_BODY_LIMIT })

/**
 * App-level HTTP settings shared by main.ts and tests. Must run before
 * `app.init()`: the body parser registered here takes precedence over Nest's.
 */
export function configureApp(app: INestApplication) {
  // Only POST /links may carry a page snapshot. Nest's own JSON parser (100 KB)
  // runs next and skips a body that is already parsed.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' && req.path === '/links') {
      saveLinkJson(req, res, next)
      return
    }
    next()
  })

  const env = app.get<Env>(ENV)

  app.enableCors({
    origin: env.WEB_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', REQUEST_ID_HEADER],
    // Lets the web app show the request id next to an error
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  })
  app.enableShutdownHooks()
}
