import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { WorkerModule } from './worker.module.js'

async function bootstrap() {
  // No HTTP server: the worker only runs background jobs (pg-boss, added in Phase 3)
  const app = await NestFactory.createApplicationContext(WorkerModule)
  app.enableShutdownHooks()
  new Logger('Worker').log('Worker started')
}

await bootstrap()
