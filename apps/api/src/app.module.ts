import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module.js'
import { CommonModule } from './common/common.module.js'
import { ConfigModule } from './config/config.module.js'
import { HealthModule } from './health/health.module.js'
import { LinksModule } from './links/links.module.js'
import { OpenApiModule } from './openapi/openapi.module.js'
import { PrismaModule } from './prisma/prisma.module.js'
import { QueueModule } from './queue/queue.module.js'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueueModule.forRoot({ role: 'api' }),
    CommonModule,
    AuthModule,
    HealthModule,
    LinksModule,
    OpenApiModule,
  ],
})
export class AppModule {}
