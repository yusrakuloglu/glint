import { Module } from '@nestjs/common'

import { ConfigModule } from '../config/config.module.js'
import { PrismaModule } from '../prisma/prisma.module.js'
import { QueueModule } from '../queue/queue.module.js'

/** Root module of the worker process: background jobs only, no HTTP layer. */
@Module({
  imports: [ConfigModule, PrismaModule, QueueModule.forRoot({ role: 'worker' })],
})
export class WorkerModule {}
