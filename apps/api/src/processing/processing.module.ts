import { Module } from '@nestjs/common'

import { AiQuotaService } from './ai-quota.service.js'
import { ContentIngestService } from './content-ingest.service.js'

@Module({
  providers: [ContentIngestService, AiQuotaService],
  exports: [ContentIngestService],
})
export class ProcessingModule {}
