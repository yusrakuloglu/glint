import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'

import { ENV, type Env } from '../config/env.js'
import { PrismaClient } from '../generated/prisma/client.js'

/** Prisma client for the app database. Connects lazily on the first query. */
@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })
  }

  // Last shutdown phase: queue workers stop in onModuleDestroy and may still query until then
  async onApplicationShutdown() {
    await this.$disconnect()
  }
}
