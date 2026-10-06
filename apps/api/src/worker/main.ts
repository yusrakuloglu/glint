import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { loadLocalEnv } from '../config/load-local-env.js'

import { WorkerModule } from './worker.module.js'

loadLocalEnv()

async function bootstrap() {
  // No HTTP server: the worker shares the api code base but runs as its own process
  const app = await NestFactory.createApplicationContext(WorkerModule)
  app.enableShutdownHooks()
  new Logger('Worker').log('Worker started')
}

await bootstrap()
