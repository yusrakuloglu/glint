import { Module } from '@nestjs/common'

import { ConfigModule } from '../config/config.module.js'
import { PrismaModule } from '../prisma/prisma.module.js'

/** Root module of the worker process: background jobs only, no HTTP layer. */
@Module({
  imports: [ConfigModule, PrismaModule],
})
export class WorkerModule {}
