import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module.js'
import { CommonModule } from './common/common.module.js'
import { ConfigModule } from './config/config.module.js'
import { HealthModule } from './health/health.module.js'

@Module({
  imports: [ConfigModule, CommonModule, AuthModule, HealthModule],
})
export class AppModule {}
