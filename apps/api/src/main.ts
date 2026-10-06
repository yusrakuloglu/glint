import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'
import { ENV, type Env } from './config/env.js'
import { loadLocalEnv } from './config/load-local-env.js'
import { configureApp } from './configure-app.js'

loadLocalEnv()

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  configureApp(app)
  await app.listen(app.get<Env>(ENV).API_PORT)
}

await bootstrap()
