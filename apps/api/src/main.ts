import { existsSync } from 'node:fs'

import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'
import { ENV, type Env } from './config/env.js'
import { configureApp } from './configure-app.js'

// Local dev reads the repo-root .env; deployed environments set variables directly
const rootEnvFile = new URL('../../../.env', import.meta.url)
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  configureApp(app)
  await app.listen(app.get<Env>(ENV).API_PORT)
}

await bootstrap()
