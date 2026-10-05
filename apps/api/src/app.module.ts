import { Module } from '@nestjs/common'

import { CommonModule } from './common/common.module.js'
import { ConfigModule } from './config/config.module.js'
import { HealthModule } from './health/health.module.js'

@Module({
  imports: [ConfigModule, CommonModule, HealthModule],
})
export class AppModule {}
