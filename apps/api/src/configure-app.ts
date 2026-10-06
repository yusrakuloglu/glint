import { type INestApplication } from '@nestjs/common'

import { REQUEST_ID_HEADER } from './common/request-id.middleware.js'
import { ENV, type Env } from './config/env.js'

/** App-level HTTP settings shared by main.ts and tests. */
export function configureApp(app: INestApplication) {
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
