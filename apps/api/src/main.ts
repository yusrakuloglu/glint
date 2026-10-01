import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'

const DEFAULT_PORT = 3001

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableShutdownHooks()
  await app.listen(process.env.API_PORT ?? DEFAULT_PORT)
}

await bootstrap()
