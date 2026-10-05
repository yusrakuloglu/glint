import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module.js'
import { CommonModule } from './common/common.module.js'
import { ConfigModule } from './config/config.module.js'
import { HealthModule } from './health/health.module.js'
import { PrismaModule } from './prisma/prisma.module.js'

@Module({
  imports: [ConfigModule, PrismaModule, CommonModule, AuthModule, HealthModule],
})
export class AppModule {}
